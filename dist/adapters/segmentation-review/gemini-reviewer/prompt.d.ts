/**
 * adapters/segmentation-review/gemini-reviewer/prompt.ts
 *
 * Constructs the review prompt for Agent 1.5.
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