/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 *
 * New flow:
 *   Render → [per chunk: Segment → Review → Localize (sliding windows)] → Dedup → Crop → Compose → Upload
 */

import * as fs from 'fs';
import type { LocalConfig } from '../config/local-config/types';
import { renderPdfSource } from '../source-preparation/pdf-renderer';
import { segmentPages } from '../segmentation/gemini-segmenter';
import { reviewSegmentation } from '../segmentation-review/gemini-reviewer';
import { localizeWindow } from '../localization/gemini-localizer';
import { deduplicateTargets } from '../deduplication/gemini-deduplicator';
import { uploadToDrive } from '../upload/google-drive';
import { makeCanvasCropExecutor, makeCanvasImageStacker } from '../image-processing';
import {
  bootstrapRun,
  renderAllSources,
  runSegmentationStep,
  runReviewStep,
  runDeduplicationStep,
  runCropStep,
  runCompositionStep,
  runUploadStep,
  assembleLocalizationResults,
} from '../../core/run-orchestrator';
import type {
  PageRenderer,
  Segmenter,
  SegmentationReviewer,
  WindowLocalizer,
  Deduplicator,
  CropExecutor,
  ImageStackerFn,
  DriveUploaderFn,
} from '../../core/run-orchestrator';
import type { LocalizationResult } from '../../core/localization-contract/types';
import type { SegmentationResult } from '../../core/segmentation-contract/types';
import type {
  DeduplicationInput,
  DeduplicationChunkInput,
  DeduplicationTargetInput,
  DeduplicationResult,
} from '../../core/deduplication-contract/types';
import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../../core/run-summary/summary';
import type { RunSummaryState } from '../../core/run-summary/types';
import type { FinalResultRow } from '../../core/result-model/types';
import type { PromptSnapshot } from '../../core/prompt-config-store/types';
import type { ExtractionFieldDefinition } from '../../core/extraction-fields';
import type { WindowLocalizationResult } from '../../core/run-orchestrator/localization-step';
import {
  buildChunkedPageWindows,
  buildLocalizationWindows,
  getOverlapZones,
} from './page-windows';
import type { ChunkWindow } from './page-windows';
import type { DebugData, SegmentationChunkDebug, ReviewChunkDebug } from '../../core/run-summary/debug-types';

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
  /** Pages per chunk (default 10). */
  chunkSize?: number;
  /** Overlap pages between consecutive chunks (default 3). */
  chunkOverlap?: number;
}

export interface RunFullPipelineDependencies {
  renderer?: PageRenderer;
  segmenter?: Segmenter;
  reviewer?: SegmentationReviewer;
  windowLocalizer?: WindowLocalizer;
  deduplicator?: Deduplicator;
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
  const chunkSize = input.chunkSize ?? 10;
  const chunkOverlap = input.chunkOverlap ?? 3;

  // Build segmenter function
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

  // Build reviewer function
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

  // Build window localizer function
  const windowLocalizer = deps.windowLocalizer ?? ((
    runId,
    questionList,
    windowPages,
    profile,
    promptSnapshot,
  ) => localizeWindow(
    runId,
    questionList,
    windowPages,
    profile,
    promptSnapshot,
    { apiKey: input.config.GEMINI_API_KEY },
  ));

  // ---------------------------------------------------------------------------
  // Phase 1: Per-chunk processing (Segment → Review → Localize via sliding windows)
  // ---------------------------------------------------------------------------

  emit(input.onLog, 'segmentation', `Building ${chunkSize}-page chunks with ${chunkOverlap}-page overlap`);
  const chunks = buildChunkedPageWindows(rendered.preparedPages, chunkSize, chunkOverlap);
  emit(input.onLog, 'segmentation', `Created ${chunks.length} chunk(s)`);

  const agent1ChunkResults: SegmentationChunkDebug[] = [];
  const reviewChunkResults: ReviewChunkDebug[] = [];
  const allLocalized: LocalizationResult[] = [];
  const localizationFailureRows: FinalResultRow[] = [];
  const dedupChunkInputs: DeduplicationChunkInput[] = [];

  for (const chunk of chunks) {
    emit(
      input.onLog,
      'segmentation',
      `Chunk ${chunk.chunkIndex}: pages ${chunk.startPage}-${chunk.endPage}`,
    );

    // Agent 1: Segment this chunk (produces question inventory, no regions)
    let segmentation: SegmentationResult;
    try {
      segmentation = await runSegmentationStep(
        rendered.run_id,
        chunk.pages,
        rendered.activeProfile,
        rendered.promptSnapshot.agent1Prompt,
        segmenter,
        {
          extractionFields,
          chunkStartPage: chunk.startPage,
          chunkEndPage: chunk.endPage,
        },
      );
    } catch (err) {
      const message = formatUnknownError(err);
      emit(input.onLog, 'segmentation', `Agent 1 failed for chunk ${chunk.chunkIndex}: ${message}`);
      throw {
        code: errorCode(err, 'SEGMENTATION_FAILED'),
        message,
        chunk: { chunkIndex: chunk.chunkIndex, startPage: chunk.startPage, endPage: chunk.endPage },
      };
    }
    emit(
      input.onLog,
      'segmentation',
      `Chunk ${chunk.chunkIndex}: Agent 1 found ${segmentation.targets.length} target(s)`,
    );

    agent1ChunkResults.push({
      chunkIndex: chunk.chunkIndex,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      contextPageNumbers: chunk.pages.map((p) => p.page_number),
      targets: segmentation.targets,
    });

    // Agent 2: Review this chunk's segmentation
    emit(input.onLog, 'review', `Chunk ${chunk.chunkIndex}: running review`);
    let reviewedSegmentation: SegmentationResult;
    try {
      reviewedSegmentation = await runReviewStep(
        rendered.run_id,
        segmentation,
        chunk.pages,
        rendered.activeProfile,
        rendered.promptSnapshot.reviewerPrompt,
        reviewer,
        { extractionFields },
      );
    } catch (err) {
      const message = formatUnknownError(err);
      emit(input.onLog, 'review', `Agent 2 review failed for chunk ${chunk.chunkIndex}: ${message}`);
      // Use segmentation result as fallback if review fails
      reviewedSegmentation = segmentation;
    }
    const wasCorrected = reviewedSegmentation !== segmentation;
    emit(
      input.onLog,
      'review',
      `Chunk ${chunk.chunkIndex}: ${wasCorrected ? 'corrected' : 'pass'} (${reviewedSegmentation.targets.length} target(s))`,
    );

    reviewChunkResults.push({
      chunkIndex: chunk.chunkIndex,
      corrected: wasCorrected,
      targets: reviewedSegmentation.targets,
    });

    // Agent 3: Localize via sliding windows
    emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: building localization windows`);
    const locWindows = buildLocalizationWindows(chunk.pages);
    emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: ${locWindows.length} window(s)`);

    const windowResults: WindowLocalizationResult[] = [];
    for (const win of locWindows) {
      try {
        const result = await windowLocalizer(
          rendered.run_id,
          reviewedSegmentation.targets,
          win.pages,
          rendered.activeProfile,
          rendered.promptSnapshot.agent2Prompt,
        );
        windowResults.push(result);
        emit(
          input.onLog,
          'localization',
          `Chunk ${chunk.chunkIndex}, window ${win.windowIndex}: found ${result.regions.length} region(s)`,
        );
      } catch (err) {
        const message = formatUnknownError(err);
        emit(
          input.onLog,
          'localization',
          `Chunk ${chunk.chunkIndex}, window ${win.windowIndex}: localization failed: ${message}`,
        );
        // Window failures are not fatal — other windows may still cover the same questions
      }
    }

    // Assemble per-window results into per-target LocalizationResults
    const chunkLocalized = assembleLocalizationResults(
      rendered.run_id,
      reviewedSegmentation.targets,
      windowResults,
      locWindows,
    );

    // Track targets that weren't found in any window
    const localizedTargetIds = new Set(chunkLocalized.map((l) => l.target_id));
    for (const target of reviewedSegmentation.targets) {
      if (!localizedTargetIds.has(target.target_id)) {
        localizationFailureRows.push({
          target_id: target.target_id,
          source_pages: [],
          output_file_name: '',
          status: 'failed',
          failure_code: 'LOCALIZATION_NOT_FOUND',
          failure_message: `Question ${target.question_number ?? target.target_id} not found in any localization window`,
        });
      }
    }

    for (const loc of chunkLocalized) {
      allLocalized.push(loc);
    }
    emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: localized ${chunkLocalized.length} target(s)`);

    // Build dedup input for this chunk
    const chunkTargets: DeduplicationTargetInput[] = chunkLocalized.map((loc) => {
      const segTarget = reviewedSegmentation.targets.find((t) => t.target_id === loc.target_id);
      return {
        target_id: `chunk${chunk.chunkIndex}_${loc.target_id}`,
        target_type: segTarget?.target_type ?? 'question',
        question_number: segTarget?.question_number,
        question_text: segTarget?.question_text,
        sub_questions: segTarget?.sub_questions,
        regions: loc.regions,
        extraction_fields: segTarget?.extraction_fields,
        review_comment: segTarget?.review_comment,
      };
    });

    dedupChunkInputs.push({
      chunk_index: chunk.chunkIndex,
      start_page: chunk.startPage,
      end_page: chunk.endPage,
      targets: chunkTargets,
    });
  }

  emit(
    input.onLog,
    'localization',
    `All chunks: ${allLocalized.length} localized, ${localizationFailureRows.length} failed`,
  );

  // ---------------------------------------------------------------------------
  // Phase 2: Deduplication (if multiple chunks)
  // ---------------------------------------------------------------------------

  let dedupResult: DeduplicationResult | undefined;
  let finalLocalized: LocalizationResult[];

  if (chunks.length <= 1) {
    // Single chunk — no dedup needed, use localized results directly
    finalLocalized = allLocalized;
    emit(input.onLog, 'deduplication', 'Single chunk — skipping deduplication');
  } else {
    emit(input.onLog, 'deduplication', 'Running Agent 4 deduplication across all chunks');

    const overlapZones = getOverlapZones(chunks);
    const dedupInput: DeduplicationInput = {
      run_id: rendered.run_id,
      chunks: dedupChunkInputs,
      overlap_zones: overlapZones,
    };

    const deduplicator = deps.deduplicator ?? ((
      dedupIn: DeduplicationInput,
      promptSnapshot: string,
    ) => deduplicateTargets(
      dedupIn,
      promptSnapshot,
      { apiKey: input.config.GEMINI_API_KEY },
    ));

    try {
      dedupResult = await runDeduplicationStep(
        dedupInput,
        rendered.promptSnapshot.deduplicatorPrompt,
        deduplicator,
      );
    } catch (err) {
      const message = formatUnknownError(err);
      emit(input.onLog, 'deduplication', `Agent 4 failed: ${message}`);
      throw {
        code: errorCode(err, 'DEDUPLICATION_FAILED'),
        message,
      };
    }

    emit(
      input.onLog,
      'deduplication',
      `Dedup: ${dedupResult.targets.length} target(s) from ${allLocalized.length} pre-dedup`,
    );

    // Convert deduplicated targets into LocalizationResult format for crop/compose
    finalLocalized = dedupResult.targets.map((dt) => ({
      run_id: rendered.run_id,
      target_id: dt.target_id,
      regions: dt.regions,
    }));
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Build summary from final target list
  // ---------------------------------------------------------------------------

  // Build a synthetic SegmentationResult from the final targets for summary
  const finalSegmentation: SegmentationResult = {
    run_id: rendered.run_id,
    targets: finalLocalized.map((loc) => {
      const dedupTarget = dedupResult?.targets.find((t) => t.target_id === loc.target_id);
      return {
        target_id: loc.target_id,
        target_type: dedupTarget?.target_type ?? 'question',
        question_number: dedupTarget?.question_number,
        question_text: dedupTarget?.question_text,
        sub_questions: dedupTarget?.sub_questions,
        extraction_fields: dedupTarget?.extraction_fields,
      };
    }),
  };

  let summary = buildRunSummaryFromSegmentation(finalSegmentation, extractionFields, finalLocalized);

  for (const result of finalLocalized) {
    summary = applyLocalizationToSummary(summary, result);
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Crop → Compose → Upload (unchanged)
  // ---------------------------------------------------------------------------

  const cropExecutor = deps.cropExecutor ?? makeCanvasCropExecutor(input.config.OUTPUT_DIR);
  emit(input.onLog, 'crop', 'Cropping target regions');
  const cropResults = await runCropStep(
    rendered.run_id,
    finalLocalized,
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
    finalLocalized,
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
  const orderedFinalRows = finalSegmentation.targets
    .map((target) => finalRowMap.get(target.target_id))
    .filter((row): row is FinalResultRow => row !== undefined);

  summary = applyFinalResultsToSummary(summary, orderedFinalRows);

  const debugData: DebugData = {
    agent1ChunkResults,
    reviewChunkResults,
    localizationResults: allLocalized,
    localizationFailures: localizationFailureRows.map((row) => ({
      targetId: row.target_id,
      sourcePages: row.source_pages,
      failureCode: row.status === 'failed' ? row.failure_code : 'UNKNOWN',
      failureMessage: row.status === 'failed' ? row.failure_message : '',
    })),
    deduplicationResult: dedupResult,
    deduplicationMergeLog: dedupResult?.merge_log,
  };
  summary = { ...summary, debugData };

  emit(input.onLog, 'summary', 'Summary ready');
  return summary;
}
