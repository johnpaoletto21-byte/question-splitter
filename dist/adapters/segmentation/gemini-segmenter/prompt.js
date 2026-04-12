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
const default_prompts_1 = require("../../../core/prompt-config-store/default-prompts");
/**
 * Builds the text portion of the Gemini segmentation prompt.
 *
 * @param pages          Ordered prepared page images included in this call.
 * @param profile        The active crop target profile (target_type, max regions).
 * @param promptSnapshot Optional session instruction block (from TASK-502 prompt store).
 *                       When empty, the built-in default instruction block is used.
 * @returns              Prompt text string to include as the first `text` part.
 */
function buildSegmentationPrompt(pages, profile, promptSnapshot) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_AGENT1_PROMPT;
    const pageList = pages
        .map((p) => `  - Page ${p.page_number} (source: ${p.source_id})`)
        .join('\n');
    return `${instructionBlock}

## Run Context
- Target type: ${profile.target_type}
- Maximum page regions per target: ${profile.max_regions_per_target}

## Pages provided (in order)
${pageList}
`;
}
//# sourceMappingURL=prompt.js.map