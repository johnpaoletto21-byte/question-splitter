/**
 * adapters/deduplication/gemini-deduplicator/deduplicator.ts
 *
 * Main Gemini deduplication adapter — the public entry point for Agent 4.
 *
 * This is a text-only agent (no images). It receives JSON describing all
 * localized targets from all chunks and returns a deduplicated list.
 * No repair loops — relies on Gemini structured output mode.
 */

import type { DeduplicationInput, DeduplicationResult } from '../../../core/deduplication-contract/types';
import { buildDeduplicationPrompt } from './prompt';
import { parseGeminiDeduplicationResponse } from './parser';
import { GEMINI_DEDUPLICATION_SCHEMA } from './schema';
import type { GeminiDeduplicatorConfig, HttpPostFn } from './types';

export const DEFAULT_GEMINI_DEDUPLICATOR_MODEL = 'gemini-3.1-flash-lite-preview';

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
// Response unwrapper (same pattern as other adapters)
// ---------------------------------------------------------------------------

function unwrapGeminiResponse(raw: unknown): unknown {
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
 * Deduplicates targets across chunks using the Gemini API.
 * Text-only — no images are sent.
 */
export async function deduplicateTargets(
  input: DeduplicationInput,
  promptSnapshot: string,
  config: GeminiDeduplicatorConfig,
  httpPost: HttpPostFn = defaultHttpPost,
): Promise<DeduplicationResult> {
  const model = config.model ?? DEFAULT_GEMINI_DEDUPLICATOR_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const promptText = buildDeduplicationPrompt(input, promptSnapshot);

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_DEDUPLICATION_SCHEMA,
    },
  };

  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });
  const parsedJson = unwrapGeminiResponse(rawResponse);

  return parseGeminiDeduplicationResponse(parsedJson, input.run_id);
}
