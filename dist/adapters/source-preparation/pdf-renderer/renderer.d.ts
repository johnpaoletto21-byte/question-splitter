/**
 * adapters/source-preparation/pdf-renderer/renderer.ts
 *
 * Renders all pages of a single PDF source into PreparedPageImage entries.
 *
 * Boundary A contract (Layer B):
 *   - Input:  local PDF file path, run metadata, source ordering
 *   - Output: PreparedPageImage[] with source_id, page_number (1-based),
 *             image_path, image_width, image_height
 *
 * No provider SDK (Gemini, Drive, googleapis) is imported here (INV-9).
 * No bbox, segmentation, or upload logic appears here.
 */
import type { PdfSource, PreparedPageImage } from '../../../core/source-model/types';
/**
 * Render every page of `source.file_path` to PNG files in `outputDir`.
 *
 * @param source    The PdfSource whose file_path will be rendered.
 * @param outputDir Absolute path to an existing directory for output PNGs.
 * @returns         One PreparedPageImage per page, in 1-based page order.
 * @throws          PdfRenderError if the PDF cannot be loaded or any page fails.
 */
export declare function renderPdfSource(source: PdfSource, outputDir: string): Promise<PreparedPageImage[]>;
//# sourceMappingURL=renderer.d.ts.map