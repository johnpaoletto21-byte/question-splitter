/**
 * adapters/localization/gemini-localizer/prompt.ts
 *
 * Constructs the localization prompt for Agent 3 (Region Localizer).
 *
 * Agent 3 receives a sliding window of 1-3 page images and a list of
 * known questions. It identifies which questions are visible and returns
 * bounding boxes. No page numbers are mentioned — only image positions
 * (1st, 2nd, 3rd image).
 */
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
/**
 * Builds the text portion of the Gemini localization prompt for a sliding window.
 *
 * @param questionList  The known questions from Agent 1 (question inventory).
 * @param windowSize    Number of images in this window (1-3).
 * @param profile       The active crop target profile.
 * @param promptSnapshot Optional session instruction block.
 */
export declare function buildWindowLocalizationPrompt(questionList: ReadonlyArray<SegmentationTarget>, windowSize: number, profile: CropTargetProfile, promptSnapshot: string): string;
//# sourceMappingURL=prompt.d.ts.map