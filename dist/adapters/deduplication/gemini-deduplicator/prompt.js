"use strict";
/**
 * adapters/deduplication/gemini-deduplicator/prompt.ts
 *
 * Constructs the deduplication prompt for Agent 4.
 * This is a text-only agent — receives JSON, no images.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeduplicationPrompt = buildDeduplicationPrompt;
const default_prompts_1 = require("../../../core/prompt-config-store/default-prompts");
/**
 * Builds the text prompt for the deduplication agent.
 */
function buildDeduplicationPrompt(input, promptSnapshot) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_DEDUPLICATOR_PROMPT;
    const inputJson = JSON.stringify({
        chunks: input.chunks,
        overlap_zones: input.overlap_zones,
    }, null, 2);
    return `${instructionBlock}

## Input Data
${inputJson}

Analyze the input and return the deduplicated targets with a merge log.`;
}
//# sourceMappingURL=prompt.js.map