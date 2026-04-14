/**
 * adapters/segmentation-review/gemini-reviewer/prompt.ts
 *
 * Constructs the review prompt for Agent 2 (reviewer).
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation output).
 *
 * The reviewer reviews Agent 1's question inventory (no regions/page info).
 * It verifies question_number accuracy, split/merge correctness, and filters
 * non-question content.
 */
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export interface BuildReviewPromptOptions {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
export declare function buildReviewPrompt(pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, segmentationResult: SegmentationResult, options?: BuildReviewPromptOptions): string;
//# sourceMappingURL=prompt.d.ts.map