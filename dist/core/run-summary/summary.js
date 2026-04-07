"use strict";
/**
 * core/run-summary/summary.ts
 *
 * Builds run-summary state from normalized agent outputs.
 *
 * For TASK-201 this covers Agent 1 (segmentation) output only.
 * Later tasks will add localization and final-result fields.
 *
 * INV-4 compliance: review_comment flows into RunSummaryTargetEntry
 * (visible to the UI) but is not present in any result-model type.
 * INV-9 compliance: depends only on normalized contracts, not provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRunSummaryFromSegmentation = buildRunSummaryFromSegmentation;
/**
 * Builds a RunSummaryState from a normalized SegmentationResult.
 *
 * - Sets agent1_status = 'needs_review' when review_comment is present.
 * - Includes review_comment in the entry for UI display.
 * - Extracts page_numbers from regions[] to avoid re-parsing downstream.
 * - Preserves target order from the segmentation result (reading order).
 */
function buildRunSummaryFromSegmentation(result) {
    const targets = result.targets.map((t) => {
        const entry = {
            target_id: t.target_id,
            target_type: t.target_type,
            page_numbers: t.regions.map((r) => r.page_number),
            agent1_status: t.review_comment !== undefined ? 'needs_review' : 'ok',
        };
        if (t.review_comment !== undefined) {
            entry.review_comment = t.review_comment;
        }
        return entry;
    });
    return {
        run_id: result.run_id,
        targets,
    };
}
//# sourceMappingURL=summary.js.map