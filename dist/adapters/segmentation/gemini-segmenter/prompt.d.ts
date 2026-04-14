/**
 * adapters/segmentation/gemini-segmenter/prompt.ts
 *
 * Constructs the segmentation prompt for Agent 1.
 *
 * Agent 1 produces a question inventory — an ordered list of questions.
 * No page/region information is requested from the model.
 *
 * No provider SDK imports — this is pure string construction.
 */
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export interface BuildSegmentationPromptOptions {
    /** First page number in the current chunk. */
    chunkStartPage?: number;
    /** Last page number in the current chunk. */
    chunkEndPage?: number;
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
/**
 * Builds the text portion of the Gemini segmentation prompt.
 */
export declare function buildSegmentationPrompt(pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, options?: BuildSegmentationPromptOptions): string;
//# sourceMappingURL=prompt.d.ts.map