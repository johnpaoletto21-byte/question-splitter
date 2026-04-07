"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSegmentationRegion = validateSegmentationRegion;
exports.validateSegmentationTarget = validateSegmentationTarget;
exports.validateSegmentationResult = validateSegmentationResult;
// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------
function isString(v) {
    return typeof v === 'string';
}
function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
}
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isArray(v) {
    return Array.isArray(v);
}
// ---------------------------------------------------------------------------
// Region validation
// ---------------------------------------------------------------------------
/**
 * Validates a single raw region value.
 * Enforces: page_number is a positive integer, no bbox_1000 present.
 */
function validateSegmentationRegion(raw, regionIndex, targetIndex) {
    if (!isObject(raw)) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `Target[${targetIndex}].regions[${regionIndex}] must be an object`,
        };
    }
    // Guard: bbox_1000 must never appear in segmentation regions (INV-2, PO-2).
    if ('bbox_1000' in raw) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `Target[${targetIndex}].regions[${regionIndex}] must not contain bbox_1000 — ` +
                'crop coordinates belong to Agent 2 localization (INV-2)',
        };
    }
    if (!isNumber(raw['page_number']) ||
        !Number.isInteger(raw['page_number']) ||
        raw['page_number'] < 1) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `Target[${targetIndex}].regions[${regionIndex}].page_number must be a positive integer`,
        };
    }
    return { page_number: raw['page_number'] };
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
function validateSegmentationTarget(raw, targetIndex, maxRegions) {
    if (!isObject(raw)) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}] must be an object`,
        };
    }
    if (!isString(raw['target_id']) || raw['target_id'].trim() === '') {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].target_id must be a non-empty string`,
        };
    }
    if (!isString(raw['target_type']) || raw['target_type'].trim() === '') {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].target_type must be a non-empty string`,
        };
    }
    if (!isArray(raw['regions'])) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].regions must be an array`,
        };
    }
    const rawRegions = raw['regions'];
    if (rawRegions.length < 1) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].regions must have at least 1 entry`,
        };
    }
    if (rawRegions.length > maxRegions) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].regions has ${rawRegions.length} entries but ` +
                `the active profile allows at most ${maxRegions} (INV-3)`,
        };
    }
    const regions = rawRegions.map((r, ri) => validateSegmentationRegion(r, ri, targetIndex));
    // Optional review_comment
    const rawComment = 'review_comment' in raw ? raw['review_comment'] : undefined;
    if (rawComment !== undefined && !isString(rawComment)) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].review_comment must be a string when present`,
        };
    }
    const target = {
        target_id: raw['target_id'],
        target_type: raw['target_type'],
        regions,
    };
    if (typeof rawComment === 'string') {
        target.review_comment = rawComment;
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
function validateSegmentationResult(raw, maxRegionsPerTarget = 2) {
    if (!isObject(raw)) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: 'Segmentation result must be an object',
        };
    }
    if (!isString(raw['run_id']) || raw['run_id'].trim() === '') {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: 'Segmentation result must have a non-empty run_id string',
        };
    }
    if (!isArray(raw['targets'])) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: 'Segmentation result must have a targets array',
        };
    }
    const targets = raw['targets'].map((t, i) => validateSegmentationTarget(t, i, maxRegionsPerTarget));
    return {
        run_id: raw['run_id'],
        targets,
    };
}
//# sourceMappingURL=validation.js.map