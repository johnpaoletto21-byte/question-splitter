export {
  getHintAnnotations,
  buildGeminiHintOverlayRequest,
  unwrapGeminiOverlayResponse,
  encodeImageAsBase64,
  DEFAULT_HINT_OVERLAY_MODEL,
} from './annotator';
export { GEMINI_HINT_OVERLAY_SCHEMA } from './schema';
export type {
  GeminiHintOverlayConfig,
  HttpPostFn,
  AnnotationInstruction,
  LineInstruction,
  ArrowInstruction,
  ArcInstruction,
  TextInstruction,
  HintOverlayResult,
} from './types';
