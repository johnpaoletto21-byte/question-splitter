/**
 * adapters/ui/local-app/preview-server.ts
 *
 * Local HTTP server for the real browser upload flow, summary preview,
 * and session-only prompt editing UI.
 *
 * Routes:
 *   GET  /summary-preview  — renders PREVIEW_FIXTURE via renderSummaryHtml (TASK-501)
 *   GET  /prompt-edit      — renders session-only prompt editor (TASK-502)
 *   POST /prompt-edit      — applies prompt edits to the in-memory store, redirects to GET
 *
 * Run:
 *   npm run preview
 *
 * Then open in a browser:
 *   http://localhost:3002/summary-preview   — run summary UI
 *   http://localhost:3002/prompt-edit       — prompt editor UI
 *
 * Boundary: uses only Node built-in http module and existing local-app/core modules.
 * No new runtime dependencies added.
 *
 * The server only starts when this file is the Node entry point
 * (require.main === module guard), so importing this module in tests is safe.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { renderSummaryHtml } from './summary-renderer';
import { PREVIEW_FIXTURE } from './preview-fixture';
import { renderPromptEditorHtml } from './prompt-editor';
import { renderRunFormHtml, renderRunStatusHtml, renderRunErrorHtml } from './run-renderer';
import { renderRunDebugMarkdown } from './debug-package';
import {
  createRunRecord,
  getRunRecord,
  appendRunLog,
  markRunStatus,
  markRunSucceeded,
  markRunFailed,
  createDiagramRunRecord,
  getDiagramRunRecord,
  appendDiagramRunLog,
  markDiagramRunStatus,
  markDiagramRunSucceeded,
  markDiagramRunFailed,
  createHintRunRecord,
  getHintRunRecord,
  appendHintRunLog,
  markHintRunStatus,
  markHintRunSucceeded,
  markHintRunAllSucceeded,
  markHintRunFailed,
} from './run-state';
import { parsePdfUpload, MAX_UPLOAD_BYTES } from './upload-handler';
import {
  parseDiagramUpload,
  MAX_DIAGRAM_UPLOAD_BYTES,
} from './diagram-upload-handler';
import {
  renderDiagramFormHtml,
  renderDiagramStatusHtml,
  renderDiagramResultsHtml,
  renderDiagramErrorHtml,
} from './diagram-renderer';
import {
  renderHintFormHtml,
  renderHintStatusHtml,
  renderHintResultsHtml,
  renderHintAllResultsHtml,
  renderHintErrorHtml,
} from './hint-renderer';
import {
  parseHintUpload,
  MAX_HINT_UPLOAD_BYTES,
} from './hint-upload-handler';
import { GEMINI_HINT_OVERLAY_SCHEMA } from '../../hint-annotation/gemini-hint-overlay';
import {
  getPromptConfig,
  capturePromptSnapshot,
  setAgent1Prompt,
  setReviewerPrompt,
  setAgent2Prompt,
  setHintImageGenPrompt,
  setHintOverlayPrompt,
  setHintBlendRenderPrompt,
} from '../../../core/prompt-config-store/store';
import { loadConfig } from '../../config/local-config/loader';
import { ConfigMissingError, LocalConfig } from '../../config/local-config/types';
import { runFullPipeline, runDiagramPipeline, runHintPipeline } from '../../run-pipeline';
import type {
  RunFullPipelineInput,
  RunDiagramPipelineInput,
  RunHintPipelineInput,
  HintPipelineResult,
} from '../../run-pipeline';
import type { RunSummaryState } from '../../../core/run-summary/types';
import type { DiagramRunResult } from '../../../core/diagram-detection/types';

const PREVIEW_PORT = process.env['PREVIEW_PORT']
  ? parseInt(process.env['PREVIEW_PORT'], 10)
  : 3002;
const PREVIEW_PATH = '/summary-preview';
const PROMPT_EDIT_PATH = '/prompt-edit';
const RUN_PATH = '/run';
const DIAGRAM_RUN_PATH = '/run-diagrams';
const HINT_RUN_PATH = '/run-hints';

interface PreviewServerOptions {
  loadConfigFn?: typeof loadConfig;
  parsePdfUploadFn?: typeof parsePdfUpload;
  runFullPipelineFn?: (input: RunFullPipelineInput) => Promise<import('../../../core/run-summary/types').RunSummaryState>;
  parseDiagramUploadFn?: typeof parseDiagramUpload;
  runDiagramPipelineFn?: (input: RunDiagramPipelineInput) => Promise<DiagramRunResult>;
  parseHintUploadFn?: typeof parseHintUpload;
  runHintPipelineFn?: (input: RunHintPipelineInput) => Promise<HintPipelineResult>;
}

/**
 * Reads a URL-encoded POST body from an IncomingMessage and returns the raw string.
 * Resolves when the 'end' event fires; rejects on 'error'.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** Returns the current session prompts + default schema as pretty JSON, used to pre-fill the blend config block. */
function currentBlendDefaults(): {
  overlayPrompt: string;
  overlaySchema: string;
  renderPrompt: string;
} {
  const cfg = getPromptConfig();
  return {
    overlayPrompt: cfg.hintOverlayPrompt,
    overlaySchema: JSON.stringify(GEMINI_HINT_OVERLAY_SCHEMA, null, 2),
    renderPrompt: cfg.hintBlendRenderPrompt,
  };
}

function writeHtml(res: http.ServerResponse, statusCode: number, html: string): void {
  const body = Buffer.from(html, 'utf-8');
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function writeMarkdown(res: http.ServerResponse, filename: string, markdown: string): void {
  const body = Buffer.from(markdown, 'utf-8');
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': body.length,
  });
  res.end(body);
}

function writePng(res: http.ServerResponse, filePath: string): void {
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': body.length,
  });
  res.end(body);
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

function extractFailureContext(err: unknown): unknown {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  const record = err as Record<string, unknown>;
  return record['segmentationWindow'] !== undefined
    ? { segmentationWindow: record['segmentationWindow'] }
    : undefined;
}

function tryLoadConfigForDebug(loadConfigFn: typeof loadConfig): {
  config?: LocalConfig;
  configError?: string;
} {
  try {
    return { config: loadConfigFn() };
  } catch (err) {
    return { configError: formatUnknownError(err) };
  }
}

function addDebugLinkToSummaryHtml(html: string, runId: string): string {
  const link = [
    '<body>',
    `  <div class="nav"><a href="/runs/${runId}/debug.md" data-testid="summary-debug-download-link" download>Download Debug Package (.md)</a></div>`,
  ].join('\n');
  return html.replace('<body>', link);
}

function withPreviewUrls(
  summary: RunSummaryState,
  localRunId: string,
  outputDir: string | undefined,
): RunSummaryState {
  return {
    ...summary,
    targets: summary.targets.map((target) => ({
      ...target,
      ...(target.local_output_path !== undefined &&
        outputDir !== undefined &&
        isPathInsideDirectory(target.local_output_path, outputDir)
        ? { preview_url: `/runs/${localRunId}/preview/${encodeURIComponent(target.target_id)}` }
        : {}),
    })),
  };
}

function isPathInsideDirectory(filePath: string, directory: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(directory);
  return resolvedFile === resolvedDirectory ||
    resolvedFile.startsWith(`${resolvedDirectory}${path.sep}`);
}

function loadConfigForForm(loadConfigFn: typeof loadConfig): {
  config?: LocalConfig;
  missingKeys?: ReadonlyArray<string>;
} {
  try {
    return { config: loadConfigFn() };
  } catch (err) {
    if (err instanceof ConfigMissingError) {
      return { missingKeys: err.missingKeys };
    }
    throw err;
  }
}

function startRun(recordId: string, input: RunFullPipelineInput, runFullPipelineFn: PreviewServerOptions['runFullPipelineFn']): void {
  markRunStatus(recordId, 'running');
  appendRunLog(recordId, 'app', 'Run queued from browser upload');

  void runFullPipelineFn!(input)
    .then((summary) => {
      appendRunLog(recordId, 'app', 'Run completed');
      markRunSucceeded(recordId, summary);
    })
    .catch((err: unknown) => {
      const message = formatUnknownError(err);
      appendRunLog(recordId, 'app', `Run failed: ${message}`);
      markRunFailed(recordId, message, extractFailureContext(err));
    });
}

function startDiagramRun(
  recordId: string,
  input: RunDiagramPipelineInput,
  runDiagramPipelineFn: PreviewServerOptions['runDiagramPipelineFn'],
): void {
  markDiagramRunStatus(recordId, 'running');
  appendDiagramRunLog(recordId, 'app', 'Diagram run queued from browser upload');

  // Inject onLog so log events flow into the run record.
  const wrappedInput: RunDiagramPipelineInput = {
    ...input,
    onLog: (event) => appendDiagramRunLog(recordId, event.stage, event.message, event.timestamp),
  };

  void runDiagramPipelineFn!(wrappedInput)
    .then((result) => {
      appendDiagramRunLog(recordId, 'app', 'Diagram run completed');
      markDiagramRunSucceeded(recordId, result);
    })
    .catch((err: unknown) => {
      const message = formatUnknownError(err);
      appendDiagramRunLog(recordId, 'app', `Diagram run failed: ${message}`);
      markDiagramRunFailed(recordId, message);
    });
}

function startHintRun(
  recordId: string,
  input: RunHintPipelineInput,
  runHintPipelineFn: PreviewServerOptions['runHintPipelineFn'],
): void {
  markHintRunStatus(recordId, 'running');
  appendHintRunLog(recordId, 'app', 'Hint run queued from browser upload');

  const wrappedInput: RunHintPipelineInput = {
    ...input,
    onLog: (event) => appendHintRunLog(recordId, event.stage, event.message, event.timestamp),
  };

  void runHintPipelineFn!(wrappedInput)
    .then((result) => {
      appendHintRunLog(recordId, 'app', 'Hint run completed');
      markHintRunSucceeded(recordId, result);
    })
    .catch((err: unknown) => {
      const message = formatUnknownError(err);
      appendHintRunLog(recordId, 'app', `Hint run failed: ${message}`);
      markHintRunFailed(recordId, message);
    });
}

function startHintRunAll(
  recordId: string,
  baseInput: Omit<RunHintPipelineInput, 'method' | 'onLog'>,
  runHintPipelineFn: PreviewServerOptions['runHintPipelineFn'],
): void {
  markHintRunStatus(recordId, 'running');
  appendHintRunLog(recordId, 'app', 'Running all three annotation methods in parallel');

  const methods: Array<'overlay' | 'image-gen' | 'blend'> = ['overlay', 'image-gen', 'blend'];
  const promises = methods.map((method) => {
    const methodOutputDir = path.join(baseInput.outputDir, method);
    return runHintPipelineFn!({
      ...baseInput,
      method,
      outputDir: methodOutputDir,
      onLog: (event) =>
        appendHintRunLog(recordId, `${method}/${event.stage}`, event.message, event.timestamp),
    });
  });

  void Promise.allSettled(promises).then((results) => {
    const allResults: Partial<Record<string, import('../../run-pipeline/hint-pipeline-runner').HintPipelineResult>> = {};
    const errors: string[] = [];
    methods.forEach((method, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        allResults[method] = r.value;
        appendHintRunLog(recordId, 'app', `${method}: completed`);
      } else {
        const message = formatUnknownError(r.reason);
        errors.push(`${method}: ${message}`);
        appendHintRunLog(recordId, 'app', `${method}: failed — ${message}`);
      }
    });

    if (Object.keys(allResults).length > 0) {
      appendHintRunLog(recordId, 'app', `All methods finished. ${Object.keys(allResults).length}/3 succeeded.`);
      markHintRunAllSucceeded(recordId, allResults);
    } else {
      markHintRunFailed(recordId, `All methods failed: ${errors.join('; ')}`);
    }
  });
}

function createPreviewServer(options: PreviewServerOptions = {}): http.Server {
  const loadConfigFn = options.loadConfigFn ?? loadConfig;
  const parsePdfUploadFn = options.parsePdfUploadFn ?? parsePdfUpload;
  const runFullPipelineFn = options.runFullPipelineFn ?? runFullPipeline;
  const parseDiagramUploadFn = options.parseDiagramUploadFn ?? parseDiagramUpload;
  const runDiagramPipelineFn = options.runDiagramPipelineFn ?? runDiagramPipeline;
  const parseHintUploadFn = options.parseHintUploadFn ?? parseHintUpload;
  const runHintPipelineFn = options.runHintPipelineFn ?? runHintPipeline;

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      redirect(res, RUN_PATH);
      return;
    }

    // ── GET /run ─────────────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === RUN_PATH) {
      try {
        const loaded = loadConfigForForm(loadConfigFn);
        writeHtml(res, 200, renderRunFormHtml({
          configReady: loaded.config !== undefined,
          missingKeys: loaded.missingKeys,
          maxUploadMb: MAX_UPLOAD_BYTES / (1024 * 1024),
        }));
      } catch (err) {
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderRunErrorHtml('Config Error', message));
      }
      return;
    }

    // ── POST /run ────────────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === RUN_PATH) {
      let config: LocalConfig;
      try {
        config = loadConfigFn();
      } catch (err) {
        req.resume();
        if (err instanceof ConfigMissingError) {
          writeHtml(res, 400, renderRunErrorHtml(
            'Config Missing',
            `Missing config: ${err.missingKeys.join(', ')}`,
          ));
          return;
        }
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderRunErrorHtml('Config Error', message));
        return;
      }

      parsePdfUploadFn(req, config.OUTPUT_DIR)
        .then((upload) => {
          const promptSnapshot = capturePromptSnapshot();
          const record = createRunRecord({
            runLabel: upload.runLabel,
            pdfFileName: upload.originalFileName,
            pdfFilePath: upload.pdfFilePath,
            outputDir: config.OUTPUT_DIR,
            extractionFields: upload.extractionFields,
            promptSnapshot,
          });
          appendRunLog(record.id, 'upload', `Uploaded ${upload.originalFileName}`);
          if (upload.extractionFields.length > 0) {
            appendRunLog(
              record.id,
              'upload',
              `Configured extraction fields: ${upload.extractionFields.map((f) => f.key).join(', ')}`,
            );
          }
          startRun(
            record.id,
            {
              pdfFilePaths: [upload.pdfFilePath],
              runLabel: upload.runLabel,
              config,
              extractionFields: upload.extractionFields,
              promptSnapshot,
              onLog: (event) => appendRunLog(
                record.id,
                event.stage,
                event.message,
                event.timestamp,
              ),
            },
            runFullPipelineFn,
          );
          redirect(res, `/runs/${record.id}`);
        })
        .catch((err: unknown) => {
          const message = formatUnknownError(err);
          const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
            ? (err as { statusCode: number }).statusCode
            : 400;
          writeHtml(res, statusCode, renderRunErrorHtml('Upload Error', message));
        });
      return;
    }

    // ── GET /runs/:runId/preview/:targetId ──────────────────────────────
    const previewMatch = url.pathname.match(/^\/runs\/([^/]+)\/preview\/([^/]+)$/);
    if (req.method === 'GET' && previewMatch) {
      const record = getRunRecord(previewMatch[1]);
      const targetId = decodeURIComponent(previewMatch[2]);
      const target = record?.summary?.targets.find((entry) => entry.target_id === targetId);
      if (
        !record ||
        !target?.local_output_path ||
        !record.outputDir ||
        !isPathInsideDirectory(target.local_output_path, record.outputDir) ||
        !fs.existsSync(target.local_output_path)
      ) {
        writeHtml(res, 404, renderRunErrorHtml('Preview Not Found', `No preview found for ${targetId}`));
        return;
      }
      writePng(res, target.local_output_path);
      return;
    }

    // ── GET /runs/:runId/source-pdf ──────────────────────────────────────
    const sourcePdfMatch = url.pathname.match(/^\/runs\/([^/]+)\/source-pdf$/);
    if (req.method === 'GET' && sourcePdfMatch) {
      const record = getRunRecord(sourcePdfMatch[1]);
      if (
        !record ||
        !record.pdfFilePath ||
        !record.outputDir ||
        !isPathInsideDirectory(record.pdfFilePath, path.join(record.outputDir, 'uploads')) ||
        !fs.existsSync(record.pdfFilePath)
      ) {
        writeHtml(res, 404, renderRunErrorHtml('PDF Not Found', 'Source PDF not available for this run.'));
        return;
      }
      const body = fs.readFileSync(record.pdfFilePath);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': body.length,
      });
      res.end(body);
      return;
    }

    // ── GET /runs/:runId, /runs/:runId/summary, /runs/:runId/debug.md ───
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)(?:\/(summary|debug\.md))?$/);
    if (req.method === 'GET' && runMatch) {
      const record = getRunRecord(runMatch[1]);
      if (!record) {
        writeHtml(res, 404, renderRunErrorHtml('Run Not Found', `No run found for ${runMatch[1]}`));
        return;
      }

      if (runMatch[2] === 'debug.md') {
        const loaded = tryLoadConfigForDebug(loadConfigFn);
        writeMarkdown(
          res,
          `${record.id}-debug.md`,
          renderRunDebugMarkdown({
            record,
            config: loaded.config,
            configError: loaded.configError,
          }),
        );
        return;
      }

      if (runMatch[2] === 'summary') {
        if (!record.summary) {
          writeHtml(res, 200, renderRunStatusHtml(record));
          return;
        }
        const sourcePdfUrl = record.pdfFilePath ? `/runs/${record.id}/source-pdf` : undefined;
        writeHtml(
          res,
          200,
          addDebugLinkToSummaryHtml(
            renderSummaryHtml(
              withPreviewUrls(record.summary, record.id, record.outputDir),
              { sourcePdfUrl },
            ),
            record.id,
          ),
        );
        return;
      }

      writeHtml(res, 200, renderRunStatusHtml(record));
      return;
    }

    // ── GET /summary-preview ─────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === PREVIEW_PATH) {
      writeHtml(res, 200, renderSummaryHtml(PREVIEW_FIXTURE));
      return;
    }

    // ── GET /prompt-edit ─────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === PROMPT_EDIT_PATH) {
      writeHtml(res, 200, renderPromptEditorHtml(getPromptConfig()));
      return;
    }

    // ── POST /prompt-edit ─────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === PROMPT_EDIT_PATH) {
      readBody(req).then((rawBody) => {
        const params = new URLSearchParams(rawBody);
        const agent1 = params.get('agent1Prompt') ?? '';
        const reviewer = params.get('reviewerPrompt') ?? '';
        const agent2 = params.get('agent2Prompt') ?? '';
        const hintImageGen = params.get('hintImageGenPrompt') ?? '';
        const hintOverlay = params.get('hintOverlayPrompt') ?? '';
        const hintBlendRender = params.get('hintBlendRenderPrompt') ?? '';
        setAgent1Prompt(agent1);
        setReviewerPrompt(reviewer);
        setAgent2Prompt(agent2);
        setHintImageGenPrompt(hintImageGen);
        setHintOverlayPrompt(hintOverlay);
        setHintBlendRenderPrompt(hintBlendRender);
        // Redirect back to GET to show the saved state (POST-Redirect-GET pattern).
        res.writeHead(302, { Location: PROMPT_EDIT_PATH });
        res.end();
      }).catch(() => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error reading form body.\n');
      });
      return;
    }

    // ── GET /run-diagrams ────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === DIAGRAM_RUN_PATH) {
      try {
        const loaded = loadConfigForForm(loadConfigFn);
        writeHtml(res, 200, renderDiagramFormHtml({
          configReady: loaded.config !== undefined,
          missingKeys: loaded.missingKeys,
          maxUploadMb: MAX_DIAGRAM_UPLOAD_BYTES / (1024 * 1024),
        }));
      } catch (err) {
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderDiagramErrorHtml('Config Error', message));
      }
      return;
    }

    // ── POST /run-diagrams ───────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === DIAGRAM_RUN_PATH) {
      let config: LocalConfig;
      try {
        config = loadConfigFn();
      } catch (err) {
        req.resume();
        if (err instanceof ConfigMissingError) {
          writeHtml(res, 400, renderDiagramErrorHtml(
            'Config Missing',
            `Missing config: ${err.missingKeys.join(', ')}`,
          ));
          return;
        }
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderDiagramErrorHtml('Config Error', message));
        return;
      }

      parseDiagramUploadFn(req, config.OUTPUT_DIR)
        .then((upload) => {
          const record = createDiagramRunRecord({
            imageFileName: upload.originalFileName,
            imageFilePath: upload.imageFilePath,
            outputDir: config.OUTPUT_DIR,
          });
          const runOutputDir = path.join(
            config.OUTPUT_DIR,
            'diagram-runs',
            record.id,
          );
          // Stash the per-run output dir so the preview route can validate paths.
          record.runOutputDir = runOutputDir;
          appendDiagramRunLog(
            record.id,
            'upload',
            `Uploaded ${upload.originalFileName}`,
          );
          startDiagramRun(
            record.id,
            {
              sourceImagePath: upload.imageFilePath,
              outputDir: runOutputDir,
              config,
            },
            runDiagramPipelineFn,
          );
          redirect(res, `/diagram-runs/${record.id}`);
        })
        .catch((err: unknown) => {
          const message = formatUnknownError(err);
          const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
            ? (err as { statusCode: number }).statusCode
            : 400;
          writeHtml(res, statusCode, renderDiagramErrorHtml('Upload Error', message));
        });
      return;
    }

    // ── GET /diagram-runs/:id/overlay ────────────────────────────────────
    const diagramOverlayMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)\/overlay$/);
    if (req.method === 'GET' && diagramOverlayMatch) {
      const record = getDiagramRunRecord(diagramOverlayMatch[1]);
      if (
        !record ||
        !record.result?.overlay_image_path ||
        !record.runOutputDir ||
        !isPathInsideDirectory(record.result.overlay_image_path, record.runOutputDir) ||
        !fs.existsSync(record.result.overlay_image_path)
      ) {
        writeHtml(res, 404, renderDiagramErrorHtml('Overlay Not Found', `No overlay for ${diagramOverlayMatch[1]}`));
        return;
      }
      writePng(res, record.result.overlay_image_path);
      return;
    }

    // ── GET /diagram-runs/:id/crops/:index ───────────────────────────────
    const diagramCropMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)\/crops\/(\d+)$/);
    if (req.method === 'GET' && diagramCropMatch) {
      const record = getDiagramRunRecord(diagramCropMatch[1]);
      const index = Number(diagramCropMatch[2]);
      const diagram = record?.result?.diagrams.find(
        (d) => d.diagram_index === index && d.status === 'ok',
      );
      if (
        !record ||
        !diagram ||
        diagram.status !== 'ok' ||
        !record.runOutputDir ||
        !isPathInsideDirectory(diagram.output_file_path, record.runOutputDir) ||
        !fs.existsSync(diagram.output_file_path)
      ) {
        writeHtml(res, 404, renderDiagramErrorHtml('Crop Not Found', `No diagram crop ${index} for run ${diagramCropMatch[1]}`));
        return;
      }
      writePng(res, diagram.output_file_path);
      return;
    }

    // ── GET /diagram-runs/:id ────────────────────────────────────────────
    const diagramRunMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)$/);
    if (req.method === 'GET' && diagramRunMatch) {
      const record = getDiagramRunRecord(diagramRunMatch[1]);
      if (!record) {
        writeHtml(res, 404, renderDiagramErrorHtml('Run Not Found', `No diagram run for ${diagramRunMatch[1]}`));
        return;
      }
      if (record.status === 'succeeded' && record.result) {
        writeHtml(res, 200, renderDiagramResultsHtml(record));
      } else {
        writeHtml(res, 200, renderDiagramStatusHtml(record));
      }
      return;
    }

    // ── GET /run-hints ────────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === HINT_RUN_PATH) {
      try {
        const loaded = loadConfigForForm(loadConfigFn);
        writeHtml(res, 200, renderHintFormHtml({
          configReady: loaded.config !== undefined,
          missingKeys: loaded.missingKeys,
          maxUploadMb: MAX_HINT_UPLOAD_BYTES / (1024 * 1024),
          blendDefaults: currentBlendDefaults(),
        }));
      } catch (err) {
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderHintErrorHtml('Config Error', message));
      }
      return;
    }

    // ── POST /run-hints ─────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === HINT_RUN_PATH) {
      let config: LocalConfig;
      try {
        config = loadConfigFn();
      } catch (err) {
        req.resume();
        if (err instanceof ConfigMissingError) {
          writeHtml(res, 400, renderHintErrorHtml(
            'Config Missing',
            `Missing config: ${err.missingKeys.join(', ')}`,
          ));
          return;
        }
        const message = formatUnknownError(err);
        writeHtml(res, 500, renderHintErrorHtml('Config Error', message));
        return;
      }

      parseHintUploadFn(req, config.OUTPUT_DIR)
        .then((upload) => {
          // For blend mode, parse the optional schema override up front so we can
          // surface a clean error before kicking off a run.
          let overlaySchemaOverride: Record<string, unknown> | undefined;
          if (upload.method === 'blend' && upload.blendOverlaySchema) {
            try {
              const parsed = JSON.parse(upload.blendOverlaySchema);
              if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Schema must be a JSON object.');
              }
              overlaySchemaOverride = parsed as Record<string, unknown>;
            } catch (err) {
              writeHtml(res, 400, renderHintErrorHtml(
                'Invalid Schema',
                `Blend response schema is not valid JSON: ${formatUnknownError(err)}`,
              ));
              return;
            }
          }

          const runOutputDir = path.join(
            config.OUTPUT_DIR,
            'hint-runs',
            `hint_${Date.now()}`,
          );
          const isBlend = upload.method === 'blend';
          const record = createHintRunRecord({
            imageFileName: upload.originalFileName,
            imageFilePath: upload.imageFilePath,
            hintText: upload.hintText,
            method: upload.method,
            outputDir: config.OUTPUT_DIR,
            runOutputDir,
            blendOverlayPrompt: isBlend ? upload.blendOverlayPrompt : undefined,
            blendOverlaySchema: isBlend ? upload.blendOverlaySchema : undefined,
            blendRenderPrompt: isBlend ? upload.blendRenderPrompt : undefined,
          });
          appendHintRunLog(
            record.id,
            'upload',
            `Uploaded ${upload.originalFileName}`,
          );
          if (upload.hintText) {
            appendHintRunLog(record.id, 'upload', `Hint: ${upload.hintText}`);
          }
          appendHintRunLog(record.id, 'upload', `Method: ${upload.method}`);
          if (isBlend) {
            const applied: string[] = [];
            if (upload.blendOverlayPrompt) applied.push('overlay prompt');
            if (overlaySchemaOverride) applied.push('overlay schema');
            if (upload.blendRenderPrompt) applied.push('render prompt');
            if (applied.length > 0) {
              appendHintRunLog(record.id, 'upload', `Blend overrides applied: ${applied.join(', ')}`);
            }
          }
          if (upload.method === 'all') {
            startHintRunAll(
              record.id,
              {
                sourceImagePath: upload.imageFilePath,
                outputDir: runOutputDir,
                config,
                hintText: upload.hintText,
              },
              runHintPipelineFn,
            );
          } else {
            startHintRun(
              record.id,
              {
                sourceImagePath: upload.imageFilePath,
                outputDir: runOutputDir,
                config,
                method: upload.method,
                hintText: upload.hintText,
                ...(isBlend
                  ? {
                      overlayPromptOverride: upload.blendOverlayPrompt,
                      blendRenderPromptOverride: upload.blendRenderPrompt,
                      overlaySchemaOverride,
                    }
                  : {}),
              },
              runHintPipelineFn,
            );
          }
          redirect(res, `/hint-runs/${record.id}`);
        })
        .catch((err: unknown) => {
          const message = formatUnknownError(err);
          const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
            ? (err as { statusCode: number }).statusCode
            : 400;
          writeHtml(res, statusCode, renderHintErrorHtml('Upload Error', message));
        });
      return;
    }

    // ── GET /hint-runs/:id/result/:method ─────────────────────────────
    const hintMethodResultMatch = url.pathname.match(/^\/hint-runs\/([^/]+)\/result\/(overlay|image-gen|blend)$/);
    if (req.method === 'GET' && hintMethodResultMatch) {
      const record = getHintRunRecord(hintMethodResultMatch[1]);
      const method = hintMethodResultMatch[2];
      const methodResult = record?.allResults?.[method as keyof typeof record.allResults];
      if (
        !record ||
        !methodResult?.annotatedImagePath ||
        !record.runOutputDir ||
        !isPathInsideDirectory(methodResult.annotatedImagePath, record.runOutputDir) ||
        !fs.existsSync(methodResult.annotatedImagePath)
      ) {
        writeHtml(res, 404, renderHintErrorHtml('Result Not Found', `No ${method} result for ${hintMethodResultMatch[1]}`));
        return;
      }
      writePng(res, methodResult.annotatedImagePath);
      return;
    }

    // ── GET /hint-runs/:id/result ───────────────────────────────────────
    const hintResultMatch = url.pathname.match(/^\/hint-runs\/([^/]+)\/result$/);
    if (req.method === 'GET' && hintResultMatch) {
      const record = getHintRunRecord(hintResultMatch[1]);
      if (
        !record ||
        !record.result?.annotatedImagePath ||
        !record.runOutputDir ||
        !isPathInsideDirectory(record.result.annotatedImagePath, record.runOutputDir) ||
        !fs.existsSync(record.result.annotatedImagePath)
      ) {
        writeHtml(res, 404, renderHintErrorHtml('Result Not Found', `No result for ${hintResultMatch[1]}`));
        return;
      }
      writePng(res, record.result.annotatedImagePath);
      return;
    }

    // ── GET /hint-runs/:id/source ───────────────────────────────────────
    const hintSourceMatch = url.pathname.match(/^\/hint-runs\/([^/]+)\/source$/);
    if (req.method === 'GET' && hintSourceMatch) {
      const record = getHintRunRecord(hintSourceMatch[1]);
      if (
        !record ||
        !record.imageFilePath ||
        !fs.existsSync(record.imageFilePath)
      ) {
        writeHtml(res, 404, renderHintErrorHtml('Source Not Found', `No source for ${hintSourceMatch[1]}`));
        return;
      }
      writePng(res, record.imageFilePath);
      return;
    }

    // ── GET /hint-runs/:id ──────────────────────────────────────────────
    const hintRunMatch = url.pathname.match(/^\/hint-runs\/([^/]+)$/);
    if (req.method === 'GET' && hintRunMatch) {
      const record = getHintRunRecord(hintRunMatch[1]);
      if (!record) {
        writeHtml(res, 404, renderHintErrorHtml('Run Not Found', `No hint run for ${hintRunMatch[1]}`));
        return;
      }
      if (record.status === 'succeeded' && record.allResults) {
        writeHtml(res, 200, renderHintAllResultsHtml(record));
      } else if (record.status === 'succeeded' && record.result) {
        writeHtml(res, 200, renderHintResultsHtml(record, currentBlendDefaults()));
      } else {
        writeHtml(res, 200, renderHintStatusHtml(record));
      }
      return;
    }

    // ── POST /hint-runs/:id/retry ───────────────────────────────────────
    // Re-runs a blend hint with edited prompts/schema, reusing the original
    // source PNG. Blend-only.
    const hintRetryMatch = url.pathname.match(/^\/hint-runs\/([^/]+)\/retry$/);
    if (req.method === 'POST' && hintRetryMatch) {
      const original = getHintRunRecord(hintRetryMatch[1]);
      if (!original) {
        req.resume();
        writeHtml(res, 404, renderHintErrorHtml('Run Not Found', `No hint run for ${hintRetryMatch[1]}`));
        return;
      }
      if (original.method !== 'blend') {
        req.resume();
        writeHtml(res, 400, renderHintErrorHtml('Retry Not Supported', 'Retry is only available for blend-mode runs.'));
        return;
      }
      if (!original.imageFilePath || !fs.existsSync(original.imageFilePath)) {
        req.resume();
        writeHtml(res, 400, renderHintErrorHtml('Source Missing', 'Original source image is no longer available on disk.'));
        return;
      }

      let config: LocalConfig;
      try {
        config = loadConfigFn();
      } catch (err) {
        req.resume();
        if (err instanceof ConfigMissingError) {
          writeHtml(res, 400, renderHintErrorHtml('Config Missing', `Missing config: ${err.missingKeys.join(', ')}`));
          return;
        }
        writeHtml(res, 500, renderHintErrorHtml('Config Error', formatUnknownError(err)));
        return;
      }

      readBody(req)
        .then((rawBody) => {
          const params = new URLSearchParams(rawBody);
          const overlayPrompt = params.get('blendOverlayPrompt')?.trim() || undefined;
          const overlaySchemaText = params.get('blendOverlaySchema')?.trim() || undefined;
          const renderPrompt = params.get('blendRenderPrompt')?.trim() || undefined;

          let overlaySchemaOverride: Record<string, unknown> | undefined;
          if (overlaySchemaText) {
            try {
              const parsed = JSON.parse(overlaySchemaText);
              if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Schema must be a JSON object.');
              }
              overlaySchemaOverride = parsed as Record<string, unknown>;
            } catch (err) {
              writeHtml(res, 400, renderHintErrorHtml(
                'Invalid Schema',
                `Blend response schema is not valid JSON: ${formatUnknownError(err)}`,
              ));
              return;
            }
          }

          const runOutputDir = path.join(
            config.OUTPUT_DIR,
            'hint-runs',
            `hint_${Date.now()}`,
          );
          const record = createHintRunRecord({
            imageFileName: original.imageFileName,
            imageFilePath: original.imageFilePath,
            hintText: original.hintText,
            method: 'blend',
            outputDir: config.OUTPUT_DIR,
            runOutputDir,
            blendOverlayPrompt: overlayPrompt,
            blendOverlaySchema: overlaySchemaText,
            blendRenderPrompt: renderPrompt,
          });
          appendHintRunLog(record.id, 'app', `Retry of ${original.id} with edited blend config`);
          if (original.hintText) {
            appendHintRunLog(record.id, 'upload', `Hint: ${original.hintText}`);
          }
          appendHintRunLog(record.id, 'upload', 'Method: blend');
          const applied: string[] = [];
          if (overlayPrompt) applied.push('overlay prompt');
          if (overlaySchemaOverride) applied.push('overlay schema');
          if (renderPrompt) applied.push('render prompt');
          if (applied.length > 0) {
            appendHintRunLog(record.id, 'upload', `Blend overrides applied: ${applied.join(', ')}`);
          }

          startHintRun(
            record.id,
            {
              sourceImagePath: original.imageFilePath!,
              outputDir: runOutputDir,
              config,
              method: 'blend',
              hintText: original.hintText,
              overlayPromptOverride: overlayPrompt,
              blendRenderPromptOverride: renderPrompt,
              overlaySchemaOverride,
            },
            runHintPipelineFn,
          );

          redirect(res, `/hint-runs/${record.id}`);
        })
        .catch((err: unknown) => {
          writeHtml(res, 500, renderHintErrorHtml('Retry Error', formatUnknownError(err)));
        });
      return;
    }

    // ── 404 for anything else ─────────────────────────────────────────────
    const msg = [
      `Not found. Available routes:`,
      `  http://localhost:${PREVIEW_PORT}${RUN_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${DIAGRAM_RUN_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${HINT_RUN_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`,
      '',
    ].join('\n');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(msg);
  });
}

export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH, PROMPT_EDIT_PATH, RUN_PATH, DIAGRAM_RUN_PATH, HINT_RUN_PATH };

if (require.main === module) {
  const server = createPreviewServer();
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PREVIEW_PORT} is already in use.`);
      console.error(`An app server is probably already running at http://localhost:${PREVIEW_PORT}${RUN_PATH}`);
      console.error(`Stop the old server with Ctrl+C in its terminal, or run:`);
      console.error(`  lsof -nP -iTCP:${PREVIEW_PORT} -sTCP:LISTEN`);
      console.error(`  kill <PID>`);
      console.error(`Or start this app on another port:`);
      console.error(`  PREVIEW_PORT=3003 npm run app`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(PREVIEW_PORT, '127.0.0.1', () => {
    console.log('Preview server running.');
    console.log(`Run UI:      http://localhost:${PREVIEW_PORT}${RUN_PATH}`);
    console.log(`Summary UI:  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`);
    console.log(`Prompt edit: http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`);
    console.log('Press Ctrl+C to stop.');
  });
}
