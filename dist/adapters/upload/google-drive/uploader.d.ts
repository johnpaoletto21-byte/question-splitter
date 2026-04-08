/**
 * adapters/upload/google-drive/uploader.ts
 *
 * Google Drive upload adapter for the single-user desktop OAuth flow.
 *
 * Responsibilities:
 *   1. Read the cached OAuth2 token file at OAUTH_TOKEN_PATH.
 *   2. Upload the composed output image to the configured Drive folder
 *      using the Drive Files API v3 multipart upload.
 *   3. Retry once on transient failure (Layer B §5.2 UPLOAD_FAILED policy).
 *   4. Return a normalized DriveUploadResult — no googleapis SDK types escape.
 *
 * The DriveHttpUploadFn is injectable so tests can mock the HTTP call
 * without making real network requests (same pattern as gemini-segmenter).
 *
 * TASK-402 adds this module.
 */
import type { DriveUploadResult } from './types';
/**
 * Contract for the HTTP call that performs the Drive multipart upload.
 * Injectable for testing; the default implementation uses native fetch.
 *
 * @param accessToken  OAuth2 bearer token.
 * @param fileName     Destination file name on Drive.
 * @param folderId     Parent folder ID in Drive.
 * @param fileBuffer   Raw file bytes to upload.
 * @returns            Raw Drive API fields: id and webViewLink.
 */
export type DriveHttpUploadFn = (accessToken: string, fileName: string, folderId: string, fileBuffer: Buffer) => Promise<{
    id: string;
    webViewLink: string;
}>;
/**
 * Uploads a composed output file to the configured Google Drive folder.
 *
 * Retry policy: attempts the upload twice; if both fail, throws DriveUploadError
 * (Layer B §5.2 UPLOAD_FAILED — "retry once; if still failing, preserve local
 * output path and continue other uploads").
 *
 * @param filePath        Absolute path to the local composed image file.
 * @param targetId        Target identifier (for error traceability).
 * @param folderId        Google Drive folder ID from local config.
 * @param oauthTokenPath  Path to the cached OAuth2 token file (OAUTH_TOKEN_PATH).
 * @param httpUpload      Injected HTTP upload function (default: native fetch).
 * @returns               Normalized DriveUploadResult with drive_file_id and drive_url.
 * @throws                DriveUploadError after two failed upload attempts.
 */
export declare function uploadToDrive(filePath: string, targetId: string, folderId: string, oauthTokenPath: string, httpUpload?: DriveHttpUploadFn): Promise<DriveUploadResult>;
//# sourceMappingURL=uploader.d.ts.map