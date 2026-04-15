/**
 * adapters/ui/local-app/hint-renderer.ts
 *
 * HTML rendering for the hint annotator UI.
 *
 * Three views:
 *   - renderHintFormHtml      → upload form on GET /run-hints
 *   - renderHintStatusHtml    → running / failed status on GET /hint-runs/:id
 *   - renderHintResultsHtml   → source + annotated image when complete
 */
import type { LocalHintRunRecord } from './run-state';
export declare function renderHintFormHtml(input: {
    configReady: boolean;
    missingKeys?: ReadonlyArray<string>;
    maxUploadMb: number;
}): string;
export declare function renderHintStatusHtml(record: LocalHintRunRecord): string;
export declare function renderHintResultsHtml(record: LocalHintRunRecord): string;
export declare function renderHintAllResultsHtml(record: LocalHintRunRecord): string;
export declare function renderHintErrorHtml(title: string, message: string): string;
//# sourceMappingURL=hint-renderer.d.ts.map