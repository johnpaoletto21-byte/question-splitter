"use strict";
/**
 * adapters/localization/gemini-localizer/localizer.ts
 *
 * Main Gemini localization adapter — the public entry point for Agent 2.
 *
 * Responsibilities:
 *   1. Filter prepared pages to only those relevant to the target.
 *   2. Read and base64-encode the relevant page images (local files).
 *   3. Build the localization prompt text.
 *   4. Call the Gemini generateContent REST endpoint with structured output.
 *   5. Parse the raw JSON response via parser.ts into a normalized
 *      LocalizationResult (no raw Gemini objects escape this boundary).
 *
 * The HttpPostFn is injectable so tests can mock the network call without
 * importing any provider SDK into core (INV-9 / PO-8).
 *
 * This adapter processes ONE target per call. The orchestrator's localization
 * step calls it once per SegmentationTarget in the reading order produced by
 * Agent 1 — Agent 2 never drives target order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_LOCALIZER_MODEL = void 0;
exports.encodePageImageAsBase64 = encodePageImageAsBase64;
exports.buildGeminiLocalizationRequest = buildGeminiLocalizationRequest;
exports.unwrapGeminiLocalizationResponse = unwrapGeminiLocalizationResponse;
exports.selectPagesForTarget = selectPagesForTarget;
exports.localizeTarget = localizeTarget;
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
/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 * Kept isolated and testable (same pattern as the segmentation adapter).
 */
function encodePageImageAsBase64(imagePath) {
    const buffer = (0, fs_1.readFileSync)(imagePath);
    return buffer.toString('base64');
}
// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------
/**
 * Builds the Gemini generateContent request body for one localization target.
 *
 * Sends: text prompt + one inlineData image part per relevant page (in region order).
 */
function buildGeminiLocalizationRequest(promptText, relevantPages, encodeFn = encodePageImageAsBase64) {
    const parts = [{ text: promptText }];
    for (const page of relevantPages) {
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
            responseSchema: schema_1.GEMINI_LOCALIZATION_SCHEMA,
        },
    };
}
function isLocalizationSchemaError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        err['code'] === 'LOCALIZATION_SCHEMA_INVALID');
}
function buildRepairPrompt(originalPrompt, targetId, validationMessage, invalidOutput) {
    return `${originalPrompt}

## Correction Required
Your previous localization response for target ${targetId} failed validation:
${validationMessage}

Return corrected JSON for the same target and the same page_number sequence.
Do not return an empty or placeholder bbox. Every bbox_1000 must have y_min < y_max and x_min < x_max.
Previous invalid JSON:
${JSON.stringify(invalidOutput, null, 2)}
`;
}
// ---------------------------------------------------------------------------
// Response unwrapper
// ---------------------------------------------------------------------------
/**
 * Extracts the text content from a Gemini generateContent response envelope.
 * The structured JSON output is embedded as a string in:
 *   response.candidates[0].content.parts[0].text
 */
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
// Page selection helper
// ---------------------------------------------------------------------------
/**
 * Filters the full prepared-pages list to the context needed for this target.
 * Agent 2 gets the finish page and the immediately previous page when present.
 *
 * If a required page is not found in the prepared list, an error is thrown
 * so the orchestrator can handle the missing-page failure cleanly.
 */
function selectPagesForTarget(target, allPages) {
    const finishPage = target.finish_page_number ??
        Math.max(...target.regions.map((region) => region.page_number));
    const selected = [finishPage - 1, finishPage]
        .filter((pageNumber) => pageNumber >= 1)
        .map((pageNumber) => allPages.find((p) => p.page_number === pageNumber))
        .filter((page) => page !== undefined);
    for (const region of target.regions) {
        const page = selected.find((p) => p.page_number === region.page_number);
        if (!page) {
            throw new Error(`localizeTarget: target "${target.target_id}" references ` +
                `page_number ${region.page_number} but no prepared page with that number was found`);
        }
    }
    return selected;
}
// ---------------------------------------------------------------------------
// Main adapter function
// ---------------------------------------------------------------------------
/**
 * Localizes a single segmentation target using the Gemini API.
 *
 * This is the function that implements the `Localizer` type in the orchestrator.
 * It is the only place where Gemini API specifics (endpoint, auth header,
 * request format) are known for Agent 2 — none of that leaks into core.
 *
 * @param runId          The current run_id (added to the normalized result).
 * @param target         The Agent 1 SegmentationTarget to localize.
 * @param allPages       All prepared pages for the run (filtered internally to relevant pages).
 * @param profile        Active crop target profile (target_type, max regions).
 * @param promptSnapshot Session prompt override (empty string = use built-in prompt).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              Normalized LocalizationResult for this target.
 */
async function localizeTarget(runId, target, allPages, profile, promptSnapshot, config, httpPost = defaultHttpPost, encodeFn = encodePageImageAsBase64) {
    const model = config.model ?? exports.DEFAULT_GEMINI_LOCALIZER_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const relevantPages = selectPagesForTarget(target, allPages);
    const promptText = (0, prompt_1.buildLocalizationPrompt)(target, profile, promptSnapshot);
    let currentPrompt = promptText;
    let initialValidationMessage = '';
    let lastParsedJson;
    for (let attempt = 0; attempt <= MAX_LOCALIZATION_REPAIR_RETRIES; attempt++) {
        const requestBody = buildGeminiLocalizationRequest(currentPrompt, relevantPages, encodeFn);
        const rawResponse = await httpPost(url, requestBody, {
            'Content-Type': 'application/json',
        });
        const parsedJson = unwrapGeminiLocalizationResponse(rawResponse);
        lastParsedJson = parsedJson;
        try {
            return (0, parser_1.parseGeminiLocalizationResponse)(parsedJson, runId, target, profile.max_regions_per_target);
        }
        catch (err) {
            if (!isLocalizationSchemaError(err)) {
                throw err;
            }
            const validationMessage = String(err['message'] ?? 'Localization schema invalid');
            if (initialValidationMessage === '') {
                initialValidationMessage = validationMessage;
            }
            if (attempt === MAX_LOCALIZATION_REPAIR_RETRIES) {
                throw {
                    ...err,
                    message: `${validationMessage} ` +
                        `(after ${MAX_LOCALIZATION_REPAIR_RETRIES} retries; ` +
                        `initial validation error: ${initialValidationMessage})`,
                };
            }
            currentPrompt = buildRepairPrompt(promptText, target.target_id, validationMessage, lastParsedJson);
        }
    }
    throw new Error('localizeTarget: unreachable retry loop exit');
}
//# sourceMappingURL=localizer.js.map