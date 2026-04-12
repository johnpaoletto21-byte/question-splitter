/**
 * adapters/ui/local-app/run-state.ts
 *
 * In-memory run state for the single-user local app.
 */

import type { RunSummaryState } from '../../../core/run-summary/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { PromptSnapshot } from '../../../core/prompt-config-store/types';

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
}
