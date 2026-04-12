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
} from './run-state';
import { parsePdfUpload, MAX_UPLOAD_BYTES } from './upload-handler';
import {
  getPromptConfig,
  capturePromptSnapshot,
  setAgent1Prompt,
  setAgent2Prompt,
} from '../../../core/prompt-config-store/store';
import { loadConfig } from '../../config/local-config/loader';
import { ConfigMissingError, LocalConfig } from '../../config/local-config/types';
import { runFullPipeline } from '../../run-pipeline';
import type { RunFullPipelineInput } from '../../run-pipeline';
import type { RunSummaryState } from '../../../core/run-summary/types';

const PREVIEW_PORT = process.env['PREVIEW_PORT']
  ? parseInt(process.env['PREVIEW_PORT'], 10)
  : 3002;
const PREVIEW_PATH = '/summary-preview';
const PROMPT_EDIT_PATH = '/prompt-edit';
const RUN_PATH = '/run';

interface PreviewServerOptions {
  loadConfigFn?: typeof loadConfig;
  parsePdfUploadFn?: typeof parsePdfUpload;
  runFullPipelineFn?: (input: RunFullPipelineInput) => Promise<import('../../../core/run-summary/types').RunSummaryState>;
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

function createPreviewServer(options: PreviewServerOptions = {}): http.Server {
  const loadConfigFn = options.loadConfigFn ?? loadConfig;
  const parsePdfUploadFn = options.parsePdfUploadFn ?? parsePdfUpload;
  const runFullPipelineFn = options.runFullPipelineFn ?? runFullPipeline;

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
        const agent2 = params.get('agent2Prompt') ?? '';
        setAgent1Prompt(agent1);
        setAgent2Prompt(agent2);
        // Redirect back to GET to show the saved state (POST-Redirect-GET pattern).
        res.writeHead(302, { Location: PROMPT_EDIT_PATH });
        res.end();
      }).catch(() => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error reading form body.\n');
      });
      return;
    }

    // ── 404 for anything else ─────────────────────────────────────────────
    const msg = [
      `Not found. Available routes:`,
      `  http://localhost:${PREVIEW_PORT}${RUN_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`,
      '',
    ].join('\n');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(msg);
  });
}

export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH, PROMPT_EDIT_PATH, RUN_PATH };

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
