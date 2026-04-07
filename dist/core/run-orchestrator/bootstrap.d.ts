import { RunContext, RunRequest } from './types';
/**
 * Bootstrap a new run from a RunRequest.
 *
 * Responsibilities:
 * - Validate the request (non-empty PDF list, all paths are non-empty strings).
 * - Build an ordered list of PdfSource objects preserving input order exactly.
 * - Assign stable source_id values for downstream traceability.
 * - Return a RunContext ready for the PDF renderer step (TASK-102).
 *
 * Does NOT perform I/O against the file system beyond deriving names,
 * so tests can run without real PDF files present.
 *
 * Throws `RunBootstrapError` for structurally invalid requests.
 */
export declare function bootstrapRun(request: RunRequest): RunContext;
//# sourceMappingURL=bootstrap.d.ts.map