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
 *   http://localhost:3001/summary-preview   — run summary UI
 *   http://localhost:3001/prompt-edit       — prompt editor UI
 *
 * Boundary: uses only Node built-in http module and existing local-app/core modules.
 * No new runtime dependencies added.
 *
 * The server only starts when this file is the Node entry point
 * (require.main === module guard), so importing this module in tests is safe.
 */

import * as http from 'http';
import { renderSummaryHtml } from './summary-renderer';
import { PREVIEW_FIXTURE } from './preview-fixture';
import { renderPromptEditorHtml } from './prompt-editor';
import {
  getPromptConfig,
  setAgent1Prompt,
  setAgent2Prompt,
} from '../../../core/prompt-config-store/store';

const PREVIEW_PORT = process.env['PREVIEW_PORT']
  ? parseInt(process.env['PREVIEW_PORT'], 10)
  : 3001;
const PREVIEW_PATH = '/summary-preview';
const PROMPT_EDIT_PATH = '/prompt-edit';

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

function createPreviewServer(): http.Server {
  return http.createServer((req, res) => {
    // ── GET /summary-preview ─────────────────────────────────────────────
    if (req.method === 'GET' && req.url === PREVIEW_PATH) {
      const html = renderSummaryHtml(PREVIEW_FIXTURE);
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
      const html = renderPromptEditorHtml(getPromptConfig());
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
      `  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`,
      `  http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`,
      '',
    ].join('\n');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(msg);
  });
}

export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH, PROMPT_EDIT_PATH };

if (require.main === module) {
  const server = createPreviewServer();
  server.listen(PREVIEW_PORT, '127.0.0.1', () => {
    console.log('Preview server running.');
    console.log(`Summary UI:  http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`);
    console.log(`Prompt edit: http://localhost:${PREVIEW_PORT}${PROMPT_EDIT_PATH}`);
    console.log('Press Ctrl+C to stop.');
  });
}
