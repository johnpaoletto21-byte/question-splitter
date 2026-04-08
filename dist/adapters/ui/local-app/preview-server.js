"use strict";
/**
 * adapters/ui/local-app/preview-server.ts
 *
 * Minimal local HTTP server for browser-based validation of the summary UI
 * and the session-only prompt editing UI.
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
exports.PROMPT_EDIT_PATH = exports.PREVIEW_PATH = exports.PREVIEW_PORT = void 0;
exports.createPreviewServer = createPreviewServer;
const http = __importStar(require("http"));
const summary_renderer_1 = require("./summary-renderer");
const preview_fixture_1 = require("./preview-fixture");
const prompt_editor_1 = require("./prompt-editor");
const store_1 = require("../../../core/prompt-config-store/store");
const PREVIEW_PORT = process.env['PREVIEW_PORT']
    ? parseInt(process.env['PREVIEW_PORT'], 10)
    : 3002;
exports.PREVIEW_PORT = PREVIEW_PORT;
const PREVIEW_PATH = '/summary-preview';
exports.PREVIEW_PATH = PREVIEW_PATH;
const PROMPT_EDIT_PATH = '/prompt-edit';
exports.PROMPT_EDIT_PATH = PROMPT_EDIT_PATH;
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
function createPreviewServer() {
    return http.createServer((req, res) => {
        // ── GET /summary-preview ─────────────────────────────────────────────
        if (req.method === 'GET' && req.url === PREVIEW_PATH) {
            const html = (0, summary_renderer_1.renderSummaryHtml)(preview_fixture_1.PREVIEW_FIXTURE);
            const body = Buffer.from(html, 'utf-8');
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': body.length,
            });
            res.end(body);
            return;
        }
        // ── GET /prompt-edit ─────────────────────────────────────────────────
        if (req.method === 'GET' && req.url === PROMPT_EDIT_PATH) {
            const html = (0, prompt_editor_1.renderPromptEditorHtml)((0, store_1.getPromptConfig)());
            const body = Buffer.from(html, 'utf-8');
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': body.length,
            });
            res.end(body);
            return;
        }
        // ── POST /prompt-edit ─────────────────────────────────────────────────
        if (req.method === 'POST' && req.url === PROMPT_EDIT_PATH) {
            readBody(req).then((rawBody) => {
                const params = new URLSearchParams(rawBody);
                const agent1 = params.get('agent1Prompt') ?? '';
                const agent2 = params.get('agent2Prompt') ?? '';
                (0, store_1.setAgent1Prompt)(agent1);
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
        // ── 404 for anything else ─────────────────────────────────────────────
        const msg = [
            `Not found. Available routes:`,
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
    server.listen(PREVIEW_PORT, '127.0.0.1', () => {
        console.log('Preview server running.');
        console.log(`Summary UI:  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`);
        console.log(`Prompt edit: http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`);
        console.log('Press Ctrl+C to stop.');
    });
}
//# sourceMappingURL=preview-server.js.map