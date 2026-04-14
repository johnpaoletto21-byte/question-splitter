"use strict";
/**
 * adapters/segmentation/gemini-segmenter/segmenter.ts
 *
 * Main Gemini segmentation adapter — the public entry point for Agent 1.
 *
 * Responsibilities:
 *   1. Read and base64-encode prepared page images (local files).
 *   2. Build the prompt text.
 *   3. Call the Gemini generateContent REST endpoint with structured output.
 *   4. Parse the raw JSON response via parser.ts into a normalized
 *      SegmentationResult (question inventory — no regions).
 *
 * No repair loops — relies on Gemini structured output mode for valid JSON.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_SEGMENTER_MODEL = void 0;
exports.encodePageImageAsBase64 = encodePageImageAsBase64;
exports.buildGeminiRequest = buildGeminiRequest;
exports.unwrapGeminiResponse = unwrapGeminiResponse;
exports.segmentPages = segmentPages;
const fs_1 = require("fs");
const prompt_1 = require("./prompt");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_SEGMENTER_MODEL = 'gemini-3.1-flash-lite-preview';
// ---------------------------------------------------------------------------
// Default HTTP client (native fetch, Node.js 18+)
// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------
// Image encoding
// ---------------------------------------------------------------------------
/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 */
function encodePageImageAsBase64(imagePath) {
    const buffer = (0, fs_1.readFileSync)(imagePath);
    return buffer.toString('base64');
}
// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------
/**
 * Builds the Gemini generateContent request body.
 */
function buildGeminiRequest(promptText, pages, encodeFn = encodePageImageAsBase64, responseSchema = schema_1.GEMINI_SEGMENTATION_SCHEMA) {
    const parts = [{ text: promptText }];
    for (const page of pages) {
        parts.push({
            inline_data: {
                mime_type: 'image/png',
                data: encodeFn(page.image_path),
            },
        });
    }
    return {
        contents: [{ parts }],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
        },
    };
}
// ---------------------------------------------------------------------------
// Response unwrapper
// ---------------------------------------------------------------------------
/**
 * Extracts the text content from a Gemini generateContent response envelope.
 * The structured JSON output is embedded as a string in:
 *   response.candidates[0].content.parts[0].text
 */
function unwrapGeminiResponse(raw) {
    if (typeof raw !== 'object' ||
        raw === null ||
        !Array.isArray(raw['candidates'])) {
        throw new Error('Gemini response missing candidates array');
    }
    const candidates = raw['candidates'];
    const first = candidates[0];
    if (!first || typeof first !== 'object') {
        throw new Error('Gemini response has no candidates');
    }
    const content = first['content'];
    if (!content || !Array.isArray(content['parts'])) {
        throw new Error('Gemini response candidate missing content.parts');
    }
    const parts = content['parts'];
    const text = parts[0]?.['text'];
    if (typeof text !== 'string') {
        throw new Error('Gemini response first part is not a text string');
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error(`Gemini response text is not valid JSON: ${text}`);
    }
}
// ---------------------------------------------------------------------------
// Main adapter function
// ---------------------------------------------------------------------------
/**
 * Segments a set of prepared page images using the Gemini API.
 * Returns a question inventory (no regions — localization is separate).
 */
async function segmentPages(runId, pages, profile, promptSnapshot, config, httpPost = defaultHttpPost, encodeFn = encodePageImageAsBase64, options = {}) {
    const model = config.model ?? exports.DEFAULT_GEMINI_SEGMENTER_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const extractionFields = options.extractionFields ?? [];
    const promptText = (0, prompt_1.buildSegmentationPrompt)(pages, profile, promptSnapshot, {
        extractionFields,
        chunkStartPage: options.chunkStartPage,
        chunkEndPage: options.chunkEndPage,
    });
    const responseSchema = (0, schema_1.buildGeminiSegmentationSchema)({
        extractionFields,
    });
    const requestBody = buildGeminiRequest(promptText, pages, encodeFn, responseSchema);
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiResponse(rawResponse);
    return (0, parser_1.parseGeminiSegmentationResponse)(parsedJson, runId, { extractionFields });
}
//# sourceMappingURL=segmenter.js.map