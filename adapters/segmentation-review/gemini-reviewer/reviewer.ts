/**
 * adapters/segmentation-review/gemini-reviewer/reviewer.ts
 *
 * Main Gemini reviewer adapter — the public entry point for Agent 2.
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation).
 * No repair loops — relies on Gemini structured output mode for valid JSON.
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
  const responseSchema = buildGeminiReviewSchema({
    extractionFields,
  });

  const requestBody = buildGeminiRequest(promptText, pages, encodeFn, responseSchema);
  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });
  const parsedJson = unwrapGeminiResponse(rawResponse);

  const parsed = parseGeminiReviewResponse(
    parsedJson,
    runId,
    profile.max_regions_per_target,
    { extractionFields },
  );

  // If verdict was "pass", return null but attach answer_sheet_pages to the
  // original segmentation result (handled by the caller in review-step / pipeline runner).
  // If verdict was "corrected", answer_sheet_pages is already on the segmentation result.
  if (parsed.segmentation === null) {
    // Pass: return null, but we need to communicate answer_sheet_pages.
    // We return a SegmentationResult with the original targets + answer_sheet_pages
    // if any were detected; otherwise null to preserve existing behavior.
    if (parsed.answerSheetPages.length > 0) {
      return {
        ...segmentationResult,
        answer_sheet_pages: parsed.answerSheetPages,
      };
    }
    return null;
  }

  return parsed.segmentation;
}
