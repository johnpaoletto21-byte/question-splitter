"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReviewPrompt = buildReviewPrompt;
const default_prompts_1 = require("../../../core/prompt-config-store/default-prompts");
function buildReviewPrompt(pages, profile, promptSnapshot, segmentationResult, options = {}) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_REVIEWER_PROMPT;
    // Show Agent 1's question list (no regions to convert)
    const targetsJson = JSON.stringify(segmentationResult.targets, null, 2);
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
- Number of page images provided: ${pages.length}
${fieldBlock}

## Agent 1 Question List (to review)
${targetsJson}
`;
}
//# sourceMappingURL=prompt.js.map