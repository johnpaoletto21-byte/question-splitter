/**
 * adapters/segmentation/gemini-segmenter/prompt.ts
 *
 * Constructs the segmentation prompt for Agent 1.
 *
 * The prompt is built from:
 *   - The target type and max region count from the active profile.
 *   - The ordered list of page numbers being analyzed.
 *   - An optional caller-supplied promptSnapshot (TASK-502 will wire this;
 *     when empty the built-in prompt text is used in full).
 *
 * No provider SDK imports — this is pure string construction.
 */
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
/**
 * Builds the text portion of the Gemini segmentation prompt.
 *
 * @param pages          Ordered prepared page images included in this call.
 * @param profile        The active crop target profile (target_type, max regions).
 * @param promptSnapshot Optional session prompt override (from TASK-502 prompt store).
 *                       When non-empty this replaces the built-in instruction block.
 * @returns              Prompt text string to include as the first `text` part.
 */
export declare function buildSegmentationPrompt(pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string): string;
//# sourceMappingURL=prompt.d.ts.map