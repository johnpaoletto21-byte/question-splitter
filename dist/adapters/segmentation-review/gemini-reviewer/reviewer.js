"use strict";
/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 1.5.
 * Reuses shared Gemini utilities from the segmenter adapter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_REVIEWER_MODEL = void 0;
exports.reviewSegmentation = reviewSegmentation;
const segmenter_1 = require("../../segmentation/gemini-segmenter/segmenter");
const prompt_1 = require("./prompt");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_REVIEWER_MODEL = 'gemini-3.1-flash-lite-preview';
const MAX_REVIEW_REPAIR_RETRIES = 2;
const defaultHttpPost = async (url, body, headers) => {
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '(no body)');
        throw new Error(`Gemini API error: HTTP ${response.status} — ${text}`);
    }
    return response.json();
};
function isSegmentationSchemaError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        err['code'] === 'SEGMENTATION_SCHEMA_INVALID');
}
function buildRepairPrompt(originalPrompt, validationMessage, invalidOutput) {
    return `${originalPrompt}

## Correction Required
Your previous review response failed validation:
${validationMessage}

Return corrected JSON. Use verdict "pass" if Agent 1 was correct, or verdict "corrected" with a valid targets array.
- Every target must have finish_page_number set to the last page with visible content.
- Do not include bbox_1000 in regions.
- Maximum 2 regions per target.

Previous invalid JSON:
${JSON.stringify(invalidOutput, null, 2)}
`;
}
async function reviewSegmentation(runId, segmentationResult, pages, profile, promptSnapshot, config, httpPost = defaultHttpPost, encodeFn = segmenter_1.encodePageImageAsBase64, options = {}) {
    const model = config.model ?? exports.DEFAULT_GEMINI_REVIEWER_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const extractionFields = options.extractionFields ?? [];
    const promptText = (0, prompt_1.buildReviewPrompt)(pages, profile, promptSnapshot, segmentationResult, {
        extractionFields,
    });
    const responseSchema = (0, schema_1.buildGeminiReviewSchema)({ extractionFields });
    const maxRepairRetries = options.maxRepairRetries ?? MAX_REVIEW_REPAIR_RETRIES;
    let currentPrompt = promptText;
    let initialValidationMessage = '';
    for (let attempt = 0; attempt <= maxRepairRetries; attempt++) {
        const requestBody = (0, segmenter_1.buildGeminiRequest)(currentPrompt, pages, encodeFn, responseSchema);
        const rawResponse = await httpPost(url, requestBody, {
            'Content-Type': 'application/json',
        });
        const parsedJson = (0, segmenter_1.unwrapGeminiResponse)(rawResponse);
        try {
            return (0, parser_1.parseGeminiReviewResponse)(parsedJson, runId, profile.max_regions_per_target, { extractionFields });
        }
        catch (err) {
            if (!isSegmentationSchemaError(err)) {
                throw err;
            }
            const validationMessage = String(err['message'] ?? 'Review schema invalid');
            if (initialValidationMessage === '') {
                initialValidationMessage = validationMessage;
            }
            if (attempt === maxRepairRetries) {
                throw {
                    ...err,
                    message: `${validationMessage} ` +
                        `(after ${maxRepairRetries} retries; ` +
                        `initial validation error: ${initialValidationMessage})`,
                };
            }
            currentPrompt = buildRepairPrompt(promptText, validationMessage, parsedJson);
        }
    }
    throw new Error('reviewSegmentation: unreachable retry loop exit');
}
//# sourceMappingURL=reviewer.js.map