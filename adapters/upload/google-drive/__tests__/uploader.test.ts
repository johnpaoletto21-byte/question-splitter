/**
 * adapters/upload/google-drive/__tests__/uploader.test.ts
 *
 * Unit tests for uploadToDrive.
 *
 * All I/O is injected or mocked — no real network, no real filesystem reads
 * for the Drive upload path.
 *
 * Proves (TASK-402):
 *   - Happy path: returns normalized DriveUploadResult.
 *   - Retry policy: retries once on first HTTP failure; succeeds on second.
 *   - Exhausted retry: throws DriveUploadError after two consecutive failures.
 *   - Missing access_token: throws DriveUploadError before attempting upload.
 *   - Invalid JSON token file: throws DriveUploadError before attempting upload.
 *   - DriveUploadError carries targetId, filePath, and UPLOAD_FAILED code.
 */

import { readFileSync } from 'node:fs';
import { uploadToDrive } from '../uploader';
import type { DriveHttpUploadFn } from '../uploader';
import { DriveUploadError } from '../types';

// ---------------------------------------------------------------------------
// Mock node:fs — inject controlled token and file content
// ---------------------------------------------------------------------------

jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN = JSON.stringify({ access_token: 'test-access-token' });
const FILE_BUFFER = Buffer.from('fake-png-bytes');

const TARGET_ID = 'q_001';
const FILE_PATH = '/tmp/output/q_001.png';
const FOLDER_ID = 'drive-folder-123';
const TOKEN_PATH = '/home/user/.oauth-token.json';

/** Sets up fs mocks: first call (token), second call (file). */
function setupFsMocks(tokenContent: string | Error = VALID_TOKEN) {
  mockReadFileSync.mockReset();
  if (tokenContent instanceof Error) {
    mockReadFileSync.mockImplementationOnce(() => { throw tokenContent; });
  } else {
    mockReadFileSync.mockReturnValueOnce(tokenContent as unknown as string);
    mockReadFileSync.mockReturnValueOnce(FILE_BUFFER as unknown as string);
  }
}

function makeSuccessHttpUpload(): DriveHttpUploadFn {
  return jest.fn().mockResolvedValue({ id: 'file-id-abc', webViewLink: 'https://drive.google.com/file/d/abc' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadToDrive — happy path', () => {
  it('returns normalized DriveUploadResult on success', async () => {
    setupFsMocks();
    const httpUpload = makeSuccessHttpUpload();

    const result = await uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload);

    expect(result).toEqual({
      drive_file_id: 'file-id-abc',
      drive_url: 'https://drive.google.com/file/d/abc',
    });
  });

  it('passes access_token, fileName, folderId, and fileBuffer to httpUpload', async () => {
    setupFsMocks();
    const httpUpload = makeSuccessHttpUpload();

    await uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload);

    expect(httpUpload).toHaveBeenCalledWith(
      'test-access-token',
      'q_001.png',
      FOLDER_ID,
      FILE_BUFFER,
    );
  });
});

describe('uploadToDrive — retry policy', () => {
  it('succeeds on second attempt when first fails (retries once)', async () => {
    setupFsMocks();
    const httpUpload = jest.fn()
      .mockRejectedValueOnce(new Error('transient network error'))
      .mockResolvedValueOnce({ id: 'file-id-retry', webViewLink: 'https://drive.google.com/retry' });

    const result = await uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload);

    expect(result.drive_file_id).toBe('file-id-retry');
    expect(httpUpload).toHaveBeenCalledTimes(2);
  });

  it('throws DriveUploadError after two consecutive failures', async () => {
    setupFsMocks();
    const httpUpload = jest.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));

    await expect(
      uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload),
    ).rejects.toThrow(DriveUploadError);

    expect(httpUpload).toHaveBeenCalledTimes(2);
  });

  it('DriveUploadError carries correct targetId, filePath, and UPLOAD_FAILED code', async () => {
    setupFsMocks();
    const httpUpload = jest.fn().mockRejectedValue(new Error('upload exploded'));

    let caught: DriveUploadError | undefined;
    try {
      await uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload);
    } catch (err) {
      caught = err as DriveUploadError;
    }

    expect(caught).toBeInstanceOf(DriveUploadError);
    expect(caught!.code).toBe('UPLOAD_FAILED');
    expect(caught!.targetId).toBe(TARGET_ID);
    expect(caught!.filePath).toBe(FILE_PATH);
    expect(caught!.message).toContain('upload exploded');
  });
});

describe('uploadToDrive — token errors', () => {
  it('throws DriveUploadError when token file cannot be read', async () => {
    mockReadFileSync.mockReset();
    mockReadFileSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });

    await expect(
      uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, makeSuccessHttpUpload()),
    ).rejects.toThrow(DriveUploadError);
  });

  it('throws DriveUploadError when token file is not valid JSON', async () => {
    setupFsMocks('not-valid-json{{{');

    await expect(
      uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, makeSuccessHttpUpload()),
    ).rejects.toThrow(DriveUploadError);
  });

  it('throws DriveUploadError when access_token field is missing', async () => {
    setupFsMocks(JSON.stringify({ refresh_token: 'abc' }));

    await expect(
      uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, makeSuccessHttpUpload()),
    ).rejects.toThrow(DriveUploadError);
  });

  it('does not call httpUpload when token is missing', async () => {
    setupFsMocks(JSON.stringify({}));
    const httpUpload = makeSuccessHttpUpload();

    await expect(
      uploadToDrive(FILE_PATH, TARGET_ID, FOLDER_ID, TOKEN_PATH, httpUpload),
    ).rejects.toThrow(DriveUploadError);

    expect(httpUpload).not.toHaveBeenCalled();
  });
});
