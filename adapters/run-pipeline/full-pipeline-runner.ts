/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 */

import * as fs from 'fs';
import type { LocalConfig } from '../config/local-config/types';
import { renderPdfSource } from '../source-preparation/pdf-renderer';
import { segmentPages } from '../segmentation/gemini-segmenter';
import { reviewSegmentation } from '../segmentation-review/gemini-reviewer';
import { localizeTarget } from '../localization/gemini-localizer';
import { uploadToDrive } from '../upload/google-drive';
import { makeCanvasCropExecutor, makeCanvasImageStacker } from '../image-processing';
import {
  bootstrapRun,
  renderAllSources,
  runSegmentationStep,
  runReviewStep,
  runCropStep,
  runCompositionStep,
  runUploadStep,
} from '../../core/run-orchestrator';
import type {
  PageRenderer,
  Segmenter,
  SegmentationReviewer,
  Localizer,
  CropExecutor,
  ImageStackerFn,
  DriveUploaderFn,
} from '../../core/run-orchestrator';
import type { LocalizationResult } from '../../core/localization-contract/types';
import type { SegmentationResult } from '../../core/segmentation-contract/types';
import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../../core/run-summary/summary';
import type { RunSummaryState } from '../../core/run-summary/types';
import type { FinalResultRow } from '../../core/result-model/types';
import type { PromptSnapshot } from '../../core/prompt-config-store/types';
import type { ExtractionFieldDefinition } from '../../core/extraction-fields';
import {
  buildSegmentationPageWindows,
  getAllowedSegmentationRegionPageNumbers,
  mergeWindowedSegmentationResults,
  selectLocalizationContextPages,
} from './page-windows';

export interface PipelineLogEvent {
  stage: string;
  message: string;
  timestamp: string;
}

export interface RunFullPipelineInput {
  pdfFilePaths: string[];
  runLabel?: string;
  config: LocalConfig;
  extractionFields?: ExtractionFieldDefinition[];
  promptSnapshot?: PromptSnapshot;
  onLog?: (event: PipelineLogEvent) => void;
}

export interface RunFullPipelineDependencies {
  renderer?: PageRenderer;
  segmenter?: Segmenter;
  reviewer?: SegmentationReviewer;
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

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function errorCode(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as Record<string, unknown>)['code'] === 'string'
  ) {
    return (err as Record<string, string>)['code'];
  }
  return fallback;
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
    promptSnapshot: input.promptSnapshot,
  });
  emit(input.onLog, 'bootstrap', `Run ID: ${context.run_id}`);

  emit(input.onLog, 'render', 'Rendering PDF pages');
  const rendered = await renderAllSources(context, deps.renderer ?? renderPdfSource);
  emit(input.onLog, 'render', `Rendered ${rendered.preparedPages.length} page image(s)`);

  const extractionFields = input.extractionFields ?? [];
  const segmenter = deps.segmenter ?? ((
    runId,
    pages,
    profile,
    promptSnapshot,
    options,
  ) => segmentPages(
    runId,
    pages,
    profile,
    promptSnapshot,
    { apiKey: input.config.GEMINI_API_KEY },
    undefined,
    undefined,
    options,
  ));

  emit(input.onLog, 'segmentation', 'Running Agent 1 segmentation in page windows');
  const segmentationWindows = buildSegmentationPageWindows(rendered.preparedPages);
  const windowResults: SegmentationResult[] = [];
  for (const window of segmentationWindows) {
    const allowedRegionPageNumbers = getAllowedSegmentationRegionPageNumbers(
      window.focusPageNumber,
    );
    emit(
      input.onLog,
      'segmentation',
      `Agent 1 focus page ${window.focusPageNumber} with pages ` +
        `${window.pages.map((page) => page.page_number).join(', ')}; ` +
        `allowed output region pages ${allowedRegionPageNumbers.join(', ')}`,
    );
    try {
      windowResults.push(await runSegmentationStep(
        rendered.run_id,
        window.pages,
        rendered.activeProfile,
        rendered.promptSnapshot.agent1Prompt,
        segmenter,
        {
          focusPageNumber: window.focusPageNumber,
          allowedRegionPageNumbers,
          extractionFields,
        },
      ));
    } catch (err) {
      const message = formatUnknownError(err);
      const segmentationWindow = {
        focusPageNumber: window.focusPageNumber,
        pageNumbers: window.pages.map((page) => page.page_number),
        allowedRegionPageNumbers,
      };
      emit(
        input.onLog,
        'segmentation',
        `Agent 1 failed for focus page ${window.focusPageNumber}; ` +
          `allowed output region pages ${allowedRegionPageNumbers.join(', ')}; ${message}`,
      );
      throw {
        code: errorCode(err, 'SEGMENTATION_FAILED'),
        message,
        segmentationWindow,
      };
    }
  }
  const segmentation = mergeWindowedSegmentationResults(rendered.run_id, windowResults);
  emit(input.onLog, 'segmentation', `Agent 1 found ${segmentation.targets.length} target(s)`);

  const reviewer = deps.reviewer ?? ((
    runId,
    segResult,
    allPages,
    profile,
    promptSnapshot,
    opts,
  ) => reviewSegmentation(
    runId,
    segResult,
    allPages,
    profile,
    promptSnapshot,
    { apiKey: input.config.GEMINI_API_KEY },
    undefined,
    undefined,
    opts,
  ));

  emit(input.onLog, 'review', 'Running Agent 1.5 segmentation review');
  const reviewedSegmentation = await runReviewStep(
    rendered.run_id,
    segmentation,
    rendered.preparedPages,
    rendered.activeProfile,
    rendered.promptSnapshot.reviewerPrompt,
    reviewer,
    { extractionFields },
  );
  const wasCorrected = reviewedSegmentation !== segmentation;
  emit(
    input.onLog,
    'review',
    wasCorrected
      ? `Agent 1.5 corrected: ${reviewedSegmentation.targets.length} target(s) (Agent 1 had ${segmentation.targets.length})`
      : `Agent 1.5: pass (${segmentation.targets.length} target(s) confirmed)`,
  );

  let summary = buildRunSummaryFromSegmentation(reviewedSegmentation, extractionFields);

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
  const localized: LocalizationResult[] = [];
  const localizationFailureRows: FinalResultRow[] = [];
  for (const target of reviewedSegmentation.targets) {
    try {
      const result = await localizer(
        rendered.run_id,
        target,
        selectLocalizationContextPages(target, rendered.preparedPages),
        rendered.activeProfile,
        rendered.promptSnapshot.agent2Prompt,
      );
      localized.push(result);
      emit(input.onLog, 'localization', `Localized ${target.target_id}`);
    } catch (err) {
      const message = formatUnknownError(err);
      emit(input.onLog, 'localization', `Localization failed for ${target.target_id}: ${message}`);
      localizationFailureRows.push({
        target_id: target.target_id,
        source_pages: target.regions.map((r) => r.page_number),
        output_file_name: '',
        status: 'failed',
        failure_code: errorCode(err, 'LOCALIZATION_FAILED'),
        failure_message: message,
      });
    }
  }
  for (const result of localized) {
    summary = applyLocalizationToSummary(summary, result);
  }
  emit(
    input.onLog,
    'localization',
    `Localized ${localized.length} target(s); ${localizationFailureRows.length} failed`,
  );

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

  const finalRowMap = new Map<string, FinalResultRow>(
    [...finalRows, ...localizationFailureRows].map((row) => [row.target_id, row]),
  );
  const orderedFinalRows = reviewedSegmentation.targets
    .map((target) => finalRowMap.get(target.target_id))
    .filter((row): row is FinalResultRow => row !== undefined);

  summary = applyFinalResultsToSummary(summary, orderedFinalRows);
  emit(input.onLog, 'summary', 'Summary ready');
  return summary;
}
