/**
 * adapters/segmentation/gemini-segmenter/schema.ts
 *
 * Gemini structured output response schema for Agent 1.
 *
 * This JSON schema is sent in generationConfig.responseSchema so that
 * Gemini returns a predictable JSON object that the parser can validate
 * against the normalized segmentation contract.
 *
 * Note: target_id is intentionally absent — the parser assigns sequential
 * IDs in reading order after the response arrives.
 */
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export declare function buildGeminiSegmentationSchema(input?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
    focusPageNumber?: number;
    allowedRegionPageNumbers?: ReadonlyArray<number>;
    requireFinishPage?: boolean;
}): Record<string, unknown>;
/** JSON schema object for Gemini's responseSchema field. */
export declare const GEMINI_SEGMENTATION_SCHEMA: Record<string, unknown>;
//# sourceMappingURL=schema.d.ts.map