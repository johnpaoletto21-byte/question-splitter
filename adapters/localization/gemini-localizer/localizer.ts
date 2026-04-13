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

import { readFileSync } from 'fs';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import type { WindowLocalizationResult } from './window-result';
import { buildWindowLocalizationPrompt } from './prompt';
import { parseWindowLocalizationResponse } from './parser';
import { buildGeminiLocalizationSchema, GEMINI_LOCALIZATION_SCHEMA } from './schema';
import type { GeminiLocalizerConfig, HttpPostFn } from './types';

export const DEFAULT_GEMINI_LOCALIZER_MODEL = 'gemini-3.1-flash-lite-preview';
const MAX_LOCALIZATION_REPAIR_RETRIES = 2;

// ---------------------------------------------------------------------------
// Default HTTP client (native fetch, Node.js 18+)
// ---------------------------------------------------------------------------

const defaultHttpPost: HttpPostFn = async (url, body, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)');
    throw new Error(
      `Gemini API error: HTTP ${response.status} — ${text}`,
    );
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Image encoding
// ---------------------------------------------------------------------------

export function encodePageImageAsBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return buffer.toString('base64');
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

export function buildGeminiLocalizationRequest(
  promptText: string,
  windowPages: PreparedPageImage[],
  encodeFn: (path: string) => string = encodePageImageAsBase64,
  responseSchema: Record<string, unknown> = GEMINI_LOCALIZATION_SCHEMA,
): Record<string, unknown> {
  const parts: unknown[] = [{ text: promptText }];

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

function isLocalizationSchemaError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === 'LOCALIZATION_SCHEMA_INVALID'
  );
}

function buildRepairPrompt(
  originalPrompt: string,
  validationMessage: string,
  invalidOutput: unknown,
): string {
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

export function unwrapGeminiLocalizationResponse(raw: unknown): unknown {
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
export async function localizeWindow(
  runId: string,
  questionList: ReadonlyArray<SegmentationTarget>,
  windowPages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  config: GeminiLocalizerConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodePageImageAsBase64,
): Promise<WindowLocalizationResult> {
  const model = config.model ?? DEFAULT_GEMINI_LOCALIZER_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const responseSchema = buildGeminiLocalizationSchema(windowPages.length);
  const promptText = buildWindowLocalizationPrompt(questionList, windowPages.length, profile, promptSnapshot);
  let currentPrompt = promptText;
  let lastParsedJson: unknown;

  for (let attempt = 0; attempt <= MAX_LOCALIZATION_REPAIR_RETRIES; attempt++) {
    const requestBody = buildGeminiLocalizationRequest(currentPrompt, windowPages, encodeFn, responseSchema);
    const rawResponse = await httpPost(url, requestBody, {
      'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiLocalizationResponse(rawResponse);
    lastParsedJson = parsedJson;

    try {
      return parseWindowLocalizationResponse(parsedJson, runId, windowPages);
    } catch (err) {
      if (!isLocalizationSchemaError(err)) {
        throw err;
      }

      const validationMessage = String(
        (err as Record<string, unknown>)['message'] ?? 'Localization schema invalid',
      );

      if (attempt === MAX_LOCALIZATION_REPAIR_RETRIES) {
        throw {
          ...(err as Record<string, unknown>),
          message:
            `${validationMessage} (after ${MAX_LOCALIZATION_REPAIR_RETRIES} retries)`,
        };
      }

      currentPrompt = buildRepairPrompt(promptText, validationMessage, lastParsedJson);
    }
  }

  throw new Error('localizeWindow: unreachable retry loop exit');
}
