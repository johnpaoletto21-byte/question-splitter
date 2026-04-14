"use strict";
/**
 * adapters/diagram-detection/gemini-diagram-detector/detector.ts
 *
 * Main Gemini adapter for Agent D (Diagram Detector).
 *
 * Receives ONE source image (a previously cropped exam question) and returns
 * one bbox per diagram detected. Mirrors the structure of the existing
 * Agent 1 segmenter and Agent 3 localizer adapters.
 *
 * No repair retries here — the schema constrains the response shape and
 * downstream `validateBbox` (in core/crop-engine/bbox.ts) gates any bad bbox
 * before image I/O, so an occasional bogus value just becomes a per-diagram
 * failed result instead of killing the run.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL = void 0;
exports.encodeImageAsBase64 = encodeImageAsBase64;
exports.buildGeminiDiagramDetectionRequest = buildGeminiDiagramDetectionRequest;
exports.unwrapGeminiDiagramResponse = unwrapGeminiDiagramResponse;
exports.detectDiagrams = detectDiagrams;
const fs_1 = require("fs");
const parser_1 = require("./parser");
const schema_1 = require("./schema");
exports.DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL = 'gemini-3.1-flash-lite-preview';
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
function encodeImageAsBase64(imagePath) {
    const buffer = (0, fs_1.readFileSync)(imagePath);
    return buffer.toString('base64');
}
// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------
function buildGeminiDiagramDetectionRequest(promptText, imagePath, encodeFn = encodeImageAsBase64, responseSchema = schema_1.GEMINI_DIAGRAM_DETECTOR_SCHEMA) {
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
// Response unwrapper (same envelope shape as Agent 1 / Agent 3)
// ---------------------------------------------------------------------------
function unwrapGeminiDiagramResponse(raw) {
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
 * Calls Gemini Vision to detect diagrams in a single source image.
 *
 * @param sourceImagePath  Absolute path to the PNG to analyze.
 * @param promptText       Final prompt text (caller resolves snapshot vs. default).
 * @param config           Gemini API key and optional model name.
 * @param httpPost         Injectable HTTP client (defaults to native fetch).
 * @param encodeFn         Injectable image encoder (defaults to readFileSync+base64).
 * @returns                Normalized DiagramDetectionResult.
 */
async function detectDiagrams(sourceImagePath, promptText, config, httpPost = defaultHttpPost, encodeFn = encodeImageAsBase64) {
    const model = config.model ?? exports.DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const requestBody = buildGeminiDiagramDetectionRequest(promptText, sourceImagePath, encodeFn);
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiDiagramResponse(rawResponse);
    return (0, parser_1.parseGeminiDiagramDetectionResponse)(parsedJson, sourceImagePath);
}
//# sourceMappingURL=detector.js.map