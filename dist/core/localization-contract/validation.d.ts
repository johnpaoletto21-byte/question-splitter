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
import type { LocalizationRegion, LocalizationResult } from './types';
/**
 * Validates a single raw localization region.
 * Enforces: page_number is a positive integer, bbox_1000 is valid.
 *
 * @param raw          The unknown value to validate.
 * @param regionIndex  Position in the regions array (for error messages).
 * @param targetId     The target_id this region belongs to (for error messages).
 */
export declare function validateLocalizationRegion(raw: unknown, regionIndex: number, targetId: string): LocalizationRegion;
/**
 * Validates a complete raw localization result for a single target.
 *
 * @param raw                  The unknown value to validate.
 * @param maxRegionsPerTarget  Profile-driven max (default 2 per INV-3).
 * @returns                    A typed, validated LocalizationResult.
 * @throws                     LocalizationValidationError on any schema violation.
 */
export declare function validateLocalizationResult(raw: unknown, maxRegionsPerTarget?: number): LocalizationResult;
//# sourceMappingURL=validation.d.ts.map