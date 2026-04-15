/**
 * adapters/run-pipeline/hint-pipeline-runner.ts
 *
 * Adapter-layer glue for the hint annotator mode.
 *
 * Three methods:
 *   image-gen  → single Gemini image-generation call
 *   overlay    → Gemini JSON annotations → Canvas draws on original PNG
 *   blend      → Gemini JSON annotations → Gemini image-gen with specific instructions
 *
 * Mirrors the dependency-injection style of diagram-pipeline-runner.ts.
 */
import type { LocalConfig } from '../config/local-config/types';
import { type GeminiHintImageGenConfig, type HintImageGenResult } from '../hint-annotation/gemini-hint-image-gen';
import { type GeminiHintOverlayConfig, type HintOverlayResult } from '../hint-annotation/gemini-hint-overlay';
export type HintAnnotationMethod = 'image-gen' | 'overlay' | 'blend' | 'all';
export interface PipelineLogEvent {
    stage: string;
    message: string;
    timestamp: string;
}
export interface RunHintPipelineInput {
    /** Absolute path to the uploaded source PNG. */
    sourceImagePath: string;
    /** Run-scoped output directory. */
    outputDir: string;
    config: LocalConfig;
    /** Annotation method to use. */
    method: HintAnnotationMethod;
    /** Optional teacher-provided hint text. */
    hintText?: string;
    /** Override the default image-gen prompt. */
    imageGenPromptOverride?: string;
    /** Override the default overlay/JSON prompt. */
    overlayPromptOverride?: string;
    /** Override the default blend render prompt. */
    blendRenderPromptOverride?: string;
    /**
     * Override the default JSON response schema used for blend step 1
     * (overlay annotation call). Only honoured when method === 'blend'.
     */
    overlaySchemaOverride?: Record<string, unknown>;
    onLog?: (event: PipelineLogEvent) => void;
}
/** Image generation function signature. */
export type ImageGenFn = (sourceImagePath: string, promptText: string, config: GeminiHintImageGenConfig, outputPath: string) => Promise<HintImageGenResult>;
/** JSON annotation function signature. */
export type OverlayFn = (sourceImagePath: string, promptText: string, config: GeminiHintOverlayConfig, responseSchema?: Record<string, unknown>) => Promise<HintOverlayResult>;
/** Canvas render function signature. */
export type CanvasRenderFn = (sourceImagePath: string, annotations: HintOverlayResult['annotations'], outputPath: string) => Promise<void>;
export interface RunHintPipelineDependencies {
    imageGen?: ImageGenFn;
    overlay?: OverlayFn;
    canvasRender?: CanvasRenderFn;
}
export interface HintPipelineResult {
    /** Absolute path to the annotated output image. */
    annotatedImagePath: string;
    /** Method used for annotation. */
    method: HintAnnotationMethod;
}
/**
 * Runs the hint annotation pipeline end-to-end.
 */
export declare function runHintPipeline(input: RunHintPipelineInput, deps?: RunHintPipelineDependencies): Promise<HintPipelineResult>;
//# sourceMappingURL=hint-pipeline-runner.d.ts.map