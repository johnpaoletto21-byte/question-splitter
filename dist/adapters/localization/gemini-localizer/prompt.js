"use strict";
/**
 * adapters/localization/gemini-localizer/prompt.ts
 *
 * Constructs the localization prompt for Agent 2 (Region Localizer).
 *
 * The prompt is built from:
 *   - The single target being localized (target_id and its page regions).
 *   - The active crop target profile (for context on target_type).
 *   - An optional caller-supplied promptSnapshot (TASK-502 will wire this;
 *     when empty the built-in prompt text is used).
 *
 * Design:
 *   - The prompt scopes the model to ONE target at a time (per Boundary E).
 *   - It explicitly provides the expected page_numbers so the model can
 *     confirm its regions match what Agent 1 identified.
 *   - No provider SDK imports — pure string construction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLocalizationPrompt = buildLocalizationPrompt;
/**
 * Builds the text portion of the Gemini localization prompt for one target.
 *
 * @param target         The Agent 1 segmentation target to localize.
 * @param profile        The active crop target profile (provides target_type context).
 * @param promptSnapshot Optional session prompt override (from TASK-502 prompt store).
 *                       When non-empty this replaces the built-in instruction block.
 * @returns              Prompt text string to include as the first `text` part.
 */
function buildLocalizationPrompt(target, profile, promptSnapshot) {
    // If the caller supplied a snapshot, use it verbatim (TASK-502 hook point).
    if (promptSnapshot.trim() !== '') {
        return promptSnapshot.trim();
    }
    const regionList = target.regions
        .map((r, i) => `  - Region ${i + 1}: Page ${r.page_number}`)
        .join('\n');
    return `You are Agent 2: Region Localizer for an exam-paper processing pipeline.

## Task
Locate the exact bounding box of a single ${profile.target_type} target within the provided page image(s).
Return a bounding box for each page region listed below.

## Target
- Target ID: ${target.target_id}
- Target type: ${profile.target_type}
- Page regions to localize (in order):
${regionList}

## Bounding box format
Return bbox_1000 as [y_min, x_min, y_max, x_max] on a 0–1000 normalized scale.
  - (0, 0) is the top-left corner of the page.
  - (1000, 1000) is the bottom-right corner of the page.
  - y_min must be strictly less than y_max.
  - x_min must be strictly less than x_max.
  - All four values must be integers in [0, 1000].

## Rules
- Return exactly ${target.regions.length} region entry(s) — one per page listed above.
- Do NOT add extra regions or change the page order.
- The page_number in each region entry must match the page number given above.
- Tightly bound the ${profile.target_type} content: include the question number, all sub-parts,
  and any associated diagrams or tables, but exclude surrounding whitespace where possible.
- If the target is partially cut off or the boundary is ambiguous, include a review_comment.

Analyze the image(s) and return the bounding box location of this ${profile.target_type}.`;
}
//# sourceMappingURL=prompt.js.map