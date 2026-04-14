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

import { readFileSync } from 'fs';
import type { DiagramDetectionResult } from '../../../core/diagram-detection/types';
import { parseGeminiDiagramDetectionResponse } from './parser';
import { GEMINI_DIAGRAM_DETECTOR_SCHEMA } from './schema';
import type { GeminiDiagramDetectorConfig, HttpPostFn } from './types';

export const DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL = 'gemini-3.1-flash-lite-preview';

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

export function buildGeminiDiagramDetectionRequest(
  promptText: string,
  imagePath: string,
  encodeFn: (path: string) => string = encodeImageAsBase64,
  responseSchema: Record<string, unknown> = GEMINI_DIAGRAM_DETECTOR_SCHEMA,
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
// Response unwrapper (same envelope shape as Agent 1 / Agent 3)
// ---------------------------------------------------------------------------

export function unwrapGeminiDiagramResponse(raw: unknown): unknown {
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
 * Calls Gemini Vision to detect diagrams in a single source image.
 *
 * @param sourceImagePath  Absolute path to the PNG to analyze.
 * @param promptText       Final prompt text (caller resolves snapshot vs. default).
 * @param config           Gemini API key and optional model name.
 * @param httpPost         Injectable HTTP client (defaults to native fetch).
 * @param encodeFn         Injectable image encoder (defaults to readFileSync+base64).
 * @returns                Normalized DiagramDetectionResult.
 */
export async function detectDiagrams(
  sourceImagePath: string,
  promptText: string,
  config: GeminiDiagramDetectorConfig,
  httpPost: HttpPostFn = defaultHttpPost,
  encodeFn: (path: string) => string = encodeImageAsBase64,
): Promise<DiagramDetectionResult> {
  const model = config.model ?? DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${config.apiKey}`;

  const requestBody = buildGeminiDiagramDetectionRequest(
    promptText,
    sourceImagePath,
    encodeFn,
  );
  const rawResponse = await httpPost(url, requestBody, {
    'Content-Type': 'application/json',
  });
  const parsedJson = unwrapGeminiDiagramResponse(rawResponse);

  return parseGeminiDiagramDetectionResponse(parsedJson, sourceImagePath);
}
