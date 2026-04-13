/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 1.5.
 * Reuses shared Gemini utilities from the segmenter adapter.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { GeminiReviewerConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_REVIEWER_MODEL = "gemini-3.1-flash-lite-preview";
export declare function reviewSegmentation(runId: string, segmentationResult: SegmentationResult, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiReviewerConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string, options?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
    maxRepairRetries?: number;
}): Promise<SegmentationResult | null>;
//# sourceMappingURL=reviewer.d.ts.map