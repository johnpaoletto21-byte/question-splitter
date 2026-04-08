"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSegmentationPrompt = buildSegmentationPrompt;
/**
 * Builds the text portion of the Gemini segmentation prompt.
 *
 * @param pages          Ordered prepared page images included in this call.
 * @param profile        The active crop target profile (target_type, max regions).
 * @param promptSnapshot Optional session prompt override (from TASK-502 prompt store).
 *                       When non-empty this replaces the built-in instruction block.
 * @returns              Prompt text string to include as the first `text` part.
 */
function buildSegmentationPrompt(pages, profile, promptSnapshot) {
    // If the caller supplied a snapshot, use it verbatim (TASK-502 hook point).
    if (promptSnapshot.trim() !== '') {
        return promptSnapshot.trim();
    }
    const pageList = pages
        .map((p) => `  - Page ${p.page_number} (source: ${p.source_id})`)
        .join('\n');
    return `You are Agent 1: Question Segmenter for an exam-paper processing pipeline.

## Task
Identify every distinct parent ${profile.target_type} in the provided page images.
Return them as an ordered list in reading order (top of page 1 first, bottom of last page last).

## Rules
- A parent ${profile.target_type} is a self-contained item that may have sub-parts (a, b, c…)
  but all sub-parts belong to the same parent target.
- Each target occupies 1 or 2 pages. Maximum ${profile.max_regions_per_target} page regions per target.
- If a target spans more than ${profile.max_regions_per_target} pages, include only the first
  ${profile.max_regions_per_target} pages and add a review_comment explaining the situation.
- Return only page numbers for each region — do not return crop dimensions or image offsets.
- Use target_type = "${profile.target_type}" for every target.
- If you are uncertain about a boundary, include a brief review_comment on that target.

## Pages provided (in order)
${pageList}

Analyze the images and return the complete ordered list of ${profile.target_type} targets.`;
}
//# sourceMappingURL=prompt.js.map