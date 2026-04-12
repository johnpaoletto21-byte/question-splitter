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
function buildSegmentationPrompt(pages, profile, promptSnapshot, options = {}) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_AGENT1_PROMPT;
    const pageList = pages
        .map((p) => `  - Page ${p.page_number} (source: ${p.source_id})`)
        .join('\n');
    const focusBlock = options.focusPageNumber === undefined
        ? ''
        : `

## Focus Page Rule
- Focus page: ${options.focusPageNumber}
- Return only targets whose final visible content ends on the focus page.
- Set finish_page_number to ${options.focusPageNumber} for every returned target.
- A target may include the focus page and, if needed, the immediately previous page only.
- Allowed output region page_numbers: ${(options.allowedRegionPageNumbers ?? []).join(', ')}
- Use only the listed page_number labels from "Pages provided"; image order is not page number.
- The first provided image may be a page like 4, not page 1. Never infer page_number from image position.
- Use the next page only to decide whether a target really continues past the focus page; do not return targets that end after the focus page.
- The next page is context only and must not appear in regions.
- If no target ends on the focus page, return an empty targets array.`;
    const extractionFields = options.extractionFields ?? [];
    const fieldBlock = extractionFields.length === 0
        ? ''
        : `

## Custom Boolean Extraction Fields
For every returned target, include extraction_fields with exactly these boolean keys:
${extractionFields.map((field) => `- ${field.key}: ${field.description}`).join('\n')}`;
    return `${instructionBlock}

## Run Context
- Target type: ${profile.target_type}
- Maximum page regions per target: ${profile.max_regions_per_target}
${focusBlock}
${fieldBlock}

## Pages provided (in order)
${pageList}
`;
}
//# sourceMappingURL=prompt.js.map