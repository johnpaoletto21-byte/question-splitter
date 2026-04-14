"use strict";
/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 2.
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation).
 * No repair loops — relies on Gemini structured output mode for valid JSON.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_REVIEWER_MODEL = void 0;
exports.reviewSegmentation = reviewSegmentation;
const segmenter_1 = require("../../segmentation/gemini-segmenter/segmenter");
const prompt_1 = require("./prompt");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_REVIEWER_MODEL = 'gemini-3.1-flash-lite-preview';
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
async function reviewSegmentation(runId, segmentationResult, pages, profile, promptSnapshot, config, httpPost = defaultHttpPost, encodeFn = segmenter_1.encodePageImageAsBase64, options = {}) {
    const model = config.model ?? exports.DEFAULT_GEMINI_REVIEWER_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const extractionFields = options.extractionFields ?? [];
    const promptText = (0, prompt_1.buildReviewPrompt)(pages, profile, promptSnapshot, segmentationResult, {
        extractionFields,
    });
    const responseSchema = (0, schema_1.buildGeminiReviewSchema)({
        extractionFields,
    });
    const requestBody = (0, segmenter_1.buildGeminiRequest)(promptText, pages, encodeFn, responseSchema);
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const parsedJson = (0, segmenter_1.unwrapGeminiResponse)(rawResponse);
    return (0, parser_1.parseGeminiReviewResponse)(parsedJson, runId, profile.max_regions_per_target, { extractionFields });
}
//# sourceMappingURL=reviewer.js.map