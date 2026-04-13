/**
 * adapters/localization/gemini-localizer/parser.ts
 *
 * Parses the raw Gemini structured output from a window localization call
 * into WindowLocalizationResult.
 *
 * Agent 3 receives 1-3 images and identifies which questions appear in them.
 * It returns image_position (1/2/3) which we map deterministically to
 * page_number using the windowPages array.
 *
 * Validates bbox_1000 constraints (shape, range, non-inversion).
 */

import type { PreparedPageImage } from '../../../core/source-model/types';
import type { WindowLocalizationResult, WindowLocalizationRegion } from './window-result';
import type { GeminiRawWindowLocalizationOutput } from './types';

// ---------------------------------------------------------------------------
// Raw output validation
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function assertRawShape(raw: unknown): asserts raw is GeminiRawWindowLocalizationOutput {
  if (!isObject(raw)) {
    throw new Error('Gemini localization response must be an object');
  }
  if (!isArray((raw as Record<string, unknown>)['targets'])) {
    throw new Error('Gemini localization response must have a targets array');
  }
}

// ---------------------------------------------------------------------------
// bbox validation
// ---------------------------------------------------------------------------

function validateBbox(
  bbox: unknown,
  entryIndex: number,
): [number, number, number, number] {
  if (!isArray(bbox) || bbox.length !== 4) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `targets[${entryIndex}].bbox_1000 must be an array of exactly 4 integers`,
    };
  }

  const values = bbox as number[];
  for (let i = 0; i < 4; i++) {
    if (!Number.isInteger(values[i]) || values[i] < 0 || values[i] > 1000) {
      throw {
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: `targets[${entryIndex}].bbox_1000[${i}] must be an integer in [0, 1000], got ${values[i]}`,
      };
    }
  }

  const [yMin, xMin, yMax, xMax] = values;
  if (yMin >= yMax) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `targets[${entryIndex}].bbox_1000 y_min (${yMin}) must be less than y_max (${yMax})`,
    };
  }
  if (xMin >= xMax) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `targets[${entryIndex}].bbox_1000 x_min (${xMin}) must be less than x_max (${xMax})`,
    };
  }

  return [yMin, xMin, yMax, xMax];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses the raw Gemini window localization response.
 *
 * Maps image_position (1/2/3) → windowPages[position-1].page_number.
 * This is deterministic and cannot fail (bounded to window size).
 *
 * @param raw          The parsed JSON from Gemini's response body.
 * @param runId        The run_id for the current run.
 * @param windowPages  The ordered PreparedPageImage[] sent in this window.
 * @returns            Validated WindowLocalizationResult.
 */
export function parseWindowLocalizationResponse(
  raw: unknown,
  runId: string,
  windowPages: ReadonlyArray<PreparedPageImage>,
): WindowLocalizationResult {
  assertRawShape(raw);

  const regions: WindowLocalizationRegion[] = [];

  for (let i = 0; i < raw.targets.length; i++) {
    const entry = raw.targets[i];

    // Validate question_number
    if (typeof entry.question_number !== 'string' || entry.question_number.trim() === '') {
      throw {
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: `targets[${i}].question_number must be a non-empty string`,
      };
    }

    // Validate and map image_position
    const pos = typeof entry.image_position === 'string'
      ? Number(entry.image_position)
      : entry.image_position;
    if (!Number.isInteger(pos) || pos < 1 || pos > windowPages.length) {
      throw {
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message:
          `targets[${i}].image_position ${entry.image_position} is out of range — ` +
          `expected 1..${windowPages.length}`,
      };
    }

    // Deterministic mapping: image_position → page_number
    const pageNumber = windowPages[pos - 1].page_number;

    // Validate bbox
    const bbox = validateBbox(entry.bbox_1000, i);

    regions.push({
      question_number: entry.question_number.trim(),
      page_number: pageNumber,
      bbox_1000: bbox,
    });
  }

  const result: WindowLocalizationResult = {
    run_id: runId,
    regions,
  };

  if (typeof raw.review_comment === 'string') {
    result.review_comment = raw.review_comment;
  }

  return result;
}
