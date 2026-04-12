/**
 * adapters/segmentation/gemini-segmenter/segmenter.ts
 *
 * Main Gemini segmentation adapter — the public entry point for Agent 1.
 *
 * Responsibilities:
 *   1. Read and base64-encode prepared page images (local files).
 *   2. Build the prompt text.
 *   3. Call the Gemini generateContent REST endpoint with structured output.
 *   4. Parse the raw JSON response via parser.ts into a normalized
 *      SegmentationResult (no raw Gemini objects escape this boundary).
 *
 * The HttpPostFn is injectable so tests can mock the network call without
 * importing any provider SDK into core (INV-9 / PO-8).
 *
 * Provider-specific details (endpoint format, request/response envelope,
 * base64 encoding, schema field) are all contained here.
 */

import { readFileSync } from 'fs';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import { buildSegmentationPrompt } from './prompt';
import { parseGeminiSegmentationResponse } from './parser';
import { GEMINI_SEGMENTATION_SCHEMA } from './schema';
import type { GeminiSegmenterConfig, HttpPostFn } from './types';

export const DEFAULT_GEMINI_SEGMENTER_MODEL = 'gemini-3.1-flash-lite-preview';

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

/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 * This keeps the encoding logic isolated and testable.
 */
export function encodePageImageAsBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return buffer.toString('base64');
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * Builds the Gemini generateContent request body.
 *
 * Uses multimodal content parts: text prompt first, then one inlineData
 * image part per page in order.
 */
export function buildGeminiRequest(
  promptText: string,
  pages: PreparedPageImage[],
  encodeFn: (path: string) => string = encodePageImageAsBase64,
): Record<string, unknown> {
  const parts: unknown[] = [{ text: promptText }];

  for (const page of pages) {
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
      responseSchema: GEMINI_SEGMENTATION_SCHEMA,
    },
  };
}

// ---------------------------------------------------------------------------
// Response unwrapper
// ---------------------------------------------------------------------------

/**
 * Extracts the text content from a Gemini generateContent response envelope.
 * The structured JSON output is embedded as a string in:
 *   response.candidates[0].content.parts[0].text
 */
export function unwrapGeminiResponse(raw: unknown): unknown {
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
 * Segments a set of prepared page images using the Gemini API.
 *
 * This is the function that implements the `Segmenter` type in the orchestrator.
 * It is the only place where Gemini API specifics (endpoint, auth header,
 * request format) are known — none of that leaks into core.
 *
 * @param runId          The current run_id (added to the normalized result).
 * @param pages          Prepared page images to include in this segmentation call.
 * @param profile        Active crop target profile (target_type, max regions).
 * @param promptSnapshot Session prompt override (empty string = use built-in prompt).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              Normalized SegmentationResult with targets in reading order.
 */
export async function segmentPages(
  runId: string,
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  config: GeminiSegmenterConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodePageImageAsBase64,
): Promise<SegmentationResult> {
  const model = config.model ?? DEFAULT_GEMINI_SEGMENTER_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const promptText = buildSegmentationPrompt(pages, profile, promptSnapshot);
  const requestBody = buildGeminiRequest(promptText, pages, encodeFn);

  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });

  const parsedJson = unwrapGeminiResponse(rawResponse);

  return parseGeminiSegmentationResponse(
    parsedJson,
    runId,
    profile.max_regions_per_target,
  );
}
