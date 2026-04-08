/**
 * core/run-orchestrator/upload-step.ts
 *
 * Orchestrator step that uploads composed output files to Google Drive.
 *
 * Design (mirrors composition-step.ts pattern):
 *   - Drive upload logic is injected via DriveUploaderFn — no provider SDK
 *     types or import paths enter core (INV-9).
 *   - Only rows with status 'ok' and a local_output_path are uploaded.
 *   - Failed rows from prior steps are passed through unchanged (INV-8).
 *   - If upload fails for one target, that target becomes a failed row with
 *     failure_code 'UPLOAD_FAILED'; local_output_path is preserved on the
 *     failed row so the user can recover the composed file (Layer B §5.2).
 *     Other targets continue uploading (INV-8 continuation).
 *   - One FinalResultRow per input row, same order (INV-5).
 *   - review_comment never enters FinalResultRow (INV-4).
 *
 * TASK-402 adds this module.
 */

import type { FinalResultRow, FinalResultOk } from '../result-model/types';

/**
 * Contract for a function that uploads a composed output file to Drive.
 *
 * Implemented in adapters/upload/google-drive/uploader.ts.
 * Injected here so core stays free of googleapis SDK specifics (INV-9).
 *
 * @param filePath       Absolute path to the local output file.
 * @param targetId       Target identifier for traceability.
 * @param folderId       Drive folder ID from local config.
 * @param oauthTokenPath Path to the cached OAuth2 token file.
 * @returns              Normalized result with drive_file_id and drive_url.
 */
export type DriveUploaderFn = (
  filePath: string,
  targetId: string,
  folderId: string,
  oauthTokenPath: string,
) => Promise<{ drive_file_id: string; drive_url: string }>;

/**
 * Runs the upload step for all composition result rows.
 *
 * For each FinalResultRow:
 *   - status 'failed'                    → pass through unchanged (INV-8).
 *   - status 'ok', no local_output_path  → pass through unchanged (no file to upload).
 *   - status 'ok', has local_output_path → call driveUploader:
 *       Success: return updated ok row with drive_file_id and drive_url set.
 *       Failure: return failed row (UPLOAD_FAILED) with local_output_path preserved
 *                so the user can recover the composed file; continue others (INV-8).
 *
 * @param runId          Current run_id (for traceability, reserved for future logging).
 * @param rows           FinalResultRow[] from runCompositionStep.
 * @param folderId       Google Drive folder ID from local config.
 * @param oauthTokenPath Path to the cached OAuth2 token file.
 * @param driveUploader  Injected upload function (adapter-provided).
 * @returns              FinalResultRow[] — one per input row, same order (INV-5).
 */
export async function runUploadStep(
  runId: string,
  rows: FinalResultRow[],
  folderId: string,
  oauthTokenPath: string,
  driveUploader: DriveUploaderFn,
): Promise<FinalResultRow[]> {
  const results: FinalResultRow[] = [];

  for (const row of rows) {
    if (row.status === 'failed') {
      // Prior step already failed this target — pass through (INV-8 continuation).
      results.push(row);
      continue;
    }

    if (!row.local_output_path) {
      // No local file path available — pass through as-is (nothing to upload).
      results.push(row);
      continue;
    }

    try {
      const { drive_file_id, drive_url } = await driveUploader(
        row.local_output_path,
        row.target_id,
        folderId,
        oauthTokenPath,
      );

      const updated: FinalResultOk = {
        ...row,
        drive_file_id,
        drive_url,
      };
      results.push(updated);
    } catch (err) {
      // Per INV-8 and UPLOAD_FAILED contract: preserve local_output_path,
      // surface failure cleanly, continue remaining targets.
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        target_id: row.target_id,
        source_pages: row.source_pages,
        output_file_name: '',
        status: 'failed',
        failure_code: 'UPLOAD_FAILED',
        failure_message: message,
        local_output_path: row.local_output_path,
      });
    }
  }

  return results;
}
