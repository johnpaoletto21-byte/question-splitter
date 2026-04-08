/**
 * adapters/upload/google-drive/types.ts
 *
 * Normalized result and error types for the Google Drive upload adapter.
 *
 * Core sees only these shapes — no googleapis SDK types or OAuth internals
 * escape this boundary (Layer B INV-9).
 *
 * TASK-402 adds this module.
 */
/**
 * Normalized result returned by a successful Google Drive upload.
 * Maps directly to the optional drive_file_id / drive_url fields
 * defined in core/result-model/types.ts FinalResultOk.
 */
export interface DriveUploadResult {
    /** Google Drive file ID (stable identifier). */
    drive_file_id: string;
    /** Google Drive web view URL for direct sharing. */
    drive_url: string;
}
/**
 * Error thrown when a Drive upload fails after the retry policy is exhausted.
 * Maps to the UPLOAD_FAILED error code from Layer B §5.2.
 */
export declare class DriveUploadError extends Error {
    /** Target identifier for traceability in the orchestrator. */
    readonly targetId: string;
    /** Local file path that could not be uploaded. */
    readonly filePath: string;
    readonly code: "UPLOAD_FAILED";
    constructor(
    /** Target identifier for traceability in the orchestrator. */
    targetId: string, 
    /** Local file path that could not be uploaded. */
    filePath: string, message: string);
}
//# sourceMappingURL=types.d.ts.map