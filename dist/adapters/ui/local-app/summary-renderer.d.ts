/**
 * adapters/ui/local-app/summary-renderer.ts
 *
 * Renders RunSummaryState as a self-contained HTML string for local viewing.
 *
 * Design constraints:
 *   - Depends only on core/run-summary types (no provider SDK types, INV-9).
 *   - Does not import upload adapter or model adapters directly (boundary map rule).
 *   - review_comment and agent2_review_comment are rendered in the UI (INV-4: visible
 *     in summary) — they are carried on RunSummaryTargetEntry, never on result rows.
 *   - Every rendered row uses data-testid attributes so the summary container,
 *     per-row status, drive URL, and review comment are addressable for verification.
 *   - Partial failures remain visible: all target rows are always rendered regardless
 *     of final_status value (INV-8: one failed target must not hide the rest).
 *
 * UI selector plan (stable data-testid values):
 *   - Summary container:   data-testid="run-summary"
 *   - Per-row container:   data-testid="summary-row-{target_id}"
 *   - Per-row status:      data-testid="summary-row-status-{target_id}"
 *   - Drive URL anchor:    data-testid="summary-row-drive-url-{target_id}"
 *   - Agent 1 review note: data-testid="summary-row-review-comment-{target_id}"
 *   - Agent 2 review note: data-testid="summary-row-agent2-review-comment-{target_id}"
 *   - Failure code:        data-testid="summary-row-failure-code-{target_id}"
 *   - Failure message:     data-testid="summary-row-failure-message-{target_id}"
 *
 * TASK-501 adds this module.
 */
import type { RunSummaryState } from '../../../core/run-summary/types';
/**
 * Renders a RunSummaryState as a self-contained HTML string.
 *
 * All target rows are always rendered (INV-8: partial failures stay visible).
 * review_comment fields appear in the rendered table (INV-4: visible in summary UI).
 *
 * @param state  The run summary state, typically after applyFinalResultsToSummary.
 * @returns      UTF-8 HTML string suitable for writing to a .html file and opening
 *               in a browser for manual or automated review.
 */
export declare function renderSummaryHtml(state: RunSummaryState): string;
//# sourceMappingURL=summary-renderer.d.ts.map