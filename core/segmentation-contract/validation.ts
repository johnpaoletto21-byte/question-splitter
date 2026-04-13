/**
 * core/segmentation-contract/validation.ts
 *
 * Runtime validation for the normalized segmentation contract.
 *
 * Agent 1 now produces a question inventory (no regions/page references).
 * Enforces:
 *   - Required fields (target_id, target_type).
 *   - Optional review_comment must be a string when present.
 *   - Optional extraction_fields must match definitions.
 *   - Target order is preserved exactly as received.
 */

import type {
  SegmentationResult,
  SegmentationTarget,
  SegmentationValidationError,
} from './types';
import type { ExtractionFieldDefinition } from '../extraction-fields';

export interface SegmentationValidationOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function validateExtractionFields(
  raw: Record<string, unknown>,
  targetIndex: number,
  definitions: ReadonlyArray<ExtractionFieldDefinition>,
): Record<string, boolean> | undefined {
  const rawValue = raw['extraction_fields'];

  if (definitions.length === 0) {
    if (rawValue === undefined) {
      return undefined;
    }
    if (!isObject(rawValue)) {
      throw {
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: `targets[${targetIndex}].extraction_fields must be an object when present`,
      } as SegmentationValidationError;
    }
    const values: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(rawValue)) {
      if (typeof value !== 'boolean') {
        throw {
          code: 'SEGMENTATION_SCHEMA_INVALID',
          message: `targets[${targetIndex}].extraction_fields.${key} must be boolean`,
        } as SegmentationValidationError;
      }
      values[key] = value;
    }
    return values;
  }

  if (!isObject(rawValue)) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].extraction_fields must be an object`,
    } as SegmentationValidationError;
  }

  const allowed = new Set(definitions.map((field) => field.key));
  const values: Record<string, boolean> = {};

  for (const field of definitions) {
    if (typeof rawValue[field.key] !== 'boolean') {
      throw {
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: `targets[${targetIndex}].extraction_fields.${field.key} must be boolean`,
      } as SegmentationValidationError;
    }
    values[field.key] = rawValue[field.key] as boolean;
  }

  for (const key of Object.keys(rawValue)) {
    if (!allowed.has(key)) {
      throw {
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: `targets[${targetIndex}].extraction_fields.${key} was not configured for this run`,
      } as SegmentationValidationError;
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Target validation
// ---------------------------------------------------------------------------

/**
 * Validates a single raw target value.
 *
 * @param raw              The unknown value to validate.
 * @param targetIndex      Position in the targets array (for error messages).
 */
export function validateSegmentationTarget(
  raw: unknown,
  targetIndex: number,
  options: SegmentationValidationOptions = {},
): SegmentationTarget {
  if (!isObject(raw)) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}] must be an object`,
    } as SegmentationValidationError;
  }

  if (!isString(raw['target_id']) || raw['target_id'].trim() === '') {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].target_id must be a non-empty string`,
    } as SegmentationValidationError;
  }

  if (!isString(raw['target_type']) || raw['target_type'].trim() === '') {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].target_type must be a non-empty string`,
    } as SegmentationValidationError;
  }

  const extractionFields = validateExtractionFields(
    raw,
    targetIndex,
    options.extractionFields ?? [],
  );

  // Optional review_comment
  const rawComment = 'review_comment' in raw ? raw['review_comment'] : undefined;
  if (rawComment !== undefined && !isString(rawComment)) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].review_comment must be a string when present`,
    } as SegmentationValidationError;
  }

  const target: SegmentationTarget = {
    target_id: raw['target_id'] as string,
    target_type: raw['target_type'] as string,
  };

  if (extractionFields !== undefined) {
    target.extraction_fields = extractionFields;
  }

  if (typeof rawComment === 'string') {
    target.review_comment = rawComment;
  }

  // Optional fields: question_number, question_text, sub_questions
  if (isString(raw['question_number'])) {
    target.question_number = raw['question_number'] as string;
  }
  if (isString(raw['question_text'])) {
    target.question_text = raw['question_text'] as string;
  }
  if (isArray(raw['sub_questions'])) {
    const subs = raw['sub_questions'] as unknown[];
    if (subs.every(isString)) {
      target.sub_questions = subs as string[];
    }
  }

  return target;
}

// ---------------------------------------------------------------------------
// Result validation
// ---------------------------------------------------------------------------

/**
 * Validates a complete raw segmentation result.
 *
 * @param raw                  The unknown value to validate.
 * @returns                    A typed, validated SegmentationResult.
 * @throws                     SegmentationValidationError on any schema violation.
 */
export function validateSegmentationResult(
  raw: unknown,
  options: SegmentationValidationOptions = {},
): SegmentationResult {
  if (!isObject(raw)) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: 'Segmentation result must be an object',
    } as SegmentationValidationError;
  }

  if (!isString(raw['run_id']) || raw['run_id'].trim() === '') {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: 'Segmentation result must have a non-empty run_id string',
    } as SegmentationValidationError;
  }

  if (!isArray(raw['targets'])) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: 'Segmentation result must have a targets array',
    } as SegmentationValidationError;
  }

  const targets = (raw['targets'] as unknown[]).map((t, i) =>
    validateSegmentationTarget(t, i, options),
  );

  return {
    run_id: raw['run_id'] as string,
    targets,
  };
}
