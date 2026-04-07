import { LocalConfig } from '../../adapters/config/local-config/types';
import { PdfSource } from '../source-model/types';
/**
 * The input accepted by `bootstrapRun`.
 */
export interface RunRequest {
    /**
     * Ordered list of absolute paths to input PDF files.
     * The caller controls the order; bootstrap preserves it exactly.
     */
    pdfFilePaths: string[];
    /** Resolved and validated local configuration. */
    config: LocalConfig;
    /**
     * Optional human-readable label for this run (e.g. "Exam 2024-Q1").
     * Used in logs and summary display.
     */
    runLabel?: string;
}
/**
 * The context produced by `bootstrapRun` and handed off to
 * preparation, segmentation, localization, and crop steps.
 *
 * At bootstrap time `preparedPages` is empty; the PDF renderer
 * (TASK-102) populates it before any agent work begins.
 */
export interface RunContext {
    /** Unique, stable identifier for this run (ISO timestamp + random suffix). */
    run_id: string;
    /** Optional label carried through from RunRequest. */
    run_label?: string;
    /**
     * Ordered PDF source list — preserves `pdfFilePaths` input order exactly.
     * Each entry has a stable `source_id` for downstream traceability.
     */
    sources: PdfSource[];
    /** Resolved and validated config for the whole run. */
    config: LocalConfig;
    /** ISO-8601 timestamp captured at bootstrap time. */
    started_at: string;
}
/** Error thrown when a RunRequest is structurally invalid. */
export declare class RunBootstrapError extends Error {
    readonly code: "RUN_BOOTSTRAP_INVALID";
    constructor(reason: string);
}
//# sourceMappingURL=types.d.ts.map