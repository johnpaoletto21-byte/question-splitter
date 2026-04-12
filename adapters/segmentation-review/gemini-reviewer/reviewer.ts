/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 1.5.
 * Reuses shared Gemini utilities from the segmenter adapter.
 */

import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import {
  buildGeminiRequest,
  unwrapGeminiResponse,
  encodePageImageAsBase64,
} from '../../segmentation/gemini-segmenter/segmenter';
import { buildReviewPrompt } from './prompt';
import { parseGeminiReviewResponse } from './parser';
import { buildGeminiReviewSchema } from './schema';
import type { GeminiReviewerConfig, HttpPostFn } from './types';

export const DEFAULT_GEMINI_REVIEWER_MODEL = 'gemini-3.1-flash-lite-preview';
const MAX_REVIEW_REPAIR_RETRIES = 2;

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

function isSegmentationSchemaError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === 'SEGMENTATION_SCHEMA_INVALID'
  );
}

function buildRepairPrompt(
  originalPrompt: string,
  validationMessage: string,
  invalidOutput: unknown,
): string {
  return `${originalPrompt}

## Correction Required
Your previous review response failed validation:
${validationMessage}

Return corrected JSON. Use verdict "pass" if Agent 1 was correct, or verdict "corrected" with a valid targets array.
- Every target must have finish_page_number set to the last page with visible content.
- Do not include bbox_1000 in regions.
- Maximum 2 regions per target.

Previous invalid JSON:
${JSON.stringify(invalidOutput, null, 2)}
`;
}

export async function reviewSegmentation(
  runId: string,
  segmentationResult: SegmentationResult,
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  config: GeminiReviewerConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodePageImageAsBase64,
  options: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
    maxRepairRetries?: number;
  } = {},
): Promise<SegmentationResult | null> {
  const model = config.model ?? DEFAULT_GEMINI_REVIEWER_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const extractionFields = options.extractionFields ?? [];
  const promptText = buildReviewPrompt(pages, profile, promptSnapshot, segmentationResult, {
    extractionFields,
  });
  const responseSchema = buildGeminiReviewSchema({ extractionFields });
  const maxRepairRetries = options.maxRepairRetries ?? MAX_REVIEW_REPAIR_RETRIES;
  let currentPrompt = promptText;
  let initialValidationMessage = '';

  for (let attempt = 0; attempt <= maxRepairRetries; attempt++) {
    const requestBody = buildGeminiRequest(currentPrompt, pages, encodeFn, responseSchema);
    const rawResponse = await httpPost(url, requestBody, {
      'Content-Type': 'application/json',
    });
    const parsedJson = unwrapGeminiResponse(rawResponse);

    try {
      return parseGeminiReviewResponse(
        parsedJson,
        runId,
        profile.max_regions_per_target,
        { extractionFields },
      );
    } catch (err) {
      if (!isSegmentationSchemaError(err)) {
        throw err;
      }

      const validationMessage = String(
        (err as Record<string, unknown>)['message'] ?? 'Review schema invalid',
      );
      if (initialValidationMessage === '') {
        initialValidationMessage = validationMessage;
      }

      if (attempt === maxRepairRetries) {
        throw {
          ...(err as Record<string, unknown>),
          message:
            `${validationMessage} ` +
            `(after ${maxRepairRetries} retries; ` +
            `initial validation error: ${initialValidationMessage})`,
        };
      }

      currentPrompt = buildRepairPrompt(promptText, validationMessage, parsedJson);
    }
  }

  throw new Error('reviewSegmentation: unreachable retry loop exit');
}
