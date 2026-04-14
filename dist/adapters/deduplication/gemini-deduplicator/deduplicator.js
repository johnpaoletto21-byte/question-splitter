"use strict";
/**
 * adapters/deduplication/gemini-deduplicator/deduplicator.ts
 *
 * Main Gemini deduplication adapter — the public entry point for Agent 4.
 *
 * This is a text-only agent (no images). It receives JSON describing all
 * localized targets from all chunks and returns a deduplicated list.
 * No repair loops — relies on Gemini structured output mode.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_DEDUPLICATOR_MODEL = void 0;
exports.deduplicateTargets = deduplicateTargets;
const prompt_1 = require("./prompt");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_DEDUPLICATOR_MODEL = 'gemini-3.1-flash-lite-preview';
// ---------------------------------------------------------------------------
// Default HTTP client
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
// Response unwrapper (same pattern as other adapters)
// ---------------------------------------------------------------------------
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
 * Deduplicates targets across chunks using the Gemini API.
 * Text-only — no images are sent.
 */
async function deduplicateTargets(input, promptSnapshot, config, httpPost = defaultHttpPost) {
    const model = config.model ?? exports.DEFAULT_GEMINI_DEDUPLICATOR_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const promptText = (0, prompt_1.buildDeduplicationPrompt)(input, promptSnapshot);
    const requestBody = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema_1.GEMINI_DEDUPLICATION_SCHEMA,
        },
    };
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiResponse(rawResponse);
    return (0, parser_1.parseGeminiDeduplicationResponse)(parsedJson, input.run_id);
}
//# sourceMappingURL=deduplicator.js.map