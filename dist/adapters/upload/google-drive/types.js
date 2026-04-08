"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveUploadError = void 0;
/**
 * Error thrown when a Drive upload fails after the retry policy is exhausted.
 * Maps to the UPLOAD_FAILED error code from Layer B §5.2.
 */
class DriveUploadError extends Error {
    constructor(
    /** Target identifier for traceability in the orchestrator. */
    targetId, 
    /** Local file path that could not be uploaded. */
    filePath, message) {
        super(`UPLOAD_FAILED [${targetId}] ${filePath}: ${message}`);
        this.targetId = targetId;
        this.filePath = filePath;
        this.code = 'UPLOAD_FAILED';
        this.name = 'DriveUploadError';
    }
}
exports.DriveUploadError = DriveUploadError;
//# sourceMappingURL=types.js.map