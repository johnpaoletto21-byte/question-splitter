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
function parseGeminiSegmentationResponse(raw, runId, maxRegionsPerTarget = 2) {
    assertRawShape(raw);
    // Assign sequential target_id values in the order Gemini returned them
    // (reading order). The ID encodes position so downstream sorting is stable.
    const targets = raw.targets.map((t, i) => {
        const target = {
            target_id: makeTargetId(i),
            target_type: t.target_type,
            regions: t.regions,
        };
        if (typeof t.review_comment === 'string') {
            target['review_comment'] = t.review_comment;
        }
        return target;
    });
    const normalized = { run_id: runId, targets };
    // Run full contract validation (enforces INV-2, INV-3, INV-4 constraints).
    return (0, validation_1.validateSegmentationResult)(normalized, maxRegionsPerTarget);
}
//# sourceMappingURL=parser.js.map