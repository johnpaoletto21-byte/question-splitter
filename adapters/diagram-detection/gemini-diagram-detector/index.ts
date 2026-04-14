export {
  detectDiagrams,
  buildGeminiDiagramDetectionRequest,
  encodeImageAsBase64,
  unwrapGeminiDiagramResponse,
  DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL,
} from './detector';
export { GEMINI_DIAGRAM_DETECTOR_SCHEMA } from './schema';
export { parseGeminiDiagramDetectionResponse } from './parser';
export type {
  GeminiDiagramDetectorConfig,
  HttpPostFn,
  GeminiRawDiagram,
  GeminiRawDiagramDetectionOutput,
} from './types';
