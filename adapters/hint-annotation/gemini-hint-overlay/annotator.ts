/**
 * adapters/hint-annotation/gemini-hint-overlay/annotator.ts
 *
 * Gemini adapter that returns structured annotation instructions as JSON.
 * Used by Method 2 (JSON + Canvas overlay) and Method 3 step 1 (blend).
 *
 * The model analyzes the diagram and the teacher's hint, then returns
 * drawing instructions (lines, arrows, arcs, text) in bbox_1000 coordinates.
 */

import { readFileSync } from 'fs';
import type {
  GeminiHintOverlayConfig,
  HttpPostFn,
  AnnotationInstruction,
  HintOverlayResult,
} from './types';
import { GEMINI_HINT_OVERLAY_SCHEMA } from './schema';

export const DEFAULT_HINT_OVERLAY_MODEL = 'gemini-3.1-flash-lite-preview';

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

export function buildGeminiHintOverlayRequest(
  promptText: string,
  imagePath: string,
  encodeFn: (path: string) => string = encodeImageAsBase64,
  responseSchema: Record<string, unknown> = GEMINI_HINT_OVERLAY_SCHEMA,
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
      responseMimeType: 'application/json',
      responseSchema,
    },
  };
}

// ---------------------------------------------------------------------------
// Response unwrapper (same envelope as other Gemini agents)
// ---------------------------------------------------------------------------

export function unwrapGeminiOverlayResponse(raw: unknown): unknown {
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
  const text = parts[0]?.['text'];

  if (typeof text !== 'string') {
    throw new Error('Gemini response first part is not a text string');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini response text is not valid JSON: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAnnotations(parsed: unknown): AnnotationInstruction[] {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Gemini overlay response is not an object');
  }

  const obj = parsed as Record<string, unknown>;
  const annotations = obj['annotations'];

  if (!Array.isArray(annotations)) {
    throw new Error('Gemini overlay response missing annotations array');
  }

  return annotations.filter((a): a is AnnotationInstruction => {
    if (typeof a !== 'object' || a === null) return false;
    const item = a as Record<string, unknown>;
    return (
      item['type'] === 'line' ||
      item['type'] === 'arrow' ||
      item['type'] === 'arc' ||
      item['type'] === 'text'
    );
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
export async function getHintAnnotations(
  sourceImagePath: string,
  promptText: string,
  config: GeminiHintOverlayConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodeImageAsBase64,
): Promise<HintOverlayResult> {
  const model = config.model ?? DEFAULT_HINT_OVERLAY_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const requestBody = buildGeminiHintOverlayRequest(
    promptText,
    sourceImagePath,
    encodeFn,
  );
  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });
  const parsedJson = unwrapGeminiOverlayResponse(rawResponse);
  const annotations = parseAnnotations(parsedJson);

  return { annotations };
}
