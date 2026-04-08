"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLocalizationRegion = validateLocalizationRegion;
exports.validateLocalizationResult = validateLocalizationResult;
// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------
function isString(v) {
    return typeof v === 'string';
}
function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
}
function isInteger(v) {
    return isNumber(v) && Number.isInteger(v);
}
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isArray(v) {
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
function validateBbox1000(raw, regionIndex, targetId) {
    if (!isArray(raw)) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}].bbox_1000 must be an array`,
        };
    }
    if (raw.length !== 4) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}].bbox_1000 must have exactly 4 elements ` +
                `(got ${raw.length}) — format is [y_min, x_min, y_max, x_max]`,
        };
    }
    for (let i = 0; i < 4; i++) {
        const val = raw[i];
        if (!isInteger(val)) {
            throw {
                code: 'LOCALIZATION_SCHEMA_INVALID',
                message: `target "${targetId}" regions[${regionIndex}].bbox_1000[${i}] must be an integer ` +
                    `(got ${typeof val})`,
            };
        }
        if (val < 0 || val > 1000) {
            throw {
                code: 'LOCALIZATION_SCHEMA_INVALID',
                message: `target "${targetId}" regions[${regionIndex}].bbox_1000[${i}] = ${val} is out of range [0, 1000]`,
            };
        }
    }
    const [yMin, xMin, yMax, xMax] = raw;
    if (yMin >= yMax) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}].bbox_1000 has inverted y: ` +
                `y_min (${yMin}) must be less than y_max (${yMax})`,
        };
    }
    if (xMin >= xMax) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}].bbox_1000 has inverted x: ` +
                `x_min (${xMin}) must be less than x_max (${xMax})`,
        };
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
function validateLocalizationRegion(raw, regionIndex, targetId) {
    if (!isObject(raw)) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}] must be an object`,
        };
    }
    if (!isInteger(raw['page_number']) ||
        raw['page_number'] < 1) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}].page_number must be a positive integer`,
        };
    }
    if (!('bbox_1000' in raw)) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions[${regionIndex}] is missing required bbox_1000`,
        };
    }
    const bbox = validateBbox1000(raw['bbox_1000'], regionIndex, targetId);
    return {
        page_number: raw['page_number'],
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
function validateLocalizationResult(raw, maxRegionsPerTarget = 2) {
    if (!isObject(raw)) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: 'Localization result must be an object',
        };
    }
    if (!isString(raw['run_id']) || raw['run_id'].trim() === '') {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: 'Localization result must have a non-empty run_id string',
        };
    }
    if (!isString(raw['target_id']) || raw['target_id'].trim() === '') {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: 'Localization result must have a non-empty target_id string',
        };
    }
    const targetId = raw['target_id'];
    if (!isArray(raw['regions'])) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions must be an array`,
        };
    }
    const rawRegions = raw['regions'];
    if (rawRegions.length < 1) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions must have at least 1 entry`,
        };
    }
    if (rawRegions.length > maxRegionsPerTarget) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" regions has ${rawRegions.length} entries but ` +
                `the active profile allows at most ${maxRegionsPerTarget} (INV-3)`,
        };
    }
    const regions = rawRegions.map((r, ri) => validateLocalizationRegion(r, ri, targetId));
    // Optional review_comment
    const rawComment = 'review_comment' in raw ? raw['review_comment'] : undefined;
    if (rawComment !== undefined && !isString(rawComment)) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${targetId}" review_comment must be a string when present`,
        };
    }
    const result = {
        run_id: raw['run_id'],
        target_id: targetId,
        regions,
    };
    if (typeof rawComment === 'string') {
        result.review_comment = rawComment;
    }
    return result;
}
//# sourceMappingURL=validation.js.map