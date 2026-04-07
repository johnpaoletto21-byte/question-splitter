/**
 * core/localization-contract/validation.ts
 *
 * Runtime validation for the normalized localization contract.
 *
 * Enforces:
 *   - Required fields (target_id, run_id, regions, page_number, bbox_1000).
 *   - bbox_1000 shape: array of exactly 4 integers each in [0, 1000],
 *     y_min < y_max, x_min < x_max (BBOX_INVALID guard).
 *   - Region count limit (1 ≤ regions ≤ maxRegionsPerTarget per INV-3).
 *   - Optional review_comment must be a string when present (INV-4).
 *   - Target order is preserved exactly as received.
 *
 * Cross-contract guards (region count / page_number match against Agent 1)
 * are enforced by the parser, not here, to keep contract validation narrowly scoped.
 */

import type {
  LocalizationRegion,
  LocalizationResult,
  LocalizationValidationError,
} from './types';

// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

function isInteger(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

// ---------------------------------------------------------------------------
// bbox_1000 validation
// ---------------------------------------------------------------------------

/**
 * Validates a bbox_1000 value.
 *
 * Rules:
 *   - Must be an array of exactly 4 integers.
 *   - Each value must be in [0, 1000].
 *   - Format [y_min, x_min, y_max, x_max]: y_min < y_max AND x_min < x_max.
 */
function validateBbox1000(
  raw: unknown,
  regionIndex: number,
  targetId: string,
): [number, number, number, number] {
  if (!isArray(raw)) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}].bbox_1000 must be an array`,
    } as LocalizationValidationError;
  }

  if (raw.length !== 4) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}].bbox_1000 must have exactly 4 elements ` +
        `(got ${raw.length}) — format is [y_min, x_min, y_max, x_max]`,
    } as LocalizationValidationError;
  }

  for (let i = 0; i < 4; i++) {
    const val = raw[i];
    if (!isInteger(val)) {
      throw {
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message:
          `target "${targetId}" regions[${regionIndex}].bbox_1000[${i}] must be an integer ` +
          `(got ${typeof val})`,
      } as LocalizationValidationError;
    }
    if ((val as number) < 0 || (val as number) > 1000) {
      throw {
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message:
          `target "${targetId}" regions[${regionIndex}].bbox_1000[${i}] = ${val} is out of range [0, 1000]`,
      } as LocalizationValidationError;
    }
  }

  const [yMin, xMin, yMax, xMax] = raw as [number, number, number, number];

  if (yMin >= yMax) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}].bbox_1000 has inverted y: ` +
        `y_min (${yMin}) must be less than y_max (${yMax})`,
    } as LocalizationValidationError;
  }

  if (xMin >= xMax) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}].bbox_1000 has inverted x: ` +
        `x_min (${xMin}) must be less than x_max (${xMax})`,
    } as LocalizationValidationError;
  }

  return [yMin, xMin, yMax, xMax];
}

// ---------------------------------------------------------------------------
// Region validation
// ---------------------------------------------------------------------------

/**
 * Validates a single raw localization region.
 * Enforces: page_number is a positive integer, bbox_1000 is valid.
 *
 * @param raw          The unknown value to validate.
 * @param regionIndex  Position in the regions array (for error messages).
 * @param targetId     The target_id this region belongs to (for error messages).
 */
export function validateLocalizationRegion(
  raw: unknown,
  regionIndex: number,
  targetId: string,
): LocalizationRegion {
  if (!isObject(raw)) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `target "${targetId}" regions[${regionIndex}] must be an object`,
    } as LocalizationValidationError;
  }

  if (
    !isInteger(raw['page_number']) ||
    (raw['page_number'] as number) < 1
  ) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}].page_number must be a positive integer`,
    } as LocalizationValidationError;
  }

  if (!('bbox_1000' in raw)) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions[${regionIndex}] is missing required bbox_1000`,
    } as LocalizationValidationError;
  }

  const bbox = validateBbox1000(raw['bbox_1000'], regionIndex, targetId);

  return {
    page_number: raw['page_number'] as number,
    bbox_1000: bbox,
  };
}

// ---------------------------------------------------------------------------
// Result validation
// ---------------------------------------------------------------------------

/**
 * Validates a complete raw localization result for a single target.
 *
 * @param raw                  The unknown value to validate.
 * @param maxRegionsPerTarget  Profile-driven max (default 2 per INV-3).
 * @returns                    A typed, validated LocalizationResult.
 * @throws                     LocalizationValidationError on any schema violation.
 */
export function validateLocalizationResult(
  raw: unknown,
  maxRegionsPerTarget: number = 2,
): LocalizationResult {
  if (!isObject(raw)) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: 'Localization result must be an object',
    } as LocalizationValidationError;
  }

  if (!isString(raw['run_id']) || raw['run_id'].trim() === '') {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: 'Localization result must have a non-empty run_id string',
    } as LocalizationValidationError;
  }

  if (!isString(raw['target_id']) || raw['target_id'].trim() === '') {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: 'Localization result must have a non-empty target_id string',
    } as LocalizationValidationError;
  }

  const targetId = raw['target_id'] as string;

  if (!isArray(raw['regions'])) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `target "${targetId}" regions must be an array`,
    } as LocalizationValidationError;
  }

  const rawRegions = raw['regions'] as unknown[];

  if (rawRegions.length < 1) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `target "${targetId}" regions must have at least 1 entry`,
    } as LocalizationValidationError;
  }

  if (rawRegions.length > maxRegionsPerTarget) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message:
        `target "${targetId}" regions has ${rawRegions.length} entries but ` +
        `the active profile allows at most ${maxRegionsPerTarget} (INV-3)`,
    } as LocalizationValidationError;
  }

  const regions = rawRegions.map((r, ri) =>
    validateLocalizationRegion(r, ri, targetId),
  );

  // Optional review_comment
  const rawComment = 'review_comment' in raw ? raw['review_comment'] : undefined;
  if (rawComment !== undefined && !isString(rawComment)) {
    throw {
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: `target "${targetId}" review_comment must be a string when present`,
    } as LocalizationValidationError;
  }

  const result: LocalizationResult = {
    run_id: raw['run_id'] as string,
    target_id: targetId,
    regions,
  };

  if (typeof rawComment === 'string') {
    result.review_comment = rawComment;
  }

  return result;
}
