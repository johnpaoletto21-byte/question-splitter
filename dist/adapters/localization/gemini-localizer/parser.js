"use strict";
/**
 * adapters/localization/gemini-localizer/parser.ts
 *
 * Parses and translates the raw Gemini structured output into the
 * normalized LocalizationResult contract for one target.
 *
 * Responsibilities:
 *   1. Validate the raw JSON structure from Gemini.
 *   2. Carry the target_id from the incoming SegmentationTarget
 *      (Agent 2 never invents or changes target identity).
 *   3. Cross-validate region count and page_number order against the
 *      Agent 1 SegmentationTarget (Agent 2 must not reorder or add regions).
 *   4. Validate each bbox_1000 via the localization contract.
 *   5. Return a fully normalized, validated LocalizationResult.
 *
 * Nothing from this file should reach outside the adapter boundary
 * in raw form — only the normalized LocalizationResult is returned.
 *
 * Cross-contract drift guards (items 3–4) enforce the Layer B invariant
 * that Agent 2 localizes existing targets; it must not redefine them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiLocalizationResponse = parseGeminiLocalizationResponse;
const validation_1 = require("../../../core/localization-contract/validation");
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
 * The full contract validation is done by validateLocalizationResult after
 * we attach run_id and target_id.
 */
function assertRawShape(raw) {
    if (!isObject(raw)) {
        throw new Error('Gemini localization response must be an object');
    }
    if (!isArray(raw['regions'])) {
        throw new Error('Gemini localization response must have a regions array');
    }
}
// ---------------------------------------------------------------------------
// Cross-contract guard
// ---------------------------------------------------------------------------
/**
 * Verifies that Agent 2's regions match the Agent 1 segmentation target exactly:
 *   - Same region count.
 *   - Same page_number at each position (order preserved).
 *
 * Throws if Agent 2 attempted to reorder, add, or remove regions.
 *
 * This guard is the enforcement point for the Layer B invariant:
 * "Agent 2 must localize existing targets; it must NOT redefine target count
 * or reading order."
 */
function assertRegionConsistency(rawRegions, source) {
    if (rawRegions.length !== source.regions.length) {
        throw {
            code: 'LOCALIZATION_SCHEMA_INVALID',
            message: `target "${source.target_id}" region count drift: Agent 1 defined ` +
                `${source.regions.length} region(s) but Agent 2 returned ${rawRegions.length}. ` +
                'Agent 2 must not add, remove, or reorder regions.',
        };
    }
    for (let i = 0; i < rawRegions.length; i++) {
        const rawRegion = rawRegions[i];
        const expectedPageNumber = source.regions[i].page_number;
        if (!isObject(rawRegion) ||
            rawRegion['page_number'] !== expectedPageNumber) {
            const got = isObject(rawRegion)
                ? rawRegion['page_number']
                : '(non-object)';
            throw {
                code: 'LOCALIZATION_SCHEMA_INVALID',
                message: `target "${source.target_id}" regions[${i}].page_number drift: ` +
                    `expected ${expectedPageNumber} (from Agent 1) but Agent 2 returned ${got}. ` +
                    'Agent 2 must not change page_number order.',
            };
        }
    }
}
// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
/**
 * Parses the raw Gemini structured JSON output and returns a normalized
 * LocalizationResult for a single target.
 *
 * @param raw        The parsed JSON object from Gemini's response body.
 * @param runId      The run_id for the current orchestrator run.
 * @param source     The Agent 1 SegmentationTarget this localization is for.
 *                   Used to carry target_id and enforce region consistency.
 * @param maxRegionsPerTarget  Max regions per INV-3 (from active profile).
 * @returns          Validated, normalized LocalizationResult.
 * @throws           Error or LocalizationValidationError on invalid response.
 */
function parseGeminiLocalizationResponse(raw, runId, source, maxRegionsPerTarget = 2) {
    assertRawShape(raw);
    // Cross-validate region count and page_number order against Agent 1 output.
    assertRegionConsistency(raw.regions, source);
    // Build the normalized object with target_id carried from Agent 1.
    const normalized = {
        run_id: runId,
        target_id: source.target_id,
        regions: raw.regions,
    };
    if (typeof raw.review_comment === 'string') {
        normalized['review_comment'] = raw.review_comment;
    }
    // Run full contract validation (enforces bbox shape, range, inversion, INV-3).
    return (0, validation_1.validateLocalizationResult)(normalized, maxRegionsPerTarget);
}
//# sourceMappingURL=parser.js.map