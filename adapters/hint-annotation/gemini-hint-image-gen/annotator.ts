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

import { readFileSync, writeFileSync } from 'fs';
import type {
  GeminiHintImageGenConfig,
  HttpPostFn,
  HintImageGenResult,
} from './types';

export const DEFAULT_HINT_IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

// ---------------------------------------------------------------------------
// Default HTTP client
// ---------------------------------------------------------------------------

const defaultHttpPost: HttpPostFn = async (url, body, headers) => {
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

export function encodeImageAsBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return buffer.toString('base64');
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

export function buildGeminiHintImageGenRequest(
  promptText: string,
  imagePath: string,
  encodeFn: (path: string) => string = encodeImageAsBase64,
): Record<string, unknown> {
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

// ---------------------------------------------------------------------------
// Response unwrapper — extracts image data from Gemini response
// ---------------------------------------------------------------------------

export interface GeminiImagePart {
  mimeType: string;
  data: Buffer;
}

export function unwrapGeminiImageResponse(raw: unknown): GeminiImagePart {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !Array.isArray((raw as Record<string, unknown>)['candidates'])
  ) {
    throw new Error('Gemini response missing candidates array');
  }

  const candidates = (raw as Record<string, unknown[]>)['candidates'];
  const first = candidates[0] as Record<string, unknown>;

  if (!first || typeof first !== 'object') {
    throw new Error('Gemini response has no candidates');
  }

  const content = first['content'] as Record<string, unknown>;
  if (!content || !Array.isArray(content['parts'])) {
    throw new Error('Gemini response candidate missing content.parts');
  }

  const parts = content['parts'] as Record<string, unknown>[];

  // Look for a part with inline_data containing an image
  for (const part of parts) {
    const inlineData = part['inline_data'] as Record<string, unknown> | undefined;
    if (
      inlineData &&
      typeof inlineData['mime_type'] === 'string' &&
      (inlineData['mime_type'] as string).startsWith('image/') &&
      typeof inlineData['data'] === 'string'
    ) {
      return {
        mimeType: inlineData['mime_type'] as string,
        data: Buffer.from(inlineData['data'] as string, 'base64'),
      };
    }
  }

  // No image found — extract any text for a meaningful error
  const textParts = parts
    .filter((p) => typeof p['text'] === 'string')
    .map((p) => p['text'] as string);
  const textHint = textParts.length > 0
    ? ` Model returned text: "${textParts.join(' ').slice(0, 200)}"`
    : '';
  throw new Error(
    `Gemini response contained no image part.${textHint}`,
  );
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
export async function generateHintImage(
  sourceImagePath: string,
  promptText: string,
  config: GeminiHintImageGenConfig,
  outputPath: string,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodeImageAsBase64,
): Promise<HintImageGenResult> {
  const model = config.model ?? DEFAULT_HINT_IMAGE_GEN_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const requestBody = buildGeminiHintImageGenRequest(
    promptText,
    sourceImagePath,
    encodeFn,
  );
  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });
  const imagePart = unwrapGeminiImageResponse(rawResponse);

  writeFileSync(outputPath, imagePart.data);

  return {
    outputPath,
    mimeType: imagePart.mimeType,
    model,
  };
}
