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
export class PdfRenderError extends Error {
  public readonly code = 'PDF_RENDER_FAILED' as const;

  constructor(
    reason: string,
    public readonly source_id: string,
    public readonly page_number?: number,
  ) {
    const loc = page_number !== undefined ? ` page=${page_number}` : '';
    super(`PDF_RENDER_FAILED: ${reason} [source_id=${source_id}${loc}]`);
    this.name = 'PdfRenderError';
  }
}
