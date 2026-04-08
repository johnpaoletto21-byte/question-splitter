/**
 * core/result-model/types.ts
 *
 * Final run result row contract.
 *
 * Design constraints (Layer B §5.1 "Final run result row"):
 *   - Required fields: target_id, source_pages, output_file_name, status
 *   - Optional fields: local_output_path, drive_file_id, drive_url
 *   - Forbidden fields: review_comment, raw provider payloads, credentials (INV-4)
 *   - No provider SDK types (INV-9)
 *
 * TASK-401 adds this module.
 */

/**
 * A successful final result row.
 *
 * Produced after composition (and optional upload) succeeds for a target.
 * INV-5: exactly one row per target.
 * INV-4: review_comment must not appear here.
 */
export interface FinalResultOk {
  /** Stable target identifier from Agent 1. */
  target_id: string;
  /** Ordered page numbers covered by this target. */
  source_pages: number[];
  /** Basename of the final composed output image. */
  output_file_name: string;
  status: 'ok';
  /** Absolute path to the local output file. */
  local_output_path?: string;
  /** Google Drive file ID (populated by upload step). */
  drive_file_id?: string;
  /** Google Drive share URL (populated by upload step). */
  drive_url?: string;
}

/**
 * A failed final result row.
 *
 * Produced when crop, composition, or upload fails for a target.
 * Per INV-8: one target failure must not kill remaining targets.
 * INV-4: review_comment must not appear here.
 */
export interface FinalResultFailed {
  target_id: string;
  source_pages: number[];
  /** Empty string — no output file was produced. */
  output_file_name: '';
  status: 'failed';
  /** Stable error code from Layer B §5.2 (e.g. BBOX_INVALID, COMPOSITION_FAILED). */
  failure_code: string;
  failure_message: string;
}

/**
 * The complete final result row: either ok or failed.
 *
 * This is the clean, user-facing contract consumed by the run summary UI
 * and any downstream export. review_comment, agent outputs, and provider
 * payloads must not appear here (INV-4).
 */
export type FinalResultRow = FinalResultOk | FinalResultFailed;
