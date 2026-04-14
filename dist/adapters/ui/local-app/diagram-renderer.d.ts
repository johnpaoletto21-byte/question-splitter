/**
 * adapters/ui/local-app/diagram-renderer.ts
 *
 * HTML rendering for the diagram-only cropper UI.
 *
 * Three views (mirrors run-renderer.ts):
 *   - renderDiagramFormHtml      → upload form on GET /run-diagrams
 *   - renderDiagramStatusHtml    → running / failed status on GET /diagram-runs/:id
 *   - renderDiagramResultsHtml   → sanity overlay + crop grid when complete
 */
import type { LocalDiagramRunRecord } from './run-state';
export declare function renderDiagramFormHtml(input: {
    configReady: boolean;
    missingKeys?: ReadonlyArray<string>;
    maxUploadMb: number;
}): string;
export declare function renderDiagramStatusHtml(record: LocalDiagramRunRecord): string;
export declare function renderDiagramResultsHtml(record: LocalDiagramRunRecord): string;
export declare function renderDiagramErrorHtml(title: string, message: string): string;
//# sourceMappingURL=diagram-renderer.d.ts.map