/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 2.
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation).
 * No repair loops — relies on Gemini structured output mode for valid JSON.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { GeminiReviewerConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_REVIEWER_MODEL = "gemini-3.1-flash-lite-preview";
export declare function reviewSegmentation(runId: string, segmentationResult: SegmentationResult, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiReviewerConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string, options?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}): Promise<SegmentationResult | null>;
//# sourceMappingURL=reviewer.d.ts.map