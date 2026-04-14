"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAGRAM_RUN_PATH = exports.RUN_PATH = exports.PROMPT_EDIT_PATH = exports.PREVIEW_PATH = exports.PREVIEW_PORT = void 0;
exports.createPreviewServer = createPreviewServer;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const summary_renderer_1 = require("./summary-renderer");
const preview_fixture_1 = require("./preview-fixture");
const prompt_editor_1 = require("./prompt-editor");
const run_renderer_1 = require("./run-renderer");
const debug_package_1 = require("./debug-package");
const run_state_1 = require("./run-state");
const upload_handler_1 = require("./upload-handler");
const diagram_upload_handler_1 = require("./diagram-upload-handler");
const diagram_renderer_1 = require("./diagram-renderer");
const store_1 = require("../../../core/prompt-config-store/store");
const loader_1 = require("../../config/local-config/loader");
const types_1 = require("../../config/local-config/types");
const run_pipeline_1 = require("../../run-pipeline");
const PREVIEW_PORT = process.env['PREVIEW_PORT']
    ? parseInt(process.env['PREVIEW_PORT'], 10)
    : 3002;
exports.PREVIEW_PORT = PREVIEW_PORT;
const PREVIEW_PATH = '/summary-preview';
exports.PREVIEW_PATH = PREVIEW_PATH;
const PROMPT_EDIT_PATH = '/prompt-edit';
exports.PROMPT_EDIT_PATH = PROMPT_EDIT_PATH;
const RUN_PATH = '/run';
exports.RUN_PATH = RUN_PATH;
const DIAGRAM_RUN_PATH = '/run-diagrams';
exports.DIAGRAM_RUN_PATH = DIAGRAM_RUN_PATH;
/**
 * Reads a URL-encoded POST body from an IncomingMessage and returns the raw string.
 * Resolves when the 'end' event fires; rejects on 'error'.
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
function writeHtml(res, statusCode, html) {
    const body = Buffer.from(html, 'utf-8');
    res.writeHead(statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': body.length,
    });
    res.end(body);
}
function writeMarkdown(res, filename, markdown) {
    const body = Buffer.from(markdown, 'utf-8');
    res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': body.length,
    });
    res.end(body);
}
function writePng(res, filePath) {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': body.length,
    });
    res.end(body);
}
function redirect(res, location) {
    res.writeHead(303, { Location: location });
    res.end();
}
function formatUnknownError(err) {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err, null, 2);
    }
    catch {
        return String(err);
    }
}
function extractFailureContext(err) {
    if (typeof err !== 'object' || err === null) {
        return undefined;
    }
    const record = err;
    return record['segmentationWindow'] !== undefined
        ? { segmentationWindow: record['segmentationWindow'] }
        : undefined;
}
function tryLoadConfigForDebug(loadConfigFn) {
    try {
        return { config: loadConfigFn() };
    }
    catch (err) {
        return { configError: formatUnknownError(err) };
    }
}
function addDebugLinkToSummaryHtml(html, runId) {
    const link = [
        '<body>',
        `  <div class="nav"><a href="/runs/${runId}/debug.md" data-testid="summary-debug-download-link" download>Download Debug Package (.md)</a></div>`,
    ].join('\n');
    return html.replace('<body>', link);
}
function withPreviewUrls(summary, localRunId, outputDir) {
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
function isPathInsideDirectory(filePath, directory) {
    const resolvedFile = path.resolve(filePath);
    const resolvedDirectory = path.resolve(directory);
    return resolvedFile === resolvedDirectory ||
        resolvedFile.startsWith(`${resolvedDirectory}${path.sep}`);
}
function loadConfigForForm(loadConfigFn) {
    try {
        return { config: loadConfigFn() };
    }
    catch (err) {
        if (err instanceof types_1.ConfigMissingError) {
            return { missingKeys: err.missingKeys };
        }
        throw err;
    }
}
function startRun(recordId, input, runFullPipelineFn) {
    (0, run_state_1.markRunStatus)(recordId, 'running');
    (0, run_state_1.appendRunLog)(recordId, 'app', 'Run queued from browser upload');
    void runFullPipelineFn(input)
        .then((summary) => {
        (0, run_state_1.appendRunLog)(recordId, 'app', 'Run completed');
        (0, run_state_1.markRunSucceeded)(recordId, summary);
    })
        .catch((err) => {
        const message = formatUnknownError(err);
        (0, run_state_1.appendRunLog)(recordId, 'app', `Run failed: ${message}`);
        (0, run_state_1.markRunFailed)(recordId, message, extractFailureContext(err));
    });
}
function startDiagramRun(recordId, input, runDiagramPipelineFn) {
    (0, run_state_1.markDiagramRunStatus)(recordId, 'running');
    (0, run_state_1.appendDiagramRunLog)(recordId, 'app', 'Diagram run queued from browser upload');
    // Inject onLog so log events flow into the run record.
    const wrappedInput = {
        ...input,
        onLog: (event) => (0, run_state_1.appendDiagramRunLog)(recordId, event.stage, event.message, event.timestamp),
    };
    void runDiagramPipelineFn(wrappedInput)
        .then((result) => {
        (0, run_state_1.appendDiagramRunLog)(recordId, 'app', 'Diagram run completed');
        (0, run_state_1.markDiagramRunSucceeded)(recordId, result);
    })
        .catch((err) => {
        const message = formatUnknownError(err);
        (0, run_state_1.appendDiagramRunLog)(recordId, 'app', `Diagram run failed: ${message}`);
        (0, run_state_1.markDiagramRunFailed)(recordId, message);
    });
}
function createPreviewServer(options = {}) {
    const loadConfigFn = options.loadConfigFn ?? loader_1.loadConfig;
    const parsePdfUploadFn = options.parsePdfUploadFn ?? upload_handler_1.parsePdfUpload;
    const runFullPipelineFn = options.runFullPipelineFn ?? run_pipeline_1.runFullPipeline;
    const parseDiagramUploadFn = options.parseDiagramUploadFn ?? diagram_upload_handler_1.parseDiagramUpload;
    const runDiagramPipelineFn = options.runDiagramPipelineFn ?? run_pipeline_1.runDiagramPipeline;
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
                writeHtml(res, 200, (0, run_renderer_1.renderRunFormHtml)({
                    configReady: loaded.config !== undefined,
                    missingKeys: loaded.missingKeys,
                    maxUploadMb: upload_handler_1.MAX_UPLOAD_BYTES / (1024 * 1024),
                }));
            }
            catch (err) {
                const message = formatUnknownError(err);
                writeHtml(res, 500, (0, run_renderer_1.renderRunErrorHtml)('Config Error', message));
            }
            return;
        }
        // ── POST /run ────────────────────────────────────────────────────────
        if (req.method === 'POST' && url.pathname === RUN_PATH) {
            let config;
            try {
                config = loadConfigFn();
            }
            catch (err) {
                req.resume();
                if (err instanceof types_1.ConfigMissingError) {
                    writeHtml(res, 400, (0, run_renderer_1.renderRunErrorHtml)('Config Missing', `Missing config: ${err.missingKeys.join(', ')}`));
                    return;
                }
                const message = formatUnknownError(err);
                writeHtml(res, 500, (0, run_renderer_1.renderRunErrorHtml)('Config Error', message));
                return;
            }
            parsePdfUploadFn(req, config.OUTPUT_DIR)
                .then((upload) => {
                const promptSnapshot = (0, store_1.capturePromptSnapshot)();
                const record = (0, run_state_1.createRunRecord)({
                    runLabel: upload.runLabel,
                    pdfFileName: upload.originalFileName,
                    pdfFilePath: upload.pdfFilePath,
                    outputDir: config.OUTPUT_DIR,
                    extractionFields: upload.extractionFields,
                    promptSnapshot,
                });
                (0, run_state_1.appendRunLog)(record.id, 'upload', `Uploaded ${upload.originalFileName}`);
                if (upload.extractionFields.length > 0) {
                    (0, run_state_1.appendRunLog)(record.id, 'upload', `Configured extraction fields: ${upload.extractionFields.map((f) => f.key).join(', ')}`);
                }
                startRun(record.id, {
                    pdfFilePaths: [upload.pdfFilePath],
                    runLabel: upload.runLabel,
                    config,
                    extractionFields: upload.extractionFields,
                    promptSnapshot,
                    onLog: (event) => (0, run_state_1.appendRunLog)(record.id, event.stage, event.message, event.timestamp),
                }, runFullPipelineFn);
                redirect(res, `/runs/${record.id}`);
            })
                .catch((err) => {
                const message = formatUnknownError(err);
                const statusCode = typeof err.statusCode === 'number'
                    ? err.statusCode
                    : 400;
                writeHtml(res, statusCode, (0, run_renderer_1.renderRunErrorHtml)('Upload Error', message));
            });
            return;
        }
        // ── GET /runs/:runId/preview/:targetId ──────────────────────────────
        const previewMatch = url.pathname.match(/^\/runs\/([^/]+)\/preview\/([^/]+)$/);
        if (req.method === 'GET' && previewMatch) {
            const record = (0, run_state_1.getRunRecord)(previewMatch[1]);
            const targetId = decodeURIComponent(previewMatch[2]);
            const target = record?.summary?.targets.find((entry) => entry.target_id === targetId);
            if (!record ||
                !target?.local_output_path ||
                !record.outputDir ||
                !isPathInsideDirectory(target.local_output_path, record.outputDir) ||
                !fs.existsSync(target.local_output_path)) {
                writeHtml(res, 404, (0, run_renderer_1.renderRunErrorHtml)('Preview Not Found', `No preview found for ${targetId}`));
                return;
            }
            writePng(res, target.local_output_path);
            return;
        }
        // ── GET /runs/:runId/source-pdf ──────────────────────────────────────
        const sourcePdfMatch = url.pathname.match(/^\/runs\/([^/]+)\/source-pdf$/);
        if (req.method === 'GET' && sourcePdfMatch) {
            const record = (0, run_state_1.getRunRecord)(sourcePdfMatch[1]);
            if (!record ||
                !record.pdfFilePath ||
                !record.outputDir ||
                !isPathInsideDirectory(record.pdfFilePath, path.join(record.outputDir, 'uploads')) ||
                !fs.existsSync(record.pdfFilePath)) {
                writeHtml(res, 404, (0, run_renderer_1.renderRunErrorHtml)('PDF Not Found', 'Source PDF not available for this run.'));
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
            const record = (0, run_state_1.getRunRecord)(runMatch[1]);
            if (!record) {
                writeHtml(res, 404, (0, run_renderer_1.renderRunErrorHtml)('Run Not Found', `No run found for ${runMatch[1]}`));
                return;
            }
            if (runMatch[2] === 'debug.md') {
                const loaded = tryLoadConfigForDebug(loadConfigFn);
                writeMarkdown(res, `${record.id}-debug.md`, (0, debug_package_1.renderRunDebugMarkdown)({
                    record,
                    config: loaded.config,
                    configError: loaded.configError,
                }));
                return;
            }
            if (runMatch[2] === 'summary') {
                if (!record.summary) {
                    writeHtml(res, 200, (0, run_renderer_1.renderRunStatusHtml)(record));
                    return;
                }
                const sourcePdfUrl = record.pdfFilePath ? `/runs/${record.id}/source-pdf` : undefined;
                writeHtml(res, 200, addDebugLinkToSummaryHtml((0, summary_renderer_1.renderSummaryHtml)(withPreviewUrls(record.summary, record.id, record.outputDir), { sourcePdfUrl }), record.id));
                return;
            }
            writeHtml(res, 200, (0, run_renderer_1.renderRunStatusHtml)(record));
            return;
        }
        // ── GET /summary-preview ─────────────────────────────────────────────
        if (req.method === 'GET' && url.pathname === PREVIEW_PATH) {
            writeHtml(res, 200, (0, summary_renderer_1.renderSummaryHtml)(preview_fixture_1.PREVIEW_FIXTURE));
            return;
        }
        // ── GET /prompt-edit ─────────────────────────────────────────────────
        if (req.method === 'GET' && url.pathname === PROMPT_EDIT_PATH) {
            writeHtml(res, 200, (0, prompt_editor_1.renderPromptEditorHtml)((0, store_1.getPromptConfig)()));
            return;
        }
        // ── POST /prompt-edit ─────────────────────────────────────────────────
        if (req.method === 'POST' && url.pathname === PROMPT_EDIT_PATH) {
            readBody(req).then((rawBody) => {
                const params = new URLSearchParams(rawBody);
                const agent1 = params.get('agent1Prompt') ?? '';
                const reviewer = params.get('reviewerPrompt') ?? '';
                const agent2 = params.get('agent2Prompt') ?? '';
                (0, store_1.setAgent1Prompt)(agent1);
                (0, store_1.setReviewerPrompt)(reviewer);
                (0, store_1.setAgent2Prompt)(agent2);
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
                writeHtml(res, 200, (0, diagram_renderer_1.renderDiagramFormHtml)({
                    configReady: loaded.config !== undefined,
                    missingKeys: loaded.missingKeys,
                    maxUploadMb: diagram_upload_handler_1.MAX_DIAGRAM_UPLOAD_BYTES / (1024 * 1024),
                }));
            }
            catch (err) {
                const message = formatUnknownError(err);
                writeHtml(res, 500, (0, diagram_renderer_1.renderDiagramErrorHtml)('Config Error', message));
            }
            return;
        }
        // ── POST /run-diagrams ───────────────────────────────────────────────
        if (req.method === 'POST' && url.pathname === DIAGRAM_RUN_PATH) {
            let config;
            try {
                config = loadConfigFn();
            }
            catch (err) {
                req.resume();
                if (err instanceof types_1.ConfigMissingError) {
                    writeHtml(res, 400, (0, diagram_renderer_1.renderDiagramErrorHtml)('Config Missing', `Missing config: ${err.missingKeys.join(', ')}`));
                    return;
                }
                const message = formatUnknownError(err);
                writeHtml(res, 500, (0, diagram_renderer_1.renderDiagramErrorHtml)('Config Error', message));
                return;
            }
            parseDiagramUploadFn(req, config.OUTPUT_DIR)
                .then((upload) => {
                const record = (0, run_state_1.createDiagramRunRecord)({
                    imageFileName: upload.originalFileName,
                    imageFilePath: upload.imageFilePath,
                    outputDir: config.OUTPUT_DIR,
                });
                const runOutputDir = path.join(config.OUTPUT_DIR, 'diagram-runs', record.id);
                // Stash the per-run output dir so the preview route can validate paths.
                record.runOutputDir = runOutputDir;
                (0, run_state_1.appendDiagramRunLog)(record.id, 'upload', `Uploaded ${upload.originalFileName}`);
                startDiagramRun(record.id, {
                    sourceImagePath: upload.imageFilePath,
                    outputDir: runOutputDir,
                    config,
                }, runDiagramPipelineFn);
                redirect(res, `/diagram-runs/${record.id}`);
            })
                .catch((err) => {
                const message = formatUnknownError(err);
                const statusCode = typeof err.statusCode === 'number'
                    ? err.statusCode
                    : 400;
                writeHtml(res, statusCode, (0, diagram_renderer_1.renderDiagramErrorHtml)('Upload Error', message));
            });
            return;
        }
        // ── GET /diagram-runs/:id/overlay ────────────────────────────────────
        const diagramOverlayMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)\/overlay$/);
        if (req.method === 'GET' && diagramOverlayMatch) {
            const record = (0, run_state_1.getDiagramRunRecord)(diagramOverlayMatch[1]);
            if (!record ||
                !record.result?.overlay_image_path ||
                !record.runOutputDir ||
                !isPathInsideDirectory(record.result.overlay_image_path, record.runOutputDir) ||
                !fs.existsSync(record.result.overlay_image_path)) {
                writeHtml(res, 404, (0, diagram_renderer_1.renderDiagramErrorHtml)('Overlay Not Found', `No overlay for ${diagramOverlayMatch[1]}`));
                return;
            }
            writePng(res, record.result.overlay_image_path);
            return;
        }
        // ── GET /diagram-runs/:id/crops/:index ───────────────────────────────
        const diagramCropMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)\/crops\/(\d+)$/);
        if (req.method === 'GET' && diagramCropMatch) {
            const record = (0, run_state_1.getDiagramRunRecord)(diagramCropMatch[1]);
            const index = Number(diagramCropMatch[2]);
            const diagram = record?.result?.diagrams.find((d) => d.diagram_index === index && d.status === 'ok');
            if (!record ||
                !diagram ||
                diagram.status !== 'ok' ||
                !record.runOutputDir ||
                !isPathInsideDirectory(diagram.output_file_path, record.runOutputDir) ||
                !fs.existsSync(diagram.output_file_path)) {
                writeHtml(res, 404, (0, diagram_renderer_1.renderDiagramErrorHtml)('Crop Not Found', `No diagram crop ${index} for run ${diagramCropMatch[1]}`));
                return;
            }
            writePng(res, diagram.output_file_path);
            return;
        }
        // ── GET /diagram-runs/:id ────────────────────────────────────────────
        const diagramRunMatch = url.pathname.match(/^\/diagram-runs\/([^/]+)$/);
        if (req.method === 'GET' && diagramRunMatch) {
            const record = (0, run_state_1.getDiagramRunRecord)(diagramRunMatch[1]);
            if (!record) {
                writeHtml(res, 404, (0, diagram_renderer_1.renderDiagramErrorHtml)('Run Not Found', `No diagram run for ${diagramRunMatch[1]}`));
                return;
            }
            if (record.status === 'succeeded' && record.result) {
                writeHtml(res, 200, (0, diagram_renderer_1.renderDiagramResultsHtml)(record));
            }
            else {
                writeHtml(res, 200, (0, diagram_renderer_1.renderDiagramStatusHtml)(record));
            }
            return;
        }
        // ── 404 for anything else ─────────────────────────────────────────────
        const msg = [
            `Not found. Available routes:`,
            `  http://localhost:${PREVIEW_PORT}${RUN_PATH}`,
            `  http://localhost:${PREVIEW_PORT}${DIAGRAM_RUN_PATH}`,
            `  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`,
            `  http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`,
            '',
        ].join('\n');
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(msg);
    });
}
if (require.main === module) {
    const server = createPreviewServer();
    server.on('error', (err) => {
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
//# sourceMappingURL=preview-server.js.map