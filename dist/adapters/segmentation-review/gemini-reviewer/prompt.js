"use strict";
/**
 * adapters/segmentation-review/gemini-reviewer/prompt.ts
 *
 * Constructs the review prompt for Agent 1.5.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReviewPrompt = buildReviewPrompt;
const default_prompts_1 = require("../../../core/prompt-config-store/default-prompts");
function buildReviewPrompt(pages, profile, promptSnapshot, segmentationResult, options = {}) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_REVIEWER_PROMPT;
    const pageList = pages
        .map((p) => `  - Page ${p.page_number} (source: ${p.source_id})`)
        .join('\n');
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
- Maximum page regions per target: ${profile.max_regions_per_target}
${fieldBlock}

## Pages provided (in order)
${pageList}

## Agent 1 Segmentation Output (to review)
${targetsJson}
`;
}
//# sourceMappingURL=prompt.js.map