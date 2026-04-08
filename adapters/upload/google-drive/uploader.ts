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

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { DriveUploadResult } from './types';
import { DriveUploadError } from './types';

// ---------------------------------------------------------------------------
// Injectable HTTP upload function
// ---------------------------------------------------------------------------

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
export type DriveHttpUploadFn = (
  accessToken: string,
  fileName: string,
  folderId: string,
  fileBuffer: Buffer,
) => Promise<{ id: string; webViewLink: string }>;

/**
 * Default implementation: calls Drive Files API v3 with a multipart body
 * composed of the file metadata JSON and the raw image bytes.
 * Uses native fetch (Node 18+), so no googleapis SDK import is needed.
 */
const defaultDriveHttpUpload: DriveHttpUploadFn = async (
  accessToken,
  fileName,
  folderId,
  fileBuffer,
) => {
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

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)');
    throw new Error(`Drive API error: HTTP ${response.status} — ${text}`);
  }

  const data = (await response.json()) as { id?: string; webViewLink?: string };
  if (!data.id || !data.webViewLink) {
    throw new Error(
      `Drive API returned incomplete fields: id=${data.id}, webViewLink=${data.webViewLink}`,
    );
  }

  return { id: data.id, webViewLink: data.webViewLink };
};

// ---------------------------------------------------------------------------
// Token reader
// ---------------------------------------------------------------------------

/**
 * Reads the cached OAuth2 token file and returns the access_token string.
 * Throws a DriveUploadError if the token file is missing or malformed.
 */
function readAccessToken(oauthTokenPath: string, targetId: string, filePath: string): string {
  let raw: string;
  try {
    raw = readFileSync(oauthTokenPath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DriveUploadError(
      targetId,
      filePath,
      `cannot read OAuth token file at ${oauthTokenPath}: ${msg}`,
    );
  }

  let token: { access_token?: string };
  try {
    token = JSON.parse(raw) as { access_token?: string };
  } catch {
    throw new DriveUploadError(
      targetId,
      filePath,
      `OAuth token file at ${oauthTokenPath} is not valid JSON`,
    );
  }

  if (!token.access_token) {
    throw new DriveUploadError(
      targetId,
      filePath,
      `OAuth token file at ${oauthTokenPath} is missing the access_token field`,
    );
  }

  return token.access_token;
}

// ---------------------------------------------------------------------------
// Public upload function
// ---------------------------------------------------------------------------

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
export async function uploadToDrive(
  filePath: string,
  targetId: string,
  folderId: string,
  oauthTokenPath: string,
  httpUpload: DriveHttpUploadFn = defaultDriveHttpUpload,
): Promise<DriveUploadResult> {
  const accessToken = readAccessToken(oauthTokenPath, targetId, filePath);
  const fileName = path.basename(filePath);
  const fileBuffer = readFileSync(filePath);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await httpUpload(accessToken, fileName, folderId, fileBuffer);
      return { drive_file_id: result.id, drive_url: result.webViewLink };
    } catch (err) {
      lastErr = err;
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new DriveUploadError(targetId, filePath, message);
}
