/**
 * adapters/segmentation/gemini-segmenter/parser.ts
 *
 * Parses and translates the raw Gemini structured output into the
 * normalized SegmentationResult contract.
 *
 * Agent 1 now produces a question inventory (no regions/page references).
 *
 * Responsibilities:
 *   1. Validate the raw JSON structure from Gemini.
 *   2. Assign sequential target_id values in reading order (q_0001, q_0002, …).
 *   3. Combine with run_id to produce a complete SegmentationResult.
 *   4. Pass through fields: question_number, question_text, sub_questions.
 *
 * Nothing from this file should reach outside the adapter boundary
 * in raw form — only the normalized SegmentationResult is returned.
 */

import { validateSegmentationResult } from '../../../core/segmentation-contract/validation';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { GeminiRawSegmentationOutput, GeminiRawTarget } from './types';

export interface ParseGeminiSegmentationOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

// ---------------------------------------------------------------------------
// Target ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a zero-padded sequential target ID.
 * Format: q_0001, q_0002, …, q_9999
 */
function makeTargetId(index: number): string {
  return `q_${String(index + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Raw output validation
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/**
 * Lightweight structural check of the raw Gemini JSON before normalization.
 */
function assertRawShape(raw: unknown): asserts raw is GeminiRawSegmentationOutput {
  if (!isObject(raw)) {
    throw new Error('Gemini segmentation response must be an object');
  }
  if (!isArray((raw as Record<string, unknown>)['targets'])) {
    throw new Error('Gemini segmentation response must have a targets array');
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses the raw Gemini structured JSON output and returns a normalized
 * SegmentationResult (question inventory — no regions).
 *
 * @param raw      The parsed JSON object from Gemini's response body.
 * @param runId    The run_id for the current orchestrator run.
 * @returns        Validated, normalized SegmentationResult.
 * @throws         Error or SegmentationValidationError on invalid response.
 */
export function parseGeminiSegmentationResponse(
  raw: unknown,
  runId: string,
  options: ParseGeminiSegmentationOptions = {},
): SegmentationResult {
  assertRawShape(raw);

  const targets = (raw.targets as GeminiRawTarget[]).map((t, i) => {
    const target: Record<string, unknown> = {
      target_id: makeTargetId(i),
      target_type: t.target_type,
    };
    if (t.extraction_fields !== undefined) {
      target['extraction_fields'] = t.extraction_fields;
    }
    if (typeof t.review_comment === 'string') {
      target['review_comment'] = t.review_comment;
    }
    if (typeof t.question_number === 'string') {
      target['question_number'] = t.question_number;
    }
    if (typeof t.question_text === 'string') {
      target['question_text'] = t.question_text;
    }
    if (Array.isArray(t.sub_questions)) {
      target['sub_questions'] = t.sub_questions;
    }
    return target;
  });

  const normalized = { run_id: runId, targets };

  return validateSegmentationResult(normalized, {
    extractionFields: options.extractionFields,
  });
}
