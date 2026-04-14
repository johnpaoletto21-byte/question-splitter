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
import { parsePdfUpload } from './upload-handler';
import { parseDiagramUpload } from './diagram-upload-handler';
import { loadConfig } from '../../config/local-config/loader';
import type { RunFullPipelineInput, RunDiagramPipelineInput } from '../../run-pipeline';
import type { DiagramRunResult } from '../../../core/diagram-detection/types';
declare const PREVIEW_PORT: number;
declare const PREVIEW_PATH = "/summary-preview";
declare const PROMPT_EDIT_PATH = "/prompt-edit";
declare const RUN_PATH = "/run";
declare const DIAGRAM_RUN_PATH = "/run-diagrams";
interface PreviewServerOptions {
    loadConfigFn?: typeof loadConfig;
    parsePdfUploadFn?: typeof parsePdfUpload;
    runFullPipelineFn?: (input: RunFullPipelineInput) => Promise<import('../../../core/run-summary/types').RunSummaryState>;
    parseDiagramUploadFn?: typeof parseDiagramUpload;
    runDiagramPipelineFn?: (input: RunDiagramPipelineInput) => Promise<DiagramRunResult>;
}
declare function createPreviewServer(options?: PreviewServerOptions): http.Server;
export { createPreviewServer, PREVIEW_PORT, PREVIEW_PATH, PROMPT_EDIT_PATH, RUN_PATH, DIAGRAM_RUN_PATH };
//# sourceMappingURL=preview-server.d.ts.map