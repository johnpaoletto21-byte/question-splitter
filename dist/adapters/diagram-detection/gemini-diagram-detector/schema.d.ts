/**
 * adapters/diagram-detection/gemini-diagram-detector/schema.ts
 *
 * Gemini structured-output response schema for Agent D (Diagram Detector).
 *
 * The detector receives ONE image (a previously cropped exam question) and
 * returns one bbox per diagram found. bbox_1000 follows the same convention
 * as Agent 3's schema: [y_min, x_min, y_max, x_max] integers in 0-1000.
 */
export declare const GEMINI_DIAGRAM_DETECTOR_SCHEMA: Record<string, unknown>;
//# sourceMappingURL=schema.d.ts.map