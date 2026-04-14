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
import type { SegmentationResult } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';
import type { FinalResultRow } from '../result-model/types';
import type { RunSummaryState } from './types';
import type { ExtractionFieldDefinition } from '../extraction-fields';
/**
 * Builds a RunSummaryState from a normalized SegmentationResult plus
 * optional localization results (for page_numbers).
 *
 * - Sets agent1_status = 'needs_review' when review_comment is present.
 * - Includes review_comment in the entry for UI display.
 * - page_numbers come from localizedResults if provided, otherwise empty.
 * - Preserves target order from the segmentation result (reading order).
 */
export declare function buildRunSummaryFromSegmentation(result: SegmentationResult, extractionFields?: ReadonlyArray<ExtractionFieldDefinition>, localizedResults?: ReadonlyArray<LocalizationResult>): RunSummaryState;
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
export declare function applyLocalizationToSummary(state: RunSummaryState, result: LocalizationResult): RunSummaryState;
/**
 * Returns a new RunSummaryState with each target entry updated to reflect
 * the final pipeline outcome (composition + optional upload).
 *
 * - Sets final_status = 'ok' | 'failed' from FinalResultRow.status.
 * - Carries drive_url when upload succeeded (FinalResultOk.drive_url).
 * - Carries failure_code and failure_message when the target failed.
 * - Returns a new state object; does not mutate the input.
 * - Throws if any row.target_id is not found in state.targets (contract violation).
 *
 * INV-4 compliance: review_comment stays in RunSummaryTargetEntry (already set by
 * prior steps) and is never written back into any FinalResultRow shape.
 * INV-8 compliance: all rows are processed; one failed target does not hide others.
 *
 * @param state  Current RunSummaryState (after localization step at minimum).
 * @param rows   FinalResultRow[] from runUploadStep (or runCompositionStep if
 *               no upload was performed).
 * @returns      Updated RunSummaryState with final_status and optional drive_url /
 *               failure fields set for every target.
 * @throws       Error if any row.target_id is not found in state.targets.
 */
export declare function applyFinalResultsToSummary(state: RunSummaryState, rows: FinalResultRow[]): RunSummaryState;
//# sourceMappingURL=summary.d.ts.map