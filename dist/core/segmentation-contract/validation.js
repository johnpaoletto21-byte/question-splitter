"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSegmentationTarget = validateSegmentationTarget;
exports.validateSegmentationResult = validateSegmentationResult;
// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------
function isString(v) {
    return typeof v === 'string';
}
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isArray(v) {
    return Array.isArray(v);
}
function validateExtractionFields(raw, targetIndex, definitions) {
    const rawValue = raw['extraction_fields'];
    if (definitions.length === 0) {
        if (rawValue === undefined) {
            return undefined;
        }
        if (!isObject(rawValue)) {
            throw {
                code: 'SEGMENTATION_SCHEMA_INVALID',
                message: `targets[${targetIndex}].extraction_fields must be an object when present`,
            };
        }
        const values = {};
        for (const [key, value] of Object.entries(rawValue)) {
            if (typeof value !== 'boolean') {
                throw {
                    code: 'SEGMENTATION_SCHEMA_INVALID',
                    message: `targets[${targetIndex}].extraction_fields.${key} must be boolean`,
                };
            }
            values[key] = value;
        }
        return values;
    }
    if (!isObject(rawValue)) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `targets[${targetIndex}].extraction_fields must be an object`,
        };
    }
    const allowed = new Set(definitions.map((field) => field.key));
    const values = {};
    for (const field of definitions) {
        if (typeof rawValue[field.key] !== 'boolean') {
            throw {
                code: 'SEGMENTATION_SCHEMA_INVALID',
                message: `targets[${targetIndex}].extraction_fields.${field.key} must be boolean`,
            };
        }
        values[field.key] = rawValue[field.key];
    }
    for (const key of Object.keys(rawValue)) {
        if (!allowed.has(key)) {
            throw {
                code: 'SEGMENTATION_SCHEMA_INVALID',
                message: `targets[${targetIndex}].extraction_fields.${key} was not configured for this run`,
            };
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
function validateSegmentationTarget(raw, targetIndex, options = {}) {
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
    const extractionFields = validateExtractionFields(raw, targetIndex, options.extractionFields ?? []);
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
    };
    if (extractionFields !== undefined) {
        target.extraction_fields = extractionFields;
    }
    if (typeof rawComment === 'string') {
        target.review_comment = rawComment;
    }
    // Optional fields: question_number, question_text, sub_questions
    if (isString(raw['question_number'])) {
        target.question_number = raw['question_number'];
    }
    if (isString(raw['question_text'])) {
        target.question_text = raw['question_text'];
    }
    if (isArray(raw['sub_questions'])) {
        const subs = raw['sub_questions'];
        if (subs.every(isString)) {
            target.sub_questions = subs;
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
function validateSegmentationResult(raw, options = {}) {
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
    const targets = raw['targets'].map((t, i) => validateSegmentationTarget(t, i, options));
    return {
        run_id: raw['run_id'],
        targets,
    };
}
//# sourceMappingURL=validation.js.map