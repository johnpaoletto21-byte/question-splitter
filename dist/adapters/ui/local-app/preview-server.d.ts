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
import * as http from 'http';
declare const PREVIEW_PORT: number;
declare const PREVIEW_PATH = "/summary-preview";
declare const PROMPT_EDIT_PATH = "/prompt-edit";
declare function createPreviewServer(): http.Server;
export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH, PROMPT_EDIT_PATH };
//# sourceMappingURL=preview-server.d.ts.map