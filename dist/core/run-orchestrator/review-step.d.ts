/**
 * core/run-orchestrator/review-step.ts
 *
 * Orchestrator step that invokes Agent 1.5 segmentation review and returns
 * either a corrected SegmentationResult or the original (if the reviewer
 * determined Agent 1's output was correct).
 *
 * Design (mirrors segmentation-step.ts pattern):
 *   - The actual reviewer is injected as a `SegmentationReviewer` function so
 *     that core stays free of provider SDK imports (INV-9 / PO-8).
 *   - `adapters/segmentation-review/gemini-reviewer` implements the type.
 *   - The reviewer sees all pages (no windowing) and the merged Agent 1 result.
 *   - Returns null for "pass" (Agent 1 output correct), or a corrected
 *     SegmentationResult. The orchestrator step converts null → original.
 */
import type { PreparedPageImage } from '../source-model/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { SegmentationResult } from '../segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../extraction-fields';
export interface ReviewCallOptions {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
/**
 * Contract for a segmentation reviewer function.
 * Implemented in `adapters/segmentation-review/gemini-reviewer`.
 *
 * Returns null when Agent 1's output is correct ("pass"), or a corrected
 * SegmentationResult when corrections were needed.
 */
export type SegmentationReviewer = (runId: string, segmentationResult: SegmentationResult, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, options?: ReviewCallOptions) => Promise<SegmentationResult | null>;
/**
 * Runs the Agent 1.5 segmentation review step.
 *
 * Calls the injected reviewer with the merged Agent 1 result and all prepared
 * pages. If the reviewer returns null ("pass"), the original segmentation is
 * returned unchanged. Otherwise the corrected result replaces it.
 */
export declare function runReviewStep(runId: string, segmentationResult: SegmentationResult, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, reviewer: SegmentationReviewer, options?: ReviewCallOptions): Promise<SegmentationResult>;
//# sourceMappingURL=review-step.d.ts.map