"use strict";
/**
 * adapters/hint-annotation/gemini-hint-overlay/annotator.ts
 *
 * Gemini adapter that returns structured annotation instructions as JSON.
 * Used by Method 2 (JSON + Canvas overlay) and Method 3 step 1 (blend).
 *
 * The model analyzes the diagram and the teacher's hint, then returns
 * drawing instructions (lines, arrows, arcs, text) in bbox_1000 coordinates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HINT_OVERLAY_MODEL = void 0;
exports.encodeImageAsBase64 = encodeImageAsBase64;
exports.buildGeminiHintOverlayRequest = buildGeminiHintOverlayRequest;
exports.unwrapGeminiOverlayResponse = unwrapGeminiOverlayResponse;
exports.getHintAnnotations = getHintAnnotations;
const fs_1 = require("fs");
const schema_1 = require("./schema");
exports.DEFAULT_HINT_OVERLAY_MODEL = 'gemini-2.5-flash-preview';
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
// Image encoding
// ---------------------------------------------------------------------------
function encodeImageAsBase64(imagePath) {
    const buffer = (0, fs_1.readFileSync)(imagePath);
    return buffer.toString('base64');
}
// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------
function buildGeminiHintOverlayRequest(promptText, imagePath, encodeFn = encodeImageAsBase64, responseSchema = schema_1.GEMINI_HINT_OVERLAY_SCHEMA) {
    return {
        contents: [
            {
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: 'image/png',
                            data: encodeFn(imagePath),
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
        },
    };
}
// ---------------------------------------------------------------------------
// Response unwrapper (same envelope as other Gemini agents)
// ---------------------------------------------------------------------------
function unwrapGeminiOverlayResponse(raw) {
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
// Response parser
// ---------------------------------------------------------------------------
function parseAnnotations(parsed) {
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Gemini overlay response is not an object');
    }
    const obj = parsed;
    const annotations = obj['annotations'];
    if (!Array.isArray(annotations)) {
        throw new Error('Gemini overlay response missing annotations array');
    }
    return annotations.filter((a) => {
        if (typeof a !== 'object' || a === null)
            return false;
        const item = a;
        return (item['type'] === 'line' ||
            item['type'] === 'arrow' ||
            item['type'] === 'arc' ||
            item['type'] === 'text');
    });
}
// ---------------------------------------------------------------------------
// Main adapter function
// ---------------------------------------------------------------------------
/**
 * Calls Gemini to get structured annotation instructions for a diagram.
 *
 * @param sourceImagePath  Absolute path to the source PNG.
 * @param promptText       Final prompt text (with hint already appended by caller).
 * @param config           Gemini API key and optional model name.
 * @param httpPost         Injectable HTTP client.
 * @param encodeFn         Injectable image encoder.
 */
async function getHintAnnotations(sourceImagePath, promptText, config, httpPost = defaultHttpPost, encodeFn = encodeImageAsBase64) {
    const model = config.model ?? exports.DEFAULT_HINT_OVERLAY_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const requestBody = buildGeminiHintOverlayRequest(promptText, sourceImagePath, encodeFn);
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiOverlayResponse(rawResponse);
    const annotations = parseAnnotations(parsedJson);
    return { annotations };
}
//# sourceMappingURL=annotator.js.map