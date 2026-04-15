/**
 * adapters/ui/local-app/run-state.ts
 *
 * In-memory run state for the single-user local app.
 */

import type { RunSummaryState } from '../../../core/run-summary/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { PromptSnapshot } from '../../../core/prompt-config-store/types';
import type { DiagramRunResult } from '../../../core/diagram-detection/types';
import type { HintAnnotationMethod, HintPipelineResult } from '../../run-pipeline/hint-pipeline-runner';

export type LocalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface LocalRunLogEntry {
  timestamp: string;
  stage: string;
  message: string;
}

export interface LocalRunRecord {
  id: string;
  status: LocalRunStatus;
  runLabel?: string;
  pdfFileName?: string;
  pdfFilePath?: string;
  outputDir?: string;
  createdAt: string;
  updatedAt: string;
  logs: LocalRunLogEntry[];
  extractionFields: ExtractionFieldDefinition[];
  promptSnapshot?: PromptSnapshot;
  summary?: RunSummaryState;
  error?: string;
  failureContext?: unknown;
}

const runs = new Map<string, LocalRunRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function makeRunId(): string {
  const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `local_run_${Date.now()}_${random}`;
}

export function createRunRecord(input: {
  runLabel?: string;
  pdfFileName?: string;
  pdfFilePath?: string;
  outputDir?: string;
  extractionFields?: ExtractionFieldDefinition[];
  promptSnapshot?: PromptSnapshot;
}): LocalRunRecord {
  const timestamp = nowIso();
  const record: LocalRunRecord = {
    id: makeRunId(),
    status: 'queued',
    runLabel: input.runLabel,
    pdfFileName: input.pdfFileName,
    pdfFilePath: input.pdfFilePath,
    outputDir: input.outputDir,
    createdAt: timestamp,
    updatedAt: timestamp,
    logs: [],
    extractionFields: input.extractionFields ?? [],
    promptSnapshot: input.promptSnapshot,
  };
  runs.set(record.id, record);
  return record;
}

export function getRunRecord(id: string): LocalRunRecord | undefined {
  return runs.get(id);
}

export function appendRunLog(
  id: string,
  stage: string,
  message: string,
  timestamp: string = nowIso(),
): void {
  const record = runs.get(id);
  if (!record) {
    return;
  }
  record.logs.push({ stage, message, timestamp });
  record.updatedAt = timestamp;
}

export function markRunStatus(id: string, status: LocalRunStatus): void {
  const record = runs.get(id);
  if (!record) {
    return;
  }
  record.status = status;
  record.updatedAt = nowIso();
}

export function markRunSucceeded(id: string, summary: RunSummaryState): void {
  const record = runs.get(id);
  if (!record) {
    return;
  }
  record.status = 'succeeded';
  record.summary = summary;
  record.updatedAt = nowIso();
}

export function markRunFailed(id: string, error: string, failureContext?: unknown): void {
  const record = runs.get(id);
  if (!record) {
    return;
  }
  record.status = 'failed';
  record.error = error;
  record.failureContext = failureContext;
  record.updatedAt = nowIso();
}

export function resetRunRecordsForTests(): void {
  runs.clear();
  diagramRuns.clear();
  hintRuns.clear();
}

// ---------------------------------------------------------------------------
// Diagram-only run records (parallel to the question-pipeline records above)
// ---------------------------------------------------------------------------

export interface LocalDiagramRunRecord {
  id: string;
  status: LocalRunStatus;
  imageFileName?: string;
  imageFilePath?: string;
  outputDir?: string;
  runOutputDir?: string;
  createdAt: string;
  updatedAt: string;
  logs: LocalRunLogEntry[];
  result?: DiagramRunResult;
  error?: string;
}

const diagramRuns = new Map<string, LocalDiagramRunRecord>();

function makeDiagramRunId(): string {
  const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `local_diagram_run_${Date.now()}_${random}`;
}

export function createDiagramRunRecord(input: {
  imageFileName?: string;
  imageFilePath?: string;
  outputDir?: string;
  runOutputDir?: string;
}): LocalDiagramRunRecord {
  const timestamp = nowIso();
  const record: LocalDiagramRunRecord = {
    id: makeDiagramRunId(),
    status: 'queued',
    imageFileName: input.imageFileName,
    imageFilePath: input.imageFilePath,
    outputDir: input.outputDir,
    runOutputDir: input.runOutputDir,
    createdAt: timestamp,
    updatedAt: timestamp,
    logs: [],
  };
  diagramRuns.set(record.id, record);
  return record;
}

export function getDiagramRunRecord(id: string): LocalDiagramRunRecord | undefined {
  return diagramRuns.get(id);
}

export function appendDiagramRunLog(
  id: string,
  stage: string,
  message: string,
  timestamp: string = nowIso(),
): void {
  const record = diagramRuns.get(id);
  if (!record) {
    return;
  }
  record.logs.push({ stage, message, timestamp });
  record.updatedAt = timestamp;
}

export function markDiagramRunStatus(id: string, status: LocalRunStatus): void {
  const record = diagramRuns.get(id);
  if (!record) {
    return;
  }
  record.status = status;
  record.updatedAt = nowIso();
}

export function markDiagramRunSucceeded(id: string, result: DiagramRunResult): void {
  const record = diagramRuns.get(id);
  if (!record) {
    return;
  }
  record.status = 'succeeded';
  record.result = result;
  record.updatedAt = nowIso();
}

export function markDiagramRunFailed(id: string, error: string): void {
  const record = diagramRuns.get(id);
  if (!record) {
    return;
  }
  record.status = 'failed';
  record.error = error;
  record.updatedAt = nowIso();
}

// ---------------------------------------------------------------------------
// Hint annotator run records
// ---------------------------------------------------------------------------

export interface LocalHintRunRecord {
  id: string;
  status: LocalRunStatus;
  imageFileName?: string;
  imageFilePath?: string;
  hintText?: string;
  method?: HintAnnotationMethod;
  outputDir?: string;
  runOutputDir?: string;
  createdAt: string;
  updatedAt: string;
  logs: LocalRunLogEntry[];
  result?: HintPipelineResult;
  allResults?: Partial<Record<HintAnnotationMethod, HintPipelineResult>>;
  error?: string;
  /**
   * Blend-mode override values actually submitted with the run, retained so the
   * results page can pre-fill the retry form identically to what the user sent.
   * Schema is stored as the raw JSON text the user typed.
   */
  blendOverlayPrompt?: string;
  blendOverlaySchema?: string;
  blendRenderPrompt?: string;
}

const hintRuns = new Map<string, LocalHintRunRecord>();

function makeHintRunId(): string {
  const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `local_hint_run_${Date.now()}_${random}`;
}

export function createHintRunRecord(input: {
  imageFileName?: string;
  imageFilePath?: string;
  hintText?: string;
  method?: HintAnnotationMethod;
  outputDir?: string;
  runOutputDir?: string;
  blendOverlayPrompt?: string;
  blendOverlaySchema?: string;
  blendRenderPrompt?: string;
}): LocalHintRunRecord {
  const timestamp = nowIso();
  const record: LocalHintRunRecord = {
    id: makeHintRunId(),
    status: 'queued',
    imageFileName: input.imageFileName,
    imageFilePath: input.imageFilePath,
    hintText: input.hintText,
    method: input.method,
    outputDir: input.outputDir,
    runOutputDir: input.runOutputDir,
    createdAt: timestamp,
    updatedAt: timestamp,
    logs: [],
    blendOverlayPrompt: input.blendOverlayPrompt,
    blendOverlaySchema: input.blendOverlaySchema,
    blendRenderPrompt: input.blendRenderPrompt,
  };
  hintRuns.set(record.id, record);
  return record;
}

export function getHintRunRecord(id: string): LocalHintRunRecord | undefined {
  return hintRuns.get(id);
}

export function appendHintRunLog(
  id: string,
  stage: string,
  message: string,
  timestamp: string = nowIso(),
): void {
  const record = hintRuns.get(id);
  if (!record) {
    return;
  }
  record.logs.push({ stage, message, timestamp });
  record.updatedAt = timestamp;
}

export function markHintRunStatus(id: string, status: LocalRunStatus): void {
  const record = hintRuns.get(id);
  if (!record) {
    return;
  }
  record.status = status;
  record.updatedAt = nowIso();
}

export function markHintRunSucceeded(id: string, result: HintPipelineResult): void {
  const record = hintRuns.get(id);
  if (!record) {
    return;
  }
  record.status = 'succeeded';
  record.result = result;
  record.updatedAt = nowIso();
}

export function markHintRunAllSucceeded(
  id: string,
  allResults: Partial<Record<HintAnnotationMethod, HintPipelineResult>>,
): void {
  const record = hintRuns.get(id);
  if (!record) {
    return;
  }
  record.status = 'succeeded';
  record.allResults = allResults;
  record.updatedAt = nowIso();
}

export function markHintRunFailed(id: string, error: string): void {
  const record = hintRuns.get(id);
  if (!record) {
    return;
  }
  record.status = 'failed';
  record.error = error;
  record.updatedAt = nowIso();
}
