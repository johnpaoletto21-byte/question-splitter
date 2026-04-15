/**
 * adapters/ui/local-app/hint-upload-handler.ts
 *
 * Multipart upload parsing for the hint annotator mode.
 * Captures a PNG file, optional hint text, and annotation method selection.
 */
import type * as http from 'http';
import type { HintAnnotationMethod } from '../../run-pipeline/hint-pipeline-runner';
declare const MAX_HINT_UPLOAD_BYTES: number;
export interface ParsedHintUpload {
    imageFilePath: string;
    originalFileName: string;
    hintText?: string;
    method: HintAnnotationMethod;
    /** Raw textarea value for the blend step-1 (overlay) prompt override. */
    blendOverlayPrompt?: string;
    /** Raw textarea value for the blend step-1 response schema (JSON text). */
    blendOverlaySchema?: string;
    /** Raw textarea value for the blend step-2 (render) prompt override. */
    blendRenderPrompt?: string;
}
export declare class HintUploadError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
/**
 * Parses a PNG file, optional hint text, and method selection from a multipart request.
 */
export declare function parseHintUpload(req: http.IncomingMessage, outputDir: string): Promise<ParsedHintUpload>;
export { MAX_HINT_UPLOAD_BYTES };
//# sourceMappingURL=hint-upload-handler.d.ts.map