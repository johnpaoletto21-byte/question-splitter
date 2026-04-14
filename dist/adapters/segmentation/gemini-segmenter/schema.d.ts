/**
 * adapters/segmentation/gemini-segmenter/schema.ts
 *
 * Gemini structured output response schema for Agent 1.
 *
 * Agent 1 produces a **question inventory** — an ordered list of questions
 * found in the document. No spatial/region information is requested.
 * Page-level localization is handled by Agent 3 via sliding windows.
 *
 * Note: target_id is intentionally absent — the parser assigns sequential
 * IDs in reading order after the response arrives.
 */
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export declare function buildGeminiSegmentationSchema(input?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}): Record<string, unknown>;
/** JSON schema object for Gemini's responseSchema field. */
export declare const GEMINI_SEGMENTATION_SCHEMA: Record<string, unknown>;
//# sourceMappingURL=schema.d.ts.map