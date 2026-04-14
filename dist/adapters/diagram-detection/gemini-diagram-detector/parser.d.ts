/**
 * adapters/diagram-detection/gemini-diagram-detector/parser.ts
 *
 * Parses Gemini's raw diagram-detection JSON into the normalized
 * DiagramDetectionResult contract.
 *
 * Validation here is structural only — the crop engine's validateBbox
 * will run again at crop time as the gating point before any image I/O
 * (same pattern Agent 3's localizer uses).
 */
import type { DiagramDetectionResult } from '../../../core/diagram-detection/types';
export interface DiagramDetectionParseError {
    code: 'DIAGRAM_DETECTION_SCHEMA_INVALID';
    message: string;
}
/**
 * Parses a raw Gemini structured-output JSON object into a normalized
 * DiagramDetectionResult.
 *
 * Drops malformed entries silently (with a relaxed parse) only when they
 * are clearly outside our schema; throws on top-level shape mismatches.
 */
export declare function parseGeminiDiagramDetectionResponse(raw: unknown, sourceImagePath: string): DiagramDetectionResult;
//# sourceMappingURL=parser.d.ts.map