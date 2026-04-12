/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 */

import * as fs from 'fs';
import type { LocalConfig } from '../config/local-config/types';
import { renderPdfSource } from '../source-preparation/pdf-renderer';
import { segmentPages } from '../segmentation/gemini-segmenter';
import { localizeTarget } from '../localization/gemini-localizer';
import { uploadToDrive } from '../upload/google-drive';
import { makeCanvasCropExecutor, makeCanvasImageStacker } from '../image-processing';
import {
  bootstrapRun,
  renderAllSources,
  runSegmentationStep,
  runLocalizationStep,
  runCropStep,
  runCompositionStep,
  runUploadStep,
} from '../../core/run-orchestrator';
import type {
  PageRenderer,
  Segmenter,
  Localizer,
  CropExecutor,
  ImageStackerFn,
  DriveUploaderFn,
} from '../../core/run-orchestrator';
import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../../core/run-summary/summary';
import type { RunSummaryState } from '../../core/run-summary/types';

export interface PipelineLogEvent {
  stage: string;
  message: string;
  timestamp: string;
}

export interface RunFullPipelineInput {
  pdfFilePaths: string[];
  runLabel?: string;
  config: LocalConfig;
  onLog?: (event: PipelineLogEvent) => void;
}

export interface RunFullPipelineDependencies {
  renderer?: PageRenderer;
  segmenter?: Segmenter;
  localizer?: Localizer;
  cropExecutor?: CropExecutor;
  imageStacker?: ImageStackerFn;
  driveUploader?: DriveUploaderFn;
}

function emit(
  onLog: ((event: PipelineLogEvent) => void) | undefined,
  stage: string,
  message: string,
): void {
  onLog?.({ stage, message, timestamp: new Date().toISOString() });
}

/**
 * Runs the complete local pipeline and returns the final summary state.
 */
export async function runFullPipeline(
  input: RunFullPipelineInput,
  deps: RunFullPipelineDependencies = {},
): Promise<RunSummaryState> {
  fs.mkdirSync(input.config.OUTPUT_DIR, { recursive: true });

  emit(input.onLog, 'bootstrap', 'Starting run');
  const context = bootstrapRun({
    pdfFilePaths: input.pdfFilePaths,
    config: input.config,
    runLabel: input.runLabel,
  });
  emit(input.onLog, 'bootstrap', `Run ID: ${context.run_id}`);

  emit(input.onLog, 'render', 'Rendering PDF pages');
  const rendered = await renderAllSources(context, deps.renderer ?? renderPdfSource);
  emit(input.onLog, 'render', `Rendered ${rendered.preparedPages.length} page image(s)`);

  const segmenter = deps.segmenter ?? ((
    runId,
    pages,
    profile,
    promptSnapshot,
  ) => segmentPages(
    runId,
    pages,
    profile,
    promptSnapshot,
    { apiKey: input.config.GEMINI_API_KEY },
  ));

  emit(input.onLog, 'segmentation', 'Running Agent 1 segmentation');
  const segmentation = await runSegmentationStep(
    rendered.run_id,
    rendered.preparedPages,
    rendered.activeProfile,
    rendered.promptSnapshot.agent1Prompt,
    segmenter,
  );
  emit(input.onLog, 'segmentation', `Agent 1 found ${segmentation.targets.length} target(s)`);

  let summary = buildRunSummaryFromSegmentation(segmentation);

  const localizer = deps.localizer ?? ((
    runId,
    target,
    pages,
    profile,
    promptSnapshot,
  ) => localizeTarget(
    runId,
    target,
    pages,
    profile,
    promptSnapshot,
    { apiKey: input.config.GEMINI_API_KEY },
  ));

  emit(input.onLog, 'localization', 'Running Agent 2 localization');
  const localized = await runLocalizationStep(
    rendered.run_id,
    segmentation,
    rendered.preparedPages,
    rendered.activeProfile,
    rendered.promptSnapshot.agent2Prompt,
    localizer,
  );
  for (const result of localized) {
    summary = applyLocalizationToSummary(summary, result);
  }
  emit(input.onLog, 'localization', `Localized ${localized.length} target(s)`);

  const cropExecutor = deps.cropExecutor ?? makeCanvasCropExecutor(input.config.OUTPUT_DIR);
  emit(input.onLog, 'crop', 'Cropping target regions');
  const cropResults = await runCropStep(
    rendered.run_id,
    localized,
    rendered.preparedPages,
    cropExecutor,
  );
  emit(input.onLog, 'crop', `Crop step produced ${cropResults.length} target result(s)`);

  const imageStacker = deps.imageStacker ?? makeCanvasImageStacker(
    input.config.OUTPUT_DIR,
    rendered.run_id,
  );
  emit(input.onLog, 'composition', 'Composing final output images');
  const composedRows = await runCompositionStep(
    rendered.run_id,
    cropResults,
    localized,
    rendered.activeProfile,
    imageStacker,
  );
  emit(input.onLog, 'composition', `Composition produced ${composedRows.length} result row(s)`);

  emit(input.onLog, 'upload', 'Uploading outputs to Google Drive');
  const finalRows = await runUploadStep(
    rendered.run_id,
    composedRows,
    input.config.DRIVE_FOLDER_ID,
    input.config.OAUTH_TOKEN_PATH,
    deps.driveUploader ?? uploadToDrive,
  );
  emit(input.onLog, 'upload', 'Drive upload step finished');

  summary = applyFinalResultsToSummary(summary, finalRows);
  emit(input.onLog, 'summary', 'Summary ready');
  return summary;
}
