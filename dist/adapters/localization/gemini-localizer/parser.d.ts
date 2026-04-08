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
import type { LocalizationResult } from '../../../core/localization-contract/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
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
export declare function parseGeminiLocalizationResponse(raw: unknown, runId: string, source: SegmentationTarget, maxRegionsPerTarget?: number): LocalizationResult;
//# sourceMappingURL=parser.d.ts.map