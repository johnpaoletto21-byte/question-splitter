/**
 * adapters/localization/gemini-localizer/localizer.ts
 *
 * Main Gemini localization adapter — the public entry point for Agent 3.
 *
 * Processes ONE target per call. The localizer keeps repair retries
 * (up to 2x) because bbox values have semantic constraints that the
 * schema can't enforce (y_min < y_max, non-zero area).
 */

import { readFileSync } from 'fs';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import type { LocalizationResult } from '../../../core/localization-contract/types';
import { buildLocalizationPrompt } from './prompt';
import { parseGeminiLocalizationResponse } from './parser';
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
  relevantPages: PreparedPageImage[],
  encodeFn: (path: string) => string = encodePageImageAsBase64,
  responseSchema: Record<string, unknown> = GEMINI_LOCALIZATION_SCHEMA,
): Record<string, unknown> {
  const parts: unknown[] = [{ text: promptText }];

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
  targetId: string,
  validationMessage: string,
  invalidOutput: unknown,
): string {
  return `${originalPrompt}

## Correction Required
Your previous localization response for target ${targetId} failed validation:
${validationMessage}

Return corrected JSON for the same target and the same page_number sequence.
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
// Page selection helper
// ---------------------------------------------------------------------------

/**
 * Filters the prepared-pages list to all pages referenced by the target's regions.
 * Handles targets with any number of regions (not limited to 2).
 */
export function selectPagesForTarget(
  target: SegmentationTarget,
  allPages: PreparedPageImage[],
): PreparedPageImage[] {
  const wantedPages = new Set(target.regions.map((r) => r.page_number));

  // Also include the page before the first region for context
  const minPage = Math.min(...target.regions.map((r) => r.page_number));
  if (minPage > 1) {
    wantedPages.add(minPage - 1);
  }

  const selected = allPages
    .filter((p) => wantedPages.has(p.page_number))
    .sort((a, b) => a.page_number - b.page_number);

  // Verify all region pages exist
  for (const region of target.regions) {
    const page = selected.find((p) => p.page_number === region.page_number);
    if (!page) {
      throw new Error(
        `localizeTarget: target "${target.target_id}" references ` +
        `page_number ${region.page_number} but no prepared page with that number was found`,
      );
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Main adapter function
// ---------------------------------------------------------------------------

/**
 * Localizes a single segmentation target using the Gemini API.
 * Keeps repair retries (up to 2x) for bbox validation errors.
 */
export async function localizeTarget(
  runId: string,
  target: SegmentationTarget,
  allPages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  config: GeminiLocalizerConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodePageImageAsBase64,
): Promise<LocalizationResult> {
  const model = config.model ?? DEFAULT_GEMINI_LOCALIZER_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const relevantPages = selectPagesForTarget(target, allPages);
  const responseSchema = buildGeminiLocalizationSchema(profile.max_regions_per_target);
  const promptText = buildLocalizationPrompt(target, profile, promptSnapshot);
  let currentPrompt = promptText;
  let initialValidationMessage = '';
  let lastParsedJson: unknown;

  for (let attempt = 0; attempt <= MAX_LOCALIZATION_REPAIR_RETRIES; attempt++) {
    const requestBody = buildGeminiLocalizationRequest(currentPrompt, relevantPages, encodeFn, responseSchema);
    const rawResponse = await httpPost(url, requestBody, {
      'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiLocalizationResponse(rawResponse);
    lastParsedJson = parsedJson;

    try {
      return parseGeminiLocalizationResponse(
        parsedJson,
        runId,
        target,
        profile.max_regions_per_target,
      );
    } catch (err) {
      if (!isLocalizationSchemaError(err)) {
        throw err;
      }

      const validationMessage = String(
        (err as Record<string, unknown>)['message'] ?? 'Localization schema invalid',
      );
      if (initialValidationMessage === '') {
        initialValidationMessage = validationMessage;
      }

      if (attempt === MAX_LOCALIZATION_REPAIR_RETRIES) {
        throw {
          ...(err as Record<string, unknown>),
          message:
            `${validationMessage} ` +
            `(after ${MAX_LOCALIZATION_REPAIR_RETRIES} retries; ` +
            `initial validation error: ${initialValidationMessage})`,
        };
      }

      currentPrompt = buildRepairPrompt(
        promptText,
        target.target_id,
        validationMessage,
        lastParsedJson,
      );
    }
  }

  throw new Error('localizeTarget: unreachable retry loop exit');
}
