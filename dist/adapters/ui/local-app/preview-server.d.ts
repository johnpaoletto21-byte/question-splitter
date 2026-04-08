/**
 * adapters/ui/local-app/preview-server.ts
 *
 * Minimal local HTTP server for browser-based validation of the summary UI.
 *
 * TASK-501 close pass: resolves the prior data: URL blocker by serving the
 * summary renderer output at an allowed localhost path.
 *
 * Run:
 *   npm run preview
 *
 * Then open in a browser:
 *   http://localhost:3001/summary-preview
 *
 * The page renders PREVIEW_FIXTURE (mixed ok/failed state) via renderSummaryHtml.
 * All data-testid selectors from the TASK-501 selector plan are present.
 *
 * Boundary: uses only Node built-in http module and existing local-app modules.
 * No new runtime dependencies added.
 *
 * The server only starts when this file is the Node entry point
 * (require.main === module guard), so importing this module in tests is safe.
 */
import * as http from 'http';
declare const PREVIEW_PORT: number;
declare const PREVIEW_PATH = "/summary-preview";
declare function createPreviewServer(): http.Server;
export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH };
//# sourceMappingURL=preview-server.d.ts.map