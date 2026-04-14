"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWindowLocalizationPrompt = buildWindowLocalizationPrompt;
const default_prompts_1 = require("../../../core/prompt-config-store/default-prompts");
/**
 * Builds the text portion of the Gemini localization prompt for a sliding window.
 *
 * @param questionList  The known questions from Agent 1 (question inventory).
 * @param windowSize    Number of images in this window (1-3).
 * @param profile       The active crop target profile.
 * @param promptSnapshot Optional session instruction block.
 */
function buildWindowLocalizationPrompt(questionList, windowSize, profile, promptSnapshot) {
    const instructionBlock = promptSnapshot.trim() !== ''
        ? promptSnapshot.trim()
        : default_prompts_1.DEFAULT_AGENT2_PROMPT;
    const questionListText = questionList
        .map((q) => {
        const parts = [`  - Question ${q.question_number ?? '(unknown)'}`];
        if (q.question_text) {
            parts.push(`    Text: ${q.question_text}`);
        }
        if (q.sub_questions && q.sub_questions.length > 0) {
            parts.push(`    Sub-parts: ${q.sub_questions.join(', ')}`);
        }
        return parts.join('\n');
    })
        .join('\n');
    return `${instructionBlock}

## Run Context
- Target type: ${profile.target_type}
- Number of images in this window: ${windowSize}
- Use image_position to indicate which image (1 = first, 2 = second, 3 = third).

## Known Questions (from earlier segmentation)
${questionListText}

For each question visible in the provided images, return its bounding box and which image it appears on.
`;
}
//# sourceMappingURL=prompt.js.map