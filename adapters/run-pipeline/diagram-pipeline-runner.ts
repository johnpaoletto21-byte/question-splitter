/**
 * adapters/run-pipeline/diagram-pipeline-runner.ts
 *
 * Adapter-layer glue for the diagram-only cropper.
 *
 * Flow:
 *   Read source PNG dimensions
 *     → Detect diagrams (Agent D, single Gemini call)
 *     → For each bbox: validate, convert to pixels, crop to file
 *     → Render sanity-overlay PNG with red rectangles around each crop
 *
 * No PDF rendering, no segmentation, no deduplication, no stacking.
 * Mirrors the dependency-injection style of full-pipeline-runner.ts so tests
 * can swap in fakes without network or canvas calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LocalConfig } from '../config/local-config/types';
import {
  detectDiagrams,
  type GeminiDiagramDetectorConfig,
} from '../diagram-detection/gemini-diagram-detector';
import {
  cropImageToFile,
  drawDiagramOverlayToFile,
  getImageDimensions,
} from '../image-processing';
import {
  cropDiagrams,
  type DiagramCropper,
  type DiagramOverlayRenderer,
} from '../../core/diagram-detection';
import type {
  DiagramDetectionResult,
  DiagramRunResult,
} from '../../core/diagram-detection/types';
import { DEFAULT_DIAGRAM_DETECTOR_PROMPT } from '../../core/prompt-config-store/default-prompts';

export interface PipelineLogEvent {
  stage: string;
  message: string;
  timestamp: string;
}

export interface RunDiagramPipelineInput {
  /** Absolute path to the uploaded source PNG (a previously cropped question). */
  sourceImagePath: string;
  /** Run-scoped output directory; the runner writes diagrams + overlay here. */
  outputDir: string;
  config: LocalConfig;
  /** Override the default detector prompt (e.g. for prompt experiments). */
  promptOverride?: string;
  /** Override the default Gemini model (e.g. for comparing flash-lite vs flash). */
  modelOverride?: string;
  onLog?: (event: PipelineLogEvent) => void;
}

/** Detector signature — accepts the source image + prompt, returns bboxes. */
export type DetectorFn = (
  sourceImagePath: string,
  promptText: string,
  config: GeminiDiagramDetectorConfig,
) => Promise<DiagramDetectionResult>;

export interface RunDiagramPipelineDependencies {
  detector?: DetectorFn;
  cropper?: DiagramCropper;
  overlayRenderer?: DiagramOverlayRenderer;
  imageDimensions?: (
    imagePath: string,
  ) => Promise<{ width: number; height: number }>;
}

function emit(
  onLog: ((event: PipelineLogEvent) => void) | undefined,
  stage: string,
  message: string,
): void {
  onLog?.({ stage, message, timestamp: new Date().toISOString() });
}

/**
 * Runs the diagram-only pipeline end-to-end and returns the result summary.
 */
export async function runDiagramPipeline(
  input: RunDiagramPipelineInput,
  deps: RunDiagramPipelineDependencies = {},
): Promise<DiagramRunResult> {
  fs.mkdirSync(input.outputDir, { recursive: true });

  if (!fs.existsSync(input.sourceImagePath)) {
    throw new Error(`Source image not found at ${input.sourceImagePath}`);
  }

  const promptText = input.promptOverride?.trim()
    ? input.promptOverride
    : DEFAULT_DIAGRAM_DETECTOR_PROMPT;

  emit(input.onLog, 'dimensions', 'Reading source image dimensions');
  const dimensionsFn = deps.imageDimensions ?? getImageDimensions;
  const { width: sourceWidth, height: sourceHeight } = await dimensionsFn(
    input.sourceImagePath,
  );
  emit(
    input.onLog,
    'dimensions',
    `Source image: ${sourceWidth} × ${sourceHeight} px`,
  );

  const detectorModel = input.modelOverride ?? undefined;
  emit(input.onLog, 'detect', `Calling Gemini diagram detector (Agent D)${detectorModel ? ` with model ${detectorModel}` : ''}`);
  const detector = deps.detector ?? defaultDetector;
  const detection = await detector(input.sourceImagePath, promptText, {
    apiKey: input.config.GEMINI_API_KEY,
    model: detectorModel,
  });
  emit(
    input.onLog,
    'detect',
    `Detector returned ${detection.diagrams.length} diagram(s)`,
  );

  emit(input.onLog, 'crop', 'Cropping individual diagrams');
  const cropper = deps.cropper ?? cropImageToFile;
  const overlayRenderer = deps.overlayRenderer ?? drawDiagramOverlayToFile;

  const result = await cropDiagrams(
    {
      detection,
      sourceWidth,
      sourceHeight,
      outputDir: input.outputDir,
    },
    cropper,
    overlayRenderer,
  );
  const okCount = result.diagrams.filter((d) => d.status === 'ok').length;
  const failCount = result.diagrams.length - okCount;
  emit(
    input.onLog,
    'crop',
    `Wrote ${okCount} diagram crop(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
  );

  emit(
    input.onLog,
    'overlay',
    `Sanity overlay written to ${path.relative(input.outputDir, result.overlay_image_path)}`,
  );

  return result;
}

const defaultDetector: DetectorFn = (sourceImagePath, promptText, config) =>
  detectDiagrams(sourceImagePath, promptText, config);
