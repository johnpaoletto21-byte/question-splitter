/**
 * adapters/ui/local-app/diagram-upload-handler.ts
 *
 * Multipart PNG upload parsing for the diagram-only cropper.
 *
 * Mirrors the structure of `upload-handler.ts` (which handles PDFs for the
 * question pipeline). Differences: accepts ONE PNG, validates the magic bytes
 * to reject non-PNGs even if the extension/mime is correct, and writes into
 * `OUTPUT_DIR/diagram-uploads/`.
 */
import type * as http from 'http';
declare const MAX_DIAGRAM_UPLOAD_BYTES: number;
export interface ParsedDiagramUpload {
    imageFilePath: string;
    originalFileName: string;
}
export declare class DiagramUploadError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
/**
 * Parses one PNG out of a multipart/form-data request.
 *
 * On success: writes the PNG to `<outputDir>/diagram-uploads/<timestamp>_<safe>.png`
 * and resolves with the path + original file name.
 */
export declare function parseDiagramUpload(req: http.IncomingMessage, outputDir: string): Promise<ParsedDiagramUpload>;
export { MAX_DIAGRAM_UPLOAD_BYTES };
//# sourceMappingURL=diagram-upload-handler.d.ts.map