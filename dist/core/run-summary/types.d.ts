/**
 * core/run-summary/types.ts
 *
 * Run-summary state for the local UI.
 *
 * Design constraints (from Layer B):
 *   - INV-4: review_comment is visible in summary state — it must NOT appear
 *     in final result rows (result-model is a separate contract, TASK-401+).
 *   - This module depends only on normalized contracts — no provider SDK types.
 *
 * TASK-201 adds the Agent 1 segmentation view of summary state.
 * TASK-301 adds Agent 2 localization status fields.
 * Later tasks (TASK-401, TASK-501) will extend with final-result fields.
 */
/**
 * Per-target summary entry as visible in the local run UI.
 *
 * Carries review_comment fields from Agent 1 and Agent 2 so the user can
 * see which targets need attention. These fields must not appear in final
 * result rows (INV-4).
 */
export interface RunSummaryTargetEntry {
    /** Stable target identifier assigned by the Agent 1 parser. */
    target_id: string;
    /** Target type from the segmentation contract (e.g. 'question'). */
    target_type: string;
    /** Ordered list of page numbers covered by this target (from regions[]). */
    page_numbers: number[];
    /**
     * Agent 1 status flag.
     * 'ok'           — no review note; result is confident.
     * 'needs_review' — review_comment is present; user should inspect.
     */
    agent1_status: 'ok' | 'needs_review';
    /**
     * Optional Agent 1 review note.
     * Present only when agent1_status = 'needs_review'.
     * MUST NOT appear in final result rows (INV-4).
     */
    review_comment?: string;
    /**
     * Agent 2 (localization) status flag.
     * 'ok'           — localization completed with no review note.
     * 'needs_review' — agent2_review_comment is present; user should inspect.
     * Absent until the localization step has run for this target.
     */
    agent2_status?: 'ok' | 'needs_review';
    /**
     * Optional Agent 2 review note.
     * Present only when agent2_status = 'needs_review'.
     * MUST NOT appear in final result rows (INV-4).
     */
    agent2_review_comment?: string;
}
/**
 * Complete run-summary state for one run.
 * Consumed by the local UI to display per-target status.
 */
export interface RunSummaryState {
    run_id: string;
    targets: RunSummaryTargetEntry[];
}
//# sourceMappingURL=types.d.ts.map