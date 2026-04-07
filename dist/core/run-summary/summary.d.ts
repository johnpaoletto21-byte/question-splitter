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
import type { SegmentationResult } from '../segmentation-contract/types';
import type { RunSummaryState } from './types';
/**
 * Builds a RunSummaryState from a normalized SegmentationResult.
 *
 * - Sets agent1_status = 'needs_review' when review_comment is present.
 * - Includes review_comment in the entry for UI display.
 * - Extracts page_numbers from regions[] to avoid re-parsing downstream.
 * - Preserves target order from the segmentation result (reading order).
 */
export declare function buildRunSummaryFromSegmentation(result: SegmentationResult): RunSummaryState;
//# sourceMappingURL=summary.d.ts.map