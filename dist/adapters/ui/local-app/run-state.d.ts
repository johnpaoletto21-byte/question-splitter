/**
 * adapters/ui/local-app/run-state.ts
 *
 * In-memory run state for the single-user local app.
 */
import type { RunSummaryState } from '../../../core/run-summary/types';
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
    createdAt: string;
    updatedAt: string;
    logs: LocalRunLogEntry[];
    summary?: RunSummaryState;
    error?: string;
}
export declare function createRunRecord(input: {
    runLabel?: string;
    pdfFileName?: string;
}): LocalRunRecord;
export declare function getRunRecord(id: string): LocalRunRecord | undefined;
export declare function appendRunLog(id: string, stage: string, message: string, timestamp?: string): void;
export declare function markRunStatus(id: string, status: LocalRunStatus): void;
export declare function markRunSucceeded(id: string, summary: RunSummaryState): void;
export declare function markRunFailed(id: string, error: string): void;
export declare function resetRunRecordsForTests(): void;
//# sourceMappingURL=run-state.d.ts.map