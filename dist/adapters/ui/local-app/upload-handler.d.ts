/**
 * adapters/ui/local-app/upload-handler.ts
 *
 * Multipart PDF upload parsing for the local app.
 */
import type * as http from 'http';
declare const MAX_UPLOAD_BYTES: number;
export interface ParsedPdfUpload {
    pdfFilePath: string;
    originalFileName: string;
    runLabel?: string;
}
export declare class PdfUploadError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
export declare function parsePdfUpload(req: http.IncomingMessage, outputDir: string): Promise<ParsedPdfUpload>;
export { MAX_UPLOAD_BYTES };
//# sourceMappingURL=upload-handler.d.ts.map