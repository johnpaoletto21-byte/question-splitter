/**
 * adapters/segmentation-review/gemini-reviewer/parser.ts
 *
 * Parses the Gemini reviewer output into null (pass) or SegmentationResult (corrected).
 * Same validation as Agent 1 via validateSegmentationResult.
 */
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export interface ParseGeminiReviewOptions {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
export declare function parseGeminiReviewResponse(raw: unknown, runId: string, maxRegionsPerTarget?: number, options?: ParseGeminiReviewOptions): SegmentationResult | null;
//# sourceMappingURL=parser.d.ts.map