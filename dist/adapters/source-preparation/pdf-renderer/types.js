"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfRenderError = void 0;
/**
 * Error thrown when a single-source PDF render fails.
 * `source_id` is always present; `page_number` is set when a specific
 * page caused the failure.
 */
class PdfRenderError extends Error {
    constructor(reason, source_id, page_number) {
        const loc = page_number !== undefined ? ` page=${page_number}` : '';
        super(`PDF_RENDER_FAILED: ${reason} [source_id=${source_id}${loc}]`);
        this.source_id = source_id;
        this.page_number = page_number;
        this.code = 'PDF_RENDER_FAILED';
        this.name = 'PdfRenderError';
    }
}
exports.PdfRenderError = PdfRenderError;
//# sourceMappingURL=types.js.map