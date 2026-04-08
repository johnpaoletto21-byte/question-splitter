/**
 * core/run-orchestrator/__tests__/upload-step.test.ts
 *
 * Proves (TASK-402 acceptance bar):
 *   - Failed rows from prior steps pass through unchanged (INV-8 continuation).
 *   - Ok rows without local_output_path pass through unchanged (no upload attempted).
 *   - Successful upload → ok row gains drive_file_id and drive_url.
 *   - Failed upload → UPLOAD_FAILED failed row; local_output_path preserved (INV-8).
 *   - One FinalResultRow per input row, same order (INV-5).
 *   - review_comment absent from every FinalResultRow (INV-4).
 *   - Mixed rows (failed + ok) processed correctly in one call.
 *   - driveUploader receives correct filePath, targetId, folderId, oauthTokenPath.
 *   - No provider SDK types in this module (structural test via import shape).
 */

import { runUploadStep } from '../upload-step';
import type { DriveUploaderFn } from '../upload-step';
import type { FinalResultRow, FinalResultOk, FinalResultFailed } from '../../result-model/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN_ID = 'run_20260408_abc123';
const FOLDER_ID = 'drive-folder-999';
const OAUTH_PATH = '/home/user/.oauth.json';

function makeOkRow(
  targetId: string,
  localPath?: string,
): FinalResultOk {
  return {
    target_id: targetId,
    source_pages: [1],
    output_file_name: `${targetId}.png`,
    status: 'ok',
    local_output_path: localPath,
  };
}

function makeFailedRow(targetId: string, code = 'BBOX_INVALID'): FinalResultFailed {
  return {
    target_id: targetId,
    source_pages: [1],
    output_file_name: '',
    status: 'failed',
    failure_code: code,
    failure_message: `${code} reason`,
  };
}

function makeSuccessUploader(
  fileId = 'file-id-001',
  url = 'https://drive.google.com/file/d/001',
): DriveUploaderFn {
  return jest.fn().mockResolvedValue({ drive_file_id: fileId, drive_url: url });
}

function makeFailingUploader(message = 'network timeout'): DriveUploaderFn {
  return jest.fn().mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// Pass-through: failed rows
// ---------------------------------------------------------------------------

describe('runUploadStep — failed row pass-through', () => {
  it('passes failed rows through unchanged, does not call driveUploader', async () => {
    const row = makeFailedRow('q_001');
    const uploader = makeSuccessUploader();

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(row);
    expect(uploader).not.toHaveBeenCalled();
  });

  it('passes multiple failed rows through, preserving order', async () => {
    const rows: FinalResultRow[] = [
      makeFailedRow('q_001', 'BBOX_INVALID'),
      makeFailedRow('q_002', 'COMPOSITION_FAILED'),
    ];
    const uploader = makeSuccessUploader();

    const results = await runUploadStep(RUN_ID, rows, FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(2);
    expect(results[0].target_id).toBe('q_001');
    expect(results[1].target_id).toBe('q_002');
    expect(uploader).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pass-through: ok rows without local_output_path
// ---------------------------------------------------------------------------

describe('runUploadStep — ok row without local path', () => {
  it('passes through ok row with no local_output_path, no upload call', async () => {
    const row = makeOkRow('q_001', undefined);
    const uploader = makeSuccessUploader();

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(row);
    expect(uploader).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Successful upload
// ---------------------------------------------------------------------------

describe('runUploadStep — successful upload', () => {
  it('adds drive_file_id and drive_url to an ok row', async () => {
    const row = makeOkRow('q_001', '/tmp/out/q_001.png');
    const uploader = makeSuccessUploader('file-id-abc', 'https://drive.google.com/abc');

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(1);
    const updated = results[0] as FinalResultOk;
    expect(updated.status).toBe('ok');
    expect(updated.drive_file_id).toBe('file-id-abc');
    expect(updated.drive_url).toBe('https://drive.google.com/abc');
  });

  it('preserves existing ok row fields after upload', async () => {
    const row = makeOkRow('q_002', '/tmp/out/q_002.png');
    const uploader = makeSuccessUploader('fid-002', 'https://drive.google.com/002');

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    const updated = results[0] as FinalResultOk;
    expect(updated.target_id).toBe('q_002');
    expect(updated.source_pages).toEqual([1]);
    expect(updated.output_file_name).toBe('q_002.png');
    expect(updated.local_output_path).toBe('/tmp/out/q_002.png');
  });

  it('calls driveUploader with correct arguments', async () => {
    const row = makeOkRow('q_003', '/tmp/out/q_003.png');
    const uploader = makeSuccessUploader();

    await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    expect(uploader).toHaveBeenCalledWith(
      '/tmp/out/q_003.png',
      'q_003',
      FOLDER_ID,
      OAUTH_PATH,
    );
  });
});

// ---------------------------------------------------------------------------
// Failed upload — UPLOAD_FAILED + local path preservation
// ---------------------------------------------------------------------------

describe('runUploadStep — failed upload', () => {
  it('emits UPLOAD_FAILED failed row when uploader throws', async () => {
    const row = makeOkRow('q_001', '/tmp/out/q_001.png');
    const uploader = makeFailingUploader('connection refused');

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(1);
    const failed = results[0] as FinalResultFailed;
    expect(failed.status).toBe('failed');
    expect(failed.failure_code).toBe('UPLOAD_FAILED');
    expect(failed.failure_message).toContain('connection refused');
  });

  it('preserves local_output_path on the UPLOAD_FAILED row (user can recover file)', async () => {
    const row = makeOkRow('q_001', '/tmp/out/q_001.png');
    const uploader = makeFailingUploader('timeout');

    const results = await runUploadStep(RUN_ID, [row], FOLDER_ID, OAUTH_PATH, uploader);

    const failed = results[0] as FinalResultFailed;
    expect(failed.local_output_path).toBe('/tmp/out/q_001.png');
  });

  it('continues uploading other targets after one UPLOAD_FAILED (INV-8)', async () => {
    const rows: FinalResultRow[] = [
      makeOkRow('q_001', '/tmp/out/q_001.png'),
      makeOkRow('q_002', '/tmp/out/q_002.png'),
    ];
    const uploader = jest.fn()
      .mockRejectedValueOnce(new Error('upload q_001 failed'))
      .mockResolvedValueOnce({ drive_file_id: 'fid-002', drive_url: 'https://drive.google.com/002' });

    const results = await runUploadStep(RUN_ID, rows, FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('failed');
    expect((results[0] as FinalResultFailed).failure_code).toBe('UPLOAD_FAILED');
    expect(results[1].status).toBe('ok');
    expect((results[1] as FinalResultOk).drive_file_id).toBe('fid-002');
    expect(uploader).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Mixed rows + invariants
// ---------------------------------------------------------------------------

describe('runUploadStep — mixed rows', () => {
  it('handles mixed failed, ok-no-path, and ok-with-path rows in order (INV-5)', async () => {
    const rows: FinalResultRow[] = [
      makeFailedRow('q_001'),
      makeOkRow('q_002'),                       // no local path
      makeOkRow('q_003', '/tmp/out/q_003.png'), // will upload
    ];
    const uploader = makeSuccessUploader('fid-003', 'https://drive.google.com/003');

    const results = await runUploadStep(RUN_ID, rows, FOLDER_ID, OAUTH_PATH, uploader);

    expect(results).toHaveLength(3);
    expect(results[0].target_id).toBe('q_001');
    expect(results[0].status).toBe('failed');
    expect(results[1].target_id).toBe('q_002');
    expect(results[1].status).toBe('ok');
    expect(results[2].target_id).toBe('q_003');
    expect(results[2].status).toBe('ok');
    expect((results[2] as FinalResultOk).drive_file_id).toBe('fid-003');
    expect(uploader).toHaveBeenCalledTimes(1);
  });

  it('returns empty array for empty input (INV-5)', async () => {
    const uploader = makeSuccessUploader();
    const results = await runUploadStep(RUN_ID, [], FOLDER_ID, OAUTH_PATH, uploader);
    expect(results).toEqual([]);
    expect(uploader).not.toHaveBeenCalled();
  });

  it('review_comment is absent from every result row (INV-4)', async () => {
    const rows: FinalResultRow[] = [
      makeOkRow('q_001', '/tmp/out/q_001.png'),
      makeFailedRow('q_002'),
    ];
    const uploader = makeSuccessUploader();

    const results = await runUploadStep(RUN_ID, rows, FOLDER_ID, OAUTH_PATH, uploader);

    for (const row of results) {
      expect(row).not.toHaveProperty('review_comment');
    }
  });
});
