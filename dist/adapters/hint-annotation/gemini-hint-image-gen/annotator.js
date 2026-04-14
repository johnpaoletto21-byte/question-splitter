"use strict";
/**
 * adapters/hint-annotation/gemini-hint-image-gen/annotator.ts
 *
 * Gemini adapter for hint annotation via image generation.
 * Sends a source PNG + prompt to Gemini and receives an annotated image back.
 *
 * Used by Method 1 (pure image generation) and Method 3 step 2 (blend render).
 * The model accepts a reference image and returns a modified version with
 * annotations drawn on top.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HINT_IMAGE_GEN_MODEL = void 0;
exports.encodeImageAsBase64 = encodeImageAsBase64;
exports.buildGeminiHintImageGenRequest = buildGeminiHintImageGenRequest;
exports.unwrapGeminiImageResponse = unwrapGeminiImageResponse;
exports.generateHintImage = generateHintImage;
const fs_1 = require("fs");
exports.DEFAULT_HINT_IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';
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
function buildGeminiHintImageGenRequest(promptText, imagePath, encodeFn = encodeImageAsBase64) {
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
            responseModalities: ['IMAGE', 'TEXT'],
        },
    };
}
function unwrapGeminiImageResponse(raw) {
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
    // Look for a part with inline_data containing an image
    for (const part of parts) {
        const inlineData = part['inline_data'];
        if (inlineData &&
            typeof inlineData['mime_type'] === 'string' &&
            inlineData['mime_type'].startsWith('image/') &&
            typeof inlineData['data'] === 'string') {
            return {
                mimeType: inlineData['mime_type'],
                data: Buffer.from(inlineData['data'], 'base64'),
            };
        }
    }
    // No image found — extract any text for a meaningful error
    const textParts = parts
        .filter((p) => typeof p['text'] === 'string')
        .map((p) => p['text']);
    const textHint = textParts.length > 0
        ? ` Model returned text: "${textParts.join(' ').slice(0, 200)}"`
        : '';
    throw new Error(`Gemini response contained no image part.${textHint}`);
}
// ---------------------------------------------------------------------------
// Main adapter function
// ---------------------------------------------------------------------------
/**
 * Calls Gemini to generate an annotated version of a source image.
 *
 * @param sourceImagePath  Absolute path to the source PNG.
 * @param promptText       Final prompt text (with hint already appended by caller).
 * @param config           Gemini API key and optional model name.
 * @param outputPath       Where to write the generated image.
 * @param httpPost         Injectable HTTP client.
 * @param encodeFn         Injectable image encoder.
 */
async function generateHintImage(sourceImagePath, promptText, config, outputPath, httpPost = defaultHttpPost, encodeFn = encodeImageAsBase64) {
    const model = config.model ?? exports.DEFAULT_HINT_IMAGE_GEN_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${config.apiKey}`;
    const requestBody = buildGeminiHintImageGenRequest(promptText, sourceImagePath, encodeFn);
    const rawResponse = await httpPost(url, requestBody, {
        'Content-Type': 'application/json',
    });
    const imagePart = unwrapGeminiImageResponse(rawResponse);
    (0, fs_1.writeFileSync)(outputPath, imagePart.data);
    return {
        outputPath,
        mimeType: imagePart.mimeType,
        model,
    };
}
//# sourceMappingURL=annotator.js.map