import type { PdfSource } from '../../../core/source-model/types';
/**
 * Input to the PDF renderer: one source + the directory where rendered
 * page images should be written.
 */
export interface RenderRequest {
    /** The PDF source to render. */
    source: PdfSource;
    /**
     * Absolute path to the directory where rendered PNG files will be written.
     * The directory must already exist.
     */
    outputDir: string;
}
/**
 * Error thrown when a single-source PDF render fails.
 * `source_id` is always present; `page_number` is set when a specific
 * page caused the failure.
 */
export declare class PdfRenderError extends Error {
    readonly source_id: string;
    readonly page_number?: number | undefined;
    readonly code: "PDF_RENDER_FAILED";
    constructor(reason: string, source_id: string, page_number?: number | undefined);
}
//# sourceMappingURL=types.d.ts.map