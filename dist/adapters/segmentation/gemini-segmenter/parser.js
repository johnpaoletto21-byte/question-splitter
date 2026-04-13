"use strict";
/**
 * adapters/segmentation/gemini-segmenter/parser.ts
 *
 * Parses and translates the raw Gemini structured output into the
 * normalized SegmentationResult contract.
 *
 * Responsibilities:
 *   1. Validate the raw JSON structure from Gemini.
 *   2. Assign sequential target_id values in reading order (q_0001, q_0002, …).
 *   3. Combine with run_id to produce a complete SegmentationResult.
 *   4. Reject any response that would violate contract invariants.
 *
 * Nothing from this file should reach outside the adapter boundary
 * in raw form — only the normalized SegmentationResult is returned.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiSegmentationResponse = parseGeminiSegmentationResponse;
const validation_1 = require("../../../core/segmentation-contract/validation");
// ---------------------------------------------------------------------------
// Target ID generation
// ---------------------------------------------------------------------------
/**
 * Generates a zero-padded sequential target ID.
 * Format: q_0001, q_0002, …, q_9999
 */
function makeTargetId(index) {
    return `q_${String(index + 1).padStart(4, '0')}`;
}
// ---------------------------------------------------------------------------
// Raw output validation
// ---------------------------------------------------------------------------
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isArray(v) {
    return Array.isArray(v);
}
/**
 * Lightweight structural check of the raw Gemini JSON before normalization.
 * The full contract validation is done by validateSegmentationResult after
 * we add target_id and run_id.
 */
function assertRawShape(raw) {
    if (!isObject(raw)) {
        throw new Error('Gemini segmentation response must be an object');
    }
    if (!isArray(raw['targets'])) {
        throw new Error('Gemini segmentation response must have a targets array');
    }
}
// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
/**
 * Parses the raw Gemini structured JSON output and returns a normalized
 * SegmentationResult.
 *
 * @param raw      The parsed JSON object from Gemini's response body.
 * @param runId    The run_id for the current orchestrator run.
 * @param maxRegionsPerTarget  Max regions per INV-3 (from active profile).
 * @returns        Validated, normalized SegmentationResult.
 * @throws         Error or SegmentationValidationError on invalid response.
 */
function parseGeminiSegmentationResponse(raw, runId, maxRegionsPerTarget = 2, options = {}) {
    assertRawShape(raw);
    // Assign sequential target_id values in the order Gemini returned them
    // (reading order). The ID encodes position so downstream sorting is stable.
    const offset = options.targetIdOffset ?? 0;
    const targets = raw.targets.map((t, i) => {
        // Gemini may return page numbers as strings when enum constraints are
        // used (enum is only allowed on STRING-typed fields). Coerce back to
        // numbers so downstream validation sees the expected integer type.
        const regions = t.regions.map((r) => ({
            ...r,
            page_number: typeof r.page_number === 'string' ? Number(r.page_number) : r.page_number,
        }));
        const target = {
            target_id: makeTargetId(offset + i),
            target_type: t.target_type,
            regions,
        };
        const rawFinish = t.finish_page_number;
        if (typeof rawFinish === 'number') {
            target['finish_page_number'] = rawFinish;
        }
        else if (typeof rawFinish === 'string') {
            target['finish_page_number'] = Number(rawFinish);
        }
        if (t.extraction_fields !== undefined) {
            target['extraction_fields'] = t.extraction_fields;
        }
        if (typeof t.review_comment === 'string') {
            target['review_comment'] = t.review_comment;
        }
        return target;
    });
    // When running in focus-page mode, silently drop targets whose regions
    // don't reach the focus page. These belong to a previous window and would
    // otherwise fail the "max region page must equal finish_page_number" check.
    const focusPage = options.focusPageNumber;
    let filteredTargets = focusPage !== undefined
        ? targets.filter((t) => {
            const regions = t['regions'];
            return regions.some((r) => r.page_number === focusPage);
        }).map((t, i) => ({ ...t, target_id: makeTargetId(offset + i) }))
        : targets;
    // Safety net: drop targets whose ALL regions are on pages the model itself
    // classified as non-content. A real question must have at least one region
    // on a question_content or figure_only page. If the model creates a target
    // but classifies every page it references as blank/cover/answer_sheet,
    // that's a contradiction — trust the classification.
    // Gracefully skipped if page_classifications is absent (backward compat).
    const NON_CONTENT_CLASSIFICATIONS = new Set(['blank', 'cover', 'answer_sheet']);
    const rawClassifications = raw['page_classifications'];
    if (Array.isArray(rawClassifications)) {
        const nonContentPages = new Set(rawClassifications
            .filter((c) => NON_CONTENT_CLASSIFICATIONS.has(c.classification))
            .map((c) => typeof c.page_number === 'string' ? Number(c.page_number) : c.page_number));
        if (nonContentPages.size > 0) {
            filteredTargets = filteredTargets
                .filter((t) => {
                const regions = t['regions'];
                return regions.some((r) => !nonContentPages.has(r.page_number));
            })
                .map((t, i) => ({ ...t, target_id: makeTargetId(offset + i) }));
        }
    }
    const normalized = { run_id: runId, targets: filteredTargets };
    // Run full contract validation (enforces INV-2, INV-3, INV-4 constraints).
    return (0, validation_1.validateSegmentationResult)(normalized, maxRegionsPerTarget, {
        extractionFields: options.extractionFields,
        focusPageNumber: options.focusPageNumber,
    });
}
//# sourceMappingURL=parser.js.map