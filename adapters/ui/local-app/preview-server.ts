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
import { renderSummaryHtml } from './summary-renderer';
import { PREVIEW_FIXTURE } from './preview-fixture';

const PREVIEW_PORT = process.env['PREVIEW_PORT']
  ? parseInt(process.env['PREVIEW_PORT'], 10)
  : 3001;
const PREVIEW_PATH = '/summary-preview';

function createPreviewServer(): http.Server {
  return http.createServer((req, res) => {
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

    const msg = `Not found. Open: http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}\n`;
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(msg);
  });
}

export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH };

if (require.main === module) {
  const server = createPreviewServer();
  server.listen(PREVIEW_PORT, '127.0.0.1', () => {
    console.log('Summary preview server running.');
    console.log(`Open: http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`);
    console.log('Press Ctrl+C to stop.');
  });
}
