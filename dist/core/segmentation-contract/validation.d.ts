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
import type { SegmentationRegion, SegmentationResult, SegmentationTarget } from './types';
/**
 * Validates a single raw region value.
 * Enforces: page_number is a positive integer, no bbox_1000 present.
 */
export declare function validateSegmentationRegion(raw: unknown, regionIndex: number, targetIndex: number): SegmentationRegion;
/**
 * Validates a single raw target value.
 *
 * @param raw              The unknown value to validate.
 * @param targetIndex      Position in the targets array (for error messages).
 * @param maxRegions       Profile-driven max (default 2 per INV-3).
 */
export declare function validateSegmentationTarget(raw: unknown, targetIndex: number, maxRegions: number): SegmentationTarget;
/**
 * Validates a complete raw segmentation result.
 *
 * @param raw                  The unknown value to validate.
 * @param maxRegionsPerTarget  Profile-driven max (default 2 per INV-3).
 * @returns                    A typed, validated SegmentationResult.
 * @throws                     SegmentationValidationError on any schema violation.
 */
export declare function validateSegmentationResult(raw: unknown, maxRegionsPerTarget?: number): SegmentationResult;
//# sourceMappingURL=validation.d.ts.map