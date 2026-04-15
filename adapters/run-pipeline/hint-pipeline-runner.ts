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

import * as fs from 'fs';
import * as path from 'path';
import type { LocalConfig } from '../config/local-config/types';
import {
  generateHintImage,
  type GeminiHintImageGenConfig,
  type HintImageGenResult,
} from '../hint-annotation/gemini-hint-image-gen';
import {
  getHintAnnotations,
  type GeminiHintOverlayConfig,
  type HintOverlayResult,
} from '../hint-annotation/gemini-hint-overlay';
import { drawAnnotationsOnImage } from '../hint-annotation/canvas-renderer';
import {
  DEFAULT_HINT_IMAGE_GEN_PROMPT,
  DEFAULT_HINT_OVERLAY_PROMPT,
  DEFAULT_HINT_BLEND_RENDER_PROMPT,
} from '../../core/prompt-config-store/default-prompts';

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
export type ImageGenFn = (
  sourceImagePath: string,
  promptText: string,
  config: GeminiHintImageGenConfig,
  outputPath: string,
) => Promise<HintImageGenResult>;

/** JSON annotation function signature. */
export type OverlayFn = (
  sourceImagePath: string,
  promptText: string,
  config: GeminiHintOverlayConfig,
  responseSchema?: Record<string, unknown>,
) => Promise<HintOverlayResult>;

/** Canvas render function signature. */
export type CanvasRenderFn = (
  sourceImagePath: string,
  annotations: HintOverlayResult['annotations'],
  outputPath: string,
) => Promise<void>;

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

function emit(
  onLog: ((event: PipelineLogEvent) => void) | undefined,
  stage: string,
  message: string,
): void {
  onLog?.({ stage, message, timestamp: new Date().toISOString() });
}

function resolvePrompt(override: string | undefined, fallback: string): string {
  return override?.trim() ? override : fallback;
}

function appendHint(prompt: string, hintText: string | undefined): string {
  if (!hintText?.trim()) return prompt;
  return `${prompt}\n\nHint from the teacher: ${hintText.trim()}`;
}

/**
 * Runs the hint annotation pipeline end-to-end.
 */
export async function runHintPipeline(
  input: RunHintPipelineInput,
  deps: RunHintPipelineDependencies = {},
): Promise<HintPipelineResult> {
  fs.mkdirSync(input.outputDir, { recursive: true });

  if (!fs.existsSync(input.sourceImagePath)) {
    throw new Error(`Source image not found at ${input.sourceImagePath}`);
  }

  const outputPath = path.join(input.outputDir, 'annotated.png');
  const apiConfig = { apiKey: input.config.GEMINI_API_KEY };

  switch (input.method) {
    case 'image-gen': {
      emit(input.onLog, 'annotate', 'Method: Image Generation');
      const prompt = appendHint(
        resolvePrompt(input.imageGenPromptOverride, DEFAULT_HINT_IMAGE_GEN_PROMPT),
        input.hintText,
      );
      emit(input.onLog, 'annotate', 'Calling Gemini image generation model');
      const imageGenFn = deps.imageGen ?? generateHintImage;
      const result = await imageGenFn(input.sourceImagePath, prompt, apiConfig, outputPath);
      emit(input.onLog, 'annotate', `Image generated using ${result.model}`);
      return { annotatedImagePath: outputPath, method: 'image-gen' };
    }

    case 'overlay': {
      emit(input.onLog, 'annotate', 'Method: JSON + Canvas Overlay');
      const prompt = appendHint(
        resolvePrompt(input.overlayPromptOverride, DEFAULT_HINT_OVERLAY_PROMPT),
        input.hintText,
      );
      emit(input.onLog, 'annotate', 'Calling Gemini for annotation instructions (JSON)');
      const overlayFn = deps.overlay ?? getHintAnnotations;
      const overlayResult = await overlayFn(input.sourceImagePath, prompt, apiConfig);
      emit(
        input.onLog,
        'annotate',
        `Received ${overlayResult.annotations.length} annotation instruction(s)`,
      );

      emit(input.onLog, 'render', 'Drawing annotations on source image with Canvas');
      const renderFn = deps.canvasRender ?? drawAnnotationsOnImage;
      await renderFn(input.sourceImagePath, overlayResult.annotations, outputPath);
      emit(input.onLog, 'render', 'Annotated image written');
      return { annotatedImagePath: outputPath, method: 'overlay' };
    }

    case 'blend': {
      emit(input.onLog, 'annotate', 'Method: Blend (JSON reasoning + image generation)');

      if (input.overlayPromptOverride?.trim()) {
        emit(input.onLog, 'annotate', 'Step 1: using custom overlay prompt');
      }
      if (input.overlaySchemaOverride) {
        emit(input.onLog, 'annotate', 'Step 1: using custom response schema');
      }
      if (input.blendRenderPromptOverride?.trim()) {
        emit(input.onLog, 'render', 'Step 2: using custom blend render prompt');
      }

      // Step 1: Get structured annotations via JSON
      const overlayPrompt = appendHint(
        resolvePrompt(input.overlayPromptOverride, DEFAULT_HINT_OVERLAY_PROMPT),
        input.hintText,
      );
      emit(input.onLog, 'annotate', 'Step 1: Calling Gemini for annotation instructions (JSON)');
      const overlayFn = deps.overlay ?? getHintAnnotations;
      const overlayResult = await overlayFn(
        input.sourceImagePath,
        overlayPrompt,
        apiConfig,
        input.overlaySchemaOverride,
      );
      emit(
        input.onLog,
        'annotate',
        `Step 1 complete: ${overlayResult.annotations.length} annotation instruction(s)`,
      );

      // Step 2: Feed annotations to image generation model
      const annotationsJson = JSON.stringify(overlayResult.annotations, null, 2);
      const blendRenderPrompt = resolvePrompt(
        input.blendRenderPromptOverride,
        DEFAULT_HINT_BLEND_RENDER_PROMPT,
      ).replace('{annotations_json}', annotationsJson);

      emit(input.onLog, 'render', 'Step 2: Calling Gemini image generation with specific instructions');
      const imageGenFn = deps.imageGen ?? generateHintImage;
      const result = await imageGenFn(input.sourceImagePath, blendRenderPrompt, apiConfig, outputPath);
      emit(input.onLog, 'render', `Step 2 complete: image generated using ${result.model}`);
      return { annotatedImagePath: outputPath, method: 'blend' };
    }

    default:
      throw new Error(`Unknown hint annotation method: ${input.method}`);
  }
}
