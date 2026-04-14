/**
 * adapters/segmentation/gemini-segmenter/parser.ts
 *
 * Parses and translates the raw Gemini structured output into the
 * normalized SegmentationResult contract.
 *
 * Agent 1 now produces a question inventory (no regions/page references).
 *
 * Responsibilities:
 *   1. Validate the raw JSON structure from Gemini.
 *   2. Assign sequential target_id values in reading order (q_0001, q_0002, …).
 *   3. Combine with run_id to produce a complete SegmentationResult.
 *   4. Pass through fields: question_number, question_text, sub_questions.
 *
 * Nothing from this file should reach outside the adapter boundary
 * in raw form — only the normalized SegmentationResult is returned.
 */
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
export interface ParseGeminiSegmentationOptions {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}
/**
 * Parses the raw Gemini structured JSON output and returns a normalized
 * SegmentationResult (question inventory — no regions).
 *
 * @param raw      The parsed JSON object from Gemini's response body.
 * @param runId    The run_id for the current orchestrator run.
 * @returns        Validated, normalized SegmentationResult.
 * @throws         Error or SegmentationValidationError on invalid response.
 */
export declare function parseGeminiSegmentationResponse(raw: unknown, runId: string, options?: ParseGeminiSegmentationOptions): SegmentationResult;
//# sourceMappingURL=parser.d.ts.map