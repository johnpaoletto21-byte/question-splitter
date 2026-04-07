/**
 * core/source-model — normalized shapes for PDF sources and prepared page images.
 *
 * Rule (INV-1): every PDF page is rendered into a PreparedPageImage before
 * segmentation or localization starts.  These types are the stable contracts
 * that downstream core modules consume.
 *
 * No provider SDK types appear here (supports INV-9 / PO-8).
 */
/**
 * Identifies one input PDF file as a source in a run.
 * `source_id` is stable across the run and used for traceability.
 */
export interface PdfSource {
    /** Stable, run-scoped identifier derived from the input order index and file name. */
    source_id: string;
    /** Absolute path to the input PDF file on disk. */
    file_path: string;
    /** Original file name (basename) — used for display and traceability. */
    file_name: string;
    /**
     * Zero-based position of this PDF in the run's input list.
     * Preserves the caller's original file order.
     */
    input_order: number;
}
/**
 * Metadata for a single rendered page image — the prepared visual unit
 * that all downstream steps (segmentation, localization, crop) consume.
 *
 * Produced by `adapters/source-preparation/pdf-renderer` (TASK-102).
 * Fields mirror Boundary A's output contract.
 */
export interface PreparedPageImage {
    /** Stable, run-scoped identifier — ties back to the originating PdfSource. */
    source_id: string;
    /** 1-based page number within the originating PDF. */
    page_number: number;
    /** Absolute path to the rendered page image file on disk. */
    image_path: string;
    /** Width of the rendered image in pixels. */
    image_width: number;
    /** Height of the rendered image in pixels. */
    image_height: number;
    /** Optional: originating PDF file name for display / logging. */
    file_name?: string;
    /** Optional: originating PDF file path for traceability. */
    pdf_path?: string;
}
/**
 * Validation error thrown when a PreparedPageImage value violates a structural rule.
 * This is a domain-layer error — no provider types involved.
 */
export declare class PreparedPageValidationError extends Error {
    readonly code: "PREPARED_PAGE_INVALID";
    constructor(reason: string, context?: Record<string, unknown>);
}
//# sourceMappingURL=types.d.ts.map