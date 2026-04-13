/**
 * adapters/segmentation-review/gemini-reviewer/schema.ts
 *
 * Gemini structured output response schema for Agent 1.5 (reviewer).
 */
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export declare function buildGeminiReviewSchema(input?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}): Record<string, unknown>;
//# sourceMappingURL=schema.d.ts.map