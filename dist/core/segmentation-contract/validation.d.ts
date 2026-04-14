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
import type { SegmentationResult, SegmentationTarget } from './types';
import type { ExtractionFieldDefinition } from '../extraction-fields';
export interface SegmentationValidationOptions {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
/**
 * Validates a single raw target value.
 *
 * @param raw              The unknown value to validate.
 * @param targetIndex      Position in the targets array (for error messages).
 */
export declare function validateSegmentationTarget(raw: unknown, targetIndex: number, options?: SegmentationValidationOptions): SegmentationTarget;
/**
 * Validates a complete raw segmentation result.
 *
 * @param raw                  The unknown value to validate.
 * @returns                    A typed, validated SegmentationResult.
 * @throws                     SegmentationValidationError on any schema violation.
 */
export declare function validateSegmentationResult(raw: unknown, options?: SegmentationValidationOptions): SegmentationResult;
//# sourceMappingURL=validation.d.ts.map