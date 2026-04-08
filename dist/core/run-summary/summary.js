"use strict";
/**
 * core/run-summary/summary.ts
 *
 * Builds and updates run-summary state from normalized agent outputs.
 *
 * TASK-201: buildRunSummaryFromSegmentation — Agent 1 (segmentation) output.
 * TASK-301: applyLocalizationToSummary — Agent 2 (localization) output.
 * Later tasks will add final-result fields.
 *
 * INV-4 compliance: review_comment fields flow into RunSummaryTargetEntry
 * (visible to the UI) but are not present in any result-model type.
 * INV-9 compliance: depends only on normalized contracts, not provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRunSummaryFromSegmentation = buildRunSummaryFromSegmentation;
exports.applyLocalizationToSummary = applyLocalizationToSummary;
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
/**
 * Returns a new RunSummaryState with the target entry for the given
 * LocalizationResult updated to include Agent 2 status fields.
 *
 * - Sets agent2_status = 'needs_review' when review_comment is present.
 * - Carries agent2_review_comment for UI display (INV-4: not in result rows).
 * - Returns a new state object; does not mutate the input.
 * - Throws if the target_id from the localization result is not found in the
 *   summary state (indicates a contract violation upstream).
 *
 * @param state   Current RunSummaryState (from buildRunSummaryFromSegmentation).
 * @param result  Normalized LocalizationResult for one target.
 * @returns       Updated RunSummaryState with agent2 fields set for that target.
 * @throws        Error if result.target_id is not found in state.targets.
 */
function applyLocalizationToSummary(state, result) {
    const index = state.targets.findIndex((t) => t.target_id === result.target_id);
    if (index === -1) {
        throw new Error(`applyLocalizationToSummary: target_id "${result.target_id}" not found in summary state. ` +
            'Ensure buildRunSummaryFromSegmentation was called before applying localization results.');
    }
    const updatedEntry = {
        ...state.targets[index],
        agent2_status: result.review_comment !== undefined ? 'needs_review' : 'ok',
    };
    if (result.review_comment !== undefined) {
        updatedEntry.agent2_review_comment = result.review_comment;
    }
    const updatedTargets = [
        ...state.targets.slice(0, index),
        updatedEntry,
        ...state.targets.slice(index + 1),
    ];
    return {
        ...state,
        targets: updatedTargets,
    };
}
//# sourceMappingURL=summary.js.map