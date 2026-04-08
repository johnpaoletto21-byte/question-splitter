"use strict";
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
 *   4. Set "anyone with the link can view" sharing permission on the uploaded
 *      file (FR-UF6-2 / Layer B Boundary H — permission handling).
 *   5. Return a normalized DriveUploadResult — no googleapis SDK types escape.
 *
 * Both DriveHttpUploadFn and DriveHttpPermissionFn are injectable so tests
 * can mock HTTP calls without making real network requests.
 *
 * TASK-402 adds this module.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToDrive = uploadToDrive;
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
const types_1 = require("./types");
/**
 * Default implementation: calls Drive Files API v3 with a multipart body
 * composed of the file metadata JSON and the raw image bytes.
 * Uses native fetch (Node 18+), so no googleapis SDK import is needed.
 */
const defaultDriveHttpUpload = async (accessToken, fileName, folderId, fileBuffer) => {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const metadataJson = JSON.stringify({ name: fileName, parents: [folderId] });
    // Build the multipart/related body manually:
    //   Part 1 — file metadata (JSON)
    //   Part 2 — file bytes (image/png)
    const headerText = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadataJson,
        `--${boundary}`,
        'Content-Type: image/png',
        '',
        '',
    ].join('\r\n');
    const closing = `\r\n--${boundary}--`;
    const headerBuf = Buffer.from(headerText, 'utf8');
    const closingBuf = Buffer.from(closing, 'utf8');
    const body = Buffer.concat([headerBuf, fileBuffer, closingBuf]);
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': String(body.length),
        },
        body,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '(no body)');
        throw new Error(`Drive API error: HTTP ${response.status} — ${text}`);
    }
    const data = (await response.json());
    if (!data.id || !data.webViewLink) {
        throw new Error(`Drive API returned incomplete fields: id=${data.id}, webViewLink=${data.webViewLink}`);
    }
    return { id: data.id, webViewLink: data.webViewLink };
};
/**
 * Default implementation: calls Drive Permissions API v3 to grant
 * "anyone with the link" read access (FR-UF6-2 / Layer B Boundary H).
 * Uses native fetch (Node 18+).
 */
const defaultDriveHttpPermission = async (accessToken, fileId) => {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '(no body)');
        throw new Error(`Drive Permissions API error: HTTP ${response.status} — ${text}`);
    }
};
// ---------------------------------------------------------------------------
// Token reader
// ---------------------------------------------------------------------------
/**
 * Reads the cached OAuth2 token file and returns the access_token string.
 * Throws a DriveUploadError if the token file is missing or malformed.
 */
function readAccessToken(oauthTokenPath, targetId, filePath) {
    let raw;
    try {
        raw = (0, node_fs_1.readFileSync)(oauthTokenPath, 'utf8');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new types_1.DriveUploadError(targetId, filePath, `cannot read OAuth token file at ${oauthTokenPath}: ${msg}`);
    }
    let token;
    try {
        token = JSON.parse(raw);
    }
    catch {
        throw new types_1.DriveUploadError(targetId, filePath, `OAuth token file at ${oauthTokenPath} is not valid JSON`);
    }
    if (!token.access_token) {
        throw new types_1.DriveUploadError(targetId, filePath, `OAuth token file at ${oauthTokenPath} is missing the access_token field`);
    }
    return token.access_token;
}
// ---------------------------------------------------------------------------
// Public upload function
// ---------------------------------------------------------------------------
/**
 * Uploads a composed output file to the configured Google Drive folder and
 * sets "anyone with the link can view" sharing permission (FR-UF6-2 / Layer B
 * Boundary H).
 *
 * Retry policy: the file upload is attempted twice; if both fail, throws
 * DriveUploadError (Layer B §5.2 UPLOAD_FAILED — "retry once; if still
 * failing, preserve local output path and continue other uploads").
 *
 * Permission step: runs once after a successful upload with no retry.
 * A permission failure is treated as adapter failure and throws DriveUploadError.
 *
 * @param filePath          Absolute path to the local composed image file.
 * @param targetId          Target identifier (for error traceability).
 * @param folderId          Google Drive folder ID from local config.
 * @param oauthTokenPath    Path to the cached OAuth2 token file (OAUTH_TOKEN_PATH).
 * @param httpUpload        Injected HTTP upload function (default: native fetch).
 * @param httpPermission    Injected HTTP permission function (default: native fetch).
 * @returns                 Normalized DriveUploadResult with drive_file_id and drive_url.
 * @throws                  DriveUploadError after two failed upload attempts or on
 *                          permission-setting failure.
 */
async function uploadToDrive(filePath, targetId, folderId, oauthTokenPath, httpUpload = defaultDriveHttpUpload, httpPermission = defaultDriveHttpPermission) {
    const accessToken = readAccessToken(oauthTokenPath, targetId, filePath);
    const fileName = path.basename(filePath);
    const fileBuffer = (0, node_fs_1.readFileSync)(filePath);
    // --- Upload with retry (two attempts total) ---
    let lastErr;
    let uploadResult;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            uploadResult = await httpUpload(accessToken, fileName, folderId, fileBuffer);
            break;
        }
        catch (err) {
            lastErr = err;
        }
    }
    if (!uploadResult) {
        const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new types_1.DriveUploadError(targetId, filePath, message);
    }
    // --- Permission step: set link-accessible sharing (FR-UF6-2) ---
    try {
        await httpPermission(accessToken, uploadResult.id);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new types_1.DriveUploadError(targetId, filePath, `permission step failed: ${message}`);
    }
    return { drive_file_id: uploadResult.id, drive_url: uploadResult.webViewLink };
}
//# sourceMappingURL=uploader.js.map