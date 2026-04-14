"use strict";
/**
 * adapters/localization/gemini-localizer/localizer.ts
 *
 * Main Gemini localization adapter — the public entry point for Agent 3.
 *
 * Processes ONE sliding window (1-3 images) per call. Agent 3 identifies
 * which questions from the known list appear in the window and returns
 * bounding boxes. The localizer keeps repair retries (up to 2x) because
 * bbox values have semantic constraints that the schema can't enforce.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_LOCALIZER_MODEL = void 0;
exports.encodePageImageAsBase64 = encodePageImageAsBase64;
exports.buildGeminiLocalizationRequest = buildGeminiLocalizationRequest;
exports.unwrapGeminiLocalizationResponse = unwrapGeminiLocalizationResponse;
exports.localizeWindow = localizeWindow;
const fs_1 = require("fs");
const prompt_1 = require("./prompt");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_LOCALIZER_MODEL = 'gemini-3.1-flash-lite-preview';
const MAX_LOCALIZATION_REPAIR_RETRIES = 2;
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
function encodePageImageAsBase64(imagePath) {
    const buffer = (0, fs_1.readFileSync)(imagePath);
    return buffer.toString('base64');
}
// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------
function buildGeminiLocalizationRequest(promptText, windowPages, encodeFn = encodePageImageAsBase64, responseSchema = schema_1.GEMINI_LOCALIZATION_SCHEMA) {
    const parts = [{ text: promptText }];
    for (const page of windowPages) {
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
function isLocalizationSchemaError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        err['code'] === 'LOCALIZATION_SCHEMA_INVALID');
}
function buildRepairPrompt(originalPrompt, validationMessage, invalidOutput) {
    return `${originalPrompt}

## Correction Required
Your previous localization response failed validation:
${validationMessage}

Return corrected JSON for the same images.
Do not return an empty or placeholder bbox. Every bbox_1000 must have y_min < y_max and x_min < x_max.
IMPORTANT: Include the ENTIRE question content including all diagrams and figures — never cut off images.
Previous invalid JSON:
${JSON.stringify(invalidOutput, null, 2)}
`;
}
// ---------------------------------------------------------------------------
// Response unwrapper
// ---------------------------------------------------------------------------
function unwrapGeminiLocalizationResponse(raw) {
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
 * Localizes questions in a sliding window of 1-3 page images.
 *
 * @param runId          The current run_id.
 * @param questionList   Known questions from Agent 1 (question inventory).
 * @param windowPages    The 1-3 PreparedPageImage objects for this window.
 * @param profile        Active crop target profile.
 * @param promptSnapshot Session prompt override (empty = built-in).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              WindowLocalizationResult with regions found in this window.
 */
async function localizeWindow(runId, questionList, windowPages, profile, promptSnapshot, config, httpPost = defaultHttpPost, encodeFn = encodePageImageAsBase64) {
    const model = config.model ?? exports.DEFAULT_GEMINI_LOCALIZER_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const responseSchema = (0, schema_1.buildGeminiLocalizationSchema)(windowPages.length);
    const promptText = (0, prompt_1.buildWindowLocalizationPrompt)(questionList, windowPages.length, profile, promptSnapshot);
    let currentPrompt = promptText;
    let lastParsedJson;
    for (let attempt = 0; attempt <= MAX_LOCALIZATION_REPAIR_RETRIES; attempt++) {
        const requestBody = buildGeminiLocalizationRequest(currentPrompt, windowPages, encodeFn, responseSchema);
        const rawResponse = await httpPost(url, requestBody, {
            'Content-Type': 'application/json',
        });
        const parsedJson = unwrapGeminiLocalizationResponse(rawResponse);
        lastParsedJson = parsedJson;
        try {
            return (0, parser_1.parseWindowLocalizationResponse)(parsedJson, runId, windowPages);
        }
        catch (err) {
            if (!isLocalizationSchemaError(err)) {
                throw err;
            }
            const validationMessage = String(err['message'] ?? 'Localization schema invalid');
            if (attempt === MAX_LOCALIZATION_REPAIR_RETRIES) {
                throw {
                    ...err,
                    message: `${validationMessage} (after ${MAX_LOCALIZATION_REPAIR_RETRIES} retries)`,
                };
            }
            currentPrompt = buildRepairPrompt(promptText, validationMessage, lastParsedJson);
        }
    }
    throw new Error('localizeWindow: unreachable retry loop exit');
}
//# sourceMappingURL=localizer.js.map