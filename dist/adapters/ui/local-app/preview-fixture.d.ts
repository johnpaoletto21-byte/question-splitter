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
export declare const PREVIEW_FIXTURE: RunSummaryState;
//# sourceMappingURL=preview-fixture.d.ts.map