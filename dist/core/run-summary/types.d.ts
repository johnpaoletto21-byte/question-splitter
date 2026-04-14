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
import type { ExtractionFieldDefinition } from '../extraction-fields';
import type { DebugData } from './debug-types';
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
    /** Ordered list of page numbers covered by this target (from localization). */
    page_numbers: number[];
    /** Run-scoped custom boolean values produced by Agent 1. */
    extraction_fields?: Record<string, boolean>;
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
    /**
     * Final pipeline outcome for this target.
     * 'ok'     — composition (and optional upload) succeeded.
     * 'failed' — one of: crop, composition, or upload failed.
     * Absent until applyFinalResultsToSummary has been called.
     */
    final_status?: 'ok' | 'failed';
    /**
     * Google Drive share URL.
     * Present only when final_status = 'ok' and upload succeeded.
     * MUST NOT appear in result-model rows (INV-4 — that contract uses drive_url
     * on FinalResultOk, which is a different, clean payload type).
     */
    drive_url?: string;
    /** Google Drive file ID, used for traceability and external links. */
    drive_file_id?: string;
    /** Absolute path to the local output image for preview/recovery. */
    local_output_path?: string;
    /** Local app URL that serves the output image preview. */
    preview_url?: string;
    /**
     * Stable failure code from Layer B §5.2.
     * Present only when final_status = 'failed'.
     * Mirrors FinalResultFailed.failure_code for display purposes.
     */
    failure_code?: string;
    /**
     * Human-readable failure reason.
     * Present only when final_status = 'failed'.
     */
    failure_message?: string;
}
/**
 * Complete run-summary state for one run.
 * Consumed by the local UI to display per-target status.
 */
export interface RunSummaryState {
    run_id: string;
    extraction_fields?: ExtractionFieldDefinition[];
    targets: RunSummaryTargetEntry[];
    /** Temporary pipeline debug data. Omit in production. */
    debugData?: DebugData;
}
//# sourceMappingURL=types.d.ts.map