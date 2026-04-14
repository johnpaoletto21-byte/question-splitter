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
export declare function createRunRecord(input: {
    runLabel?: string;
    pdfFileName?: string;
    pdfFilePath?: string;
    outputDir?: string;
    extractionFields?: ExtractionFieldDefinition[];
    promptSnapshot?: PromptSnapshot;
}): LocalRunRecord;
export declare function getRunRecord(id: string): LocalRunRecord | undefined;
export declare function appendRunLog(id: string, stage: string, message: string, timestamp?: string): void;
export declare function markRunStatus(id: string, status: LocalRunStatus): void;
export declare function markRunSucceeded(id: string, summary: RunSummaryState): void;
export declare function markRunFailed(id: string, error: string, failureContext?: unknown): void;
export declare function resetRunRecordsForTests(): void;
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
export declare function createDiagramRunRecord(input: {
    imageFileName?: string;
    imageFilePath?: string;
    outputDir?: string;
    runOutputDir?: string;
}): LocalDiagramRunRecord;
export declare function getDiagramRunRecord(id: string): LocalDiagramRunRecord | undefined;
export declare function appendDiagramRunLog(id: string, stage: string, message: string, timestamp?: string): void;
export declare function markDiagramRunStatus(id: string, status: LocalRunStatus): void;
export declare function markDiagramRunSucceeded(id: string, result: DiagramRunResult): void;
export declare function markDiagramRunFailed(id: string, error: string): void;
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
    error?: string;
}
export declare function createHintRunRecord(input: {
    imageFileName?: string;
    imageFilePath?: string;
    hintText?: string;
    method?: HintAnnotationMethod;
    outputDir?: string;
    runOutputDir?: string;
}): LocalHintRunRecord;
export declare function getHintRunRecord(id: string): LocalHintRunRecord | undefined;
export declare function appendHintRunLog(id: string, stage: string, message: string, timestamp?: string): void;
export declare function markHintRunStatus(id: string, status: LocalRunStatus): void;
export declare function markHintRunSucceeded(id: string, result: HintPipelineResult): void;
export declare function markHintRunFailed(id: string, error: string): void;
//# sourceMappingURL=run-state.d.ts.map