"use strict";
/**
 * adapters/segmentation-review/gemini-reviewer/parser.ts
 *
 * Parses the Gemini reviewer output into null (pass) or SegmentationResult (corrected).
 * Same validation as Agent 1 via validateSegmentationResult.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiReviewResponse = parseGeminiReviewResponse;
const validation_1 = require("../../../core/segmentation-contract/validation");
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function makeTargetId(index) {
    return `q_${String(index + 1).padStart(4, '0')}`;
}
function parseGeminiReviewResponse(raw, runId, maxRegionsPerTarget = 2, options = {}) {
    if (!isObject(raw)) {
        throw new Error('Gemini review response must be an object');
    }
    const verdict = raw['verdict'];
    if (verdict !== 'pass' && verdict !== 'corrected') {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: `Review verdict must be "pass" or "corrected", received: ${JSON.stringify(verdict)}`,
        };
    }
    if (verdict === 'pass') {
        return null;
    }
    if (!Array.isArray(raw['targets'])) {
        throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: 'Review verdict is "corrected" but targets array is missing',
        };
    }
    const rawTargets = raw['targets'];
    const targets = rawTargets.map((t, i) => {
        const regions = Array.isArray(t['regions'])
            ? t['regions'].map((r) => ({
                ...r,
                page_number: typeof r['page_number'] === 'string'
                    ? Number(r['page_number'])
                    : r['page_number'],
            }))
            : t['regions'];
        const target = {
            target_id: makeTargetId(i),
            target_type: t['target_type'],
            regions,
        };
        const rawFinish = t['finish_page_number'];
        if (typeof rawFinish === 'number') {
            target['finish_page_number'] = rawFinish;
        }
        else if (typeof rawFinish === 'string') {
            target['finish_page_number'] = Number(rawFinish);
        }
        if (t['extraction_fields'] !== undefined) {
            target['extraction_fields'] = t['extraction_fields'];
        }
        if (typeof t['review_comment'] === 'string') {
            target['review_comment'] = t['review_comment'];
        }
        return target;
    });
    const normalized = { run_id: runId, targets };
    return (0, validation_1.validateSegmentationResult)(normalized, maxRegionsPerTarget, {
        extractionFields: options.extractionFields,
        requireFinishPage: true,
    });
}
//# sourceMappingURL=parser.js.map