"use strict";
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
exports.PREVIEW_PATH = exports.PREVIEW_PORT = void 0;
exports.createPreviewServer = createPreviewServer;
const http = __importStar(require("http"));
const summary_renderer_1 = require("./summary-renderer");
const preview_fixture_1 = require("./preview-fixture");
const PREVIEW_PORT = process.env['PREVIEW_PORT']
    ? parseInt(process.env['PREVIEW_PORT'], 10)
    : 3001;
exports.PREVIEW_PORT = PREVIEW_PORT;
const PREVIEW_PATH = '/summary-preview';
exports.PREVIEW_PATH = PREVIEW_PATH;
function createPreviewServer() {
    return http.createServer((req, res) => {
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
        const msg = `Not found. Open: http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}\n`;
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(msg);
    });
}
if (require.main === module) {
    const server = createPreviewServer();
    server.listen(PREVIEW_PORT, '127.0.0.1', () => {
        console.log('Summary preview server running.');
        console.log(`Open: http://localhost:${PREVIEW_PORT}${PREVIEW_PATH}`);
        console.log('Press Ctrl+C to stop.');
    });
}
//# sourceMappingURL=preview-server.js.map