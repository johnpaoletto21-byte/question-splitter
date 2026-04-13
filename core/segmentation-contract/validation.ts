/**
 * core/segmentation-contract/validation.ts
 *
 * Runtime validation for the normalized segmentation contract.
 *
 * Enforces:
 *   - Required fields (target_id, target_type, regions, page_number).
 *   - Region count limit (INV-3: 1 ≤ regions ≤ maxRegionsPerTarget).
 *   - No bbox_1000 in regions (INV-2 / PO-2 guard).
 *   - Optional review_comment must be a string when present.
 *   - Target order is preserved exactly as received.
 */

import type {
  SegmentationRegion,
  SegmentationResult,
  SegmentationTarget,
  SegmentationValidationError,
} from './types';
import type { ExtractionFieldDefinition } from '../extraction-fields';

export interface SegmentationValidationOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
  requireFinishPage?: boolean;
}

// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
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

function validateFinishPage(
  raw: Record<string, unknown>,
  targetIndex: number,
  regions: SegmentationRegion[],
  options: SegmentationValidationOptions,
): number | undefined {
  const rawFinishPage = raw['finish_page_number'];

  if (rawFinishPage === undefined) {
    if (options.requireFinishPage !== true) {
      return undefined;
    }
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].finish_page_number is required`,
    } as SegmentationValidationError;
  }

  if (
    !isNumber(rawFinishPage) ||
    !Number.isInteger(rawFinishPage) ||
    (rawFinishPage as number) < 1
  ) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].finish_page_number must be a positive integer`,
    } as SegmentationValidationError;
  }

  const finishPage = rawFinishPage as number;

  const maxRegionPage = Math.max(...regions.map((region) => region.page_number));
  if (maxRegionPage !== finishPage) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message:
        `targets[${targetIndex}] max region page ${maxRegionPage} must equal ` +
        `finish_page_number ${finishPage}`,
    } as SegmentationValidationError;
  }

  return finishPage;
}

// ---------------------------------------------------------------------------
// Region validation
// ---------------------------------------------------------------------------

/**
 * Validates a single raw region value.
 * Enforces: page_number is a positive integer, no bbox_1000 present.
 */
export function validateSegmentationRegion(
  raw: unknown,
  regionIndex: number,
  targetIndex: number,
): SegmentationRegion {
  if (!isObject(raw)) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `Target[${targetIndex}].regions[${regionIndex}] must be an object`,
    } as SegmentationValidationError;
  }

  // Guard: bbox_1000 must never appear in segmentation regions (INV-2, PO-2).
  if ('bbox_1000' in raw) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message:
        `Target[${targetIndex}].regions[${regionIndex}] must not contain bbox_1000 — ` +
        'crop coordinates belong to Agent 2 localization (INV-2)',
    } as SegmentationValidationError;
  }

  if (
    !isNumber(raw['page_number']) ||
    !Number.isInteger(raw['page_number']) ||
    (raw['page_number'] as number) < 1
  ) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message:
        `Target[${targetIndex}].regions[${regionIndex}].page_number must be a positive integer`,
    } as SegmentationValidationError;
  }

  return { page_number: raw['page_number'] as number };
}

// ---------------------------------------------------------------------------
// Target validation
// ---------------------------------------------------------------------------

/**
 * Validates a single raw target value.
 *
 * @param raw              The unknown value to validate.
 * @param targetIndex      Position in the targets array (for error messages).
 * @param maxRegions       Profile-driven max (default 2 per INV-3).
 */
export function validateSegmentationTarget(
  raw: unknown,
  targetIndex: number,
  maxRegions: number,
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

  if (!isArray(raw['regions'])) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].regions must be an array`,
    } as SegmentationValidationError;
  }

  const rawRegions = raw['regions'] as unknown[];

  if (rawRegions.length < 1) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `targets[${targetIndex}].regions must have at least 1 entry`,
    } as SegmentationValidationError;
  }

  if (rawRegions.length > maxRegions) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message:
        `targets[${targetIndex}].regions has ${rawRegions.length} entries but ` +
        `the active profile allows at most ${maxRegions} (INV-3)`,
    } as SegmentationValidationError;
  }

  const regions = rawRegions.map((r, ri) =>
    validateSegmentationRegion(r, ri, targetIndex),
  );

  const finishPage = validateFinishPage(raw, targetIndex, regions, options);
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
    regions,
  };

  if (finishPage !== undefined) {
    target.finish_page_number = finishPage;
  }

  if (extractionFields !== undefined) {
    target.extraction_fields = extractionFields;
  }

  if (typeof rawComment === 'string') {
    target.review_comment = rawComment;
  }

  // New optional fields: question_number, question_text, sub_questions
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
 * @param maxRegionsPerTarget  Profile-driven max (default 2 per INV-3).
 * @returns                    A typed, validated SegmentationResult.
 * @throws                     SegmentationValidationError on any schema violation.
 */
export function validateSegmentationResult(
  raw: unknown,
  maxRegionsPerTarget: number = 2,
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
    validateSegmentationTarget(t, i, maxRegionsPerTarget, options),
  );

  return {
    run_id: raw['run_id'] as string,
    targets,
  };
}
