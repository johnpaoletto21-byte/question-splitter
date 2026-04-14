/**
 * adapters/diagram-detection/gemini-diagram-detector/detector.ts
 *
 * Main Gemini adapter for Agent D (Diagram Detector).
 *
 * Receives ONE source image (a previously cropped exam question) and returns
 * one bbox per diagram detected. Mirrors the structure of the existing
 * Agent 1 segmenter and Agent 3 localizer adapters.
 *
 * No repair retries here — the schema constrains the response shape and
 * downstream `validateBbox` (in core/crop-engine/bbox.ts) gates any bad bbox
 * before image I/O, so an occasional bogus value just becomes a per-diagram
 * failed result instead of killing the run.
 */
import type { DiagramDetectionResult } from '../../../core/diagram-detection/types';
import type { GeminiDiagramDetectorConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL = "gemini-3.1-flash-lite-preview";
export declare function encodeImageAsBase64(imagePath: string): string;
export declare function buildGeminiDiagramDetectionRequest(promptText: string, imagePath: string, encodeFn?: (path: string) => string, responseSchema?: Record<string, unknown>): Record<string, unknown>;
export declare function unwrapGeminiDiagramResponse(raw: unknown): unknown;
/**
 * Calls Gemini Vision to detect diagrams in a single source image.
 *
 * @param sourceImagePath  Absolute path to the PNG to analyze.
 * @param promptText       Final prompt text (caller resolves snapshot vs. default).
 * @param config           Gemini API key and optional model name.
 * @param httpPost         Injectable HTTP client (defaults to native fetch).
 * @param encodeFn         Injectable image encoder (defaults to readFileSync+base64).
 * @returns                Normalized DiagramDetectionResult.
 */
export declare function detectDiagrams(sourceImagePath: string, promptText: string, config: GeminiDiagramDetectorConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string): Promise<DiagramDetectionResult>;
//# sourceMappingURL=detector.d.ts.map