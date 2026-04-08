/**
 * adapters/ui/local-app/preview-fixture.ts
 *
 * Fixture RunSummaryState for localhost browser validation of the summary UI.
 *
 * Mixed ok/failed run with:
 *   - q_preview_001: Agent 1 review note present, Agent 2 ok, final_status ok, drive_url set.
 *   - q_preview_002: Agent 1 ok, Agent 2 review note present, final_status failed,
 *                    failure_code and failure_message set.
 *
 * Selector coverage for browser verification:
 *   run-summary, summary-row-*, summary-row-status-*, summary-row-drive-url-*,
 *   summary-row-review-comment-*, summary-row-agent2-review-comment-*,
 *   summary-row-failure-code-*, summary-row-failure-message-*
 *
 * TASK-501 close pass: exported for use by preview-server.ts and preview-fixture.test.ts.
 */

import type { RunSummaryState } from '../../../core/run-summary/types';

/**
 * Mixed ok/failed summary fixture used by the local preview server.
 *
 * Represents the state after applyFinalResultsToSummary with one successful
 * and one failed target, both carrying agent review comments.
 */
export const PREVIEW_FIXTURE: RunSummaryState = {
  run_id: 'preview_run_mixed_501',
  targets: [
    {
      target_id: 'q_preview_001',
      target_type: 'question',
      page_numbers: [1],
      agent1_status: 'needs_review',
      review_comment: 'Agent 1: boundary unclear between header and question body',
      agent2_status: 'ok',
      final_status: 'ok',
      drive_url: 'https://drive.google.com/file/d/preview_ok_123/view',
    },
    {
      target_id: 'q_preview_002',
      target_type: 'question',
      page_numbers: [2, 3],
      agent1_status: 'ok',
      agent2_status: 'needs_review',
      agent2_review_comment: 'Agent 2: low confidence on bottom crop boundary',
      final_status: 'failed',
      failure_code: 'COMPOSITION_FAILED',
      failure_message: 'output composer could not stack regions: height mismatch',
    },
  ],
};
