"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapRun = bootstrapRun;
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
/**
 * Generate a stable, unique run ID.
 * Format: `run_<ISO-date>_<random-hex-8>` so it is both sortable and collision-resistant.
 */
function generateRunId() {
    const datePart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const randomPart = Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, '0');
    return `run_${datePart}_${randomPart}`;
}
/**
 * Derive a stable `source_id` from the file's position in the input list
 * and its basename.  Format: `src_<index>_<safeName>` where `safeName`
 * is the basename without extension with non-alphanumeric chars replaced by `_`.
 *
 * The index is zero-padded to 4 digits so lexicographic sort ≡ input order.
 */
function deriveSourceId(inputOrder, filePath) {
    const basename = path_1.default.basename(filePath, path_1.default.extname(filePath));
    const safeName = basename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const paddedIndex = String(inputOrder).padStart(4, '0');
    return `src_${paddedIndex}_${safeName}`;
}
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
function bootstrapRun(request) {
    const { pdfFilePaths, config, runLabel } = request;
    if (!Array.isArray(pdfFilePaths) || pdfFilePaths.length === 0) {
        throw new types_1.RunBootstrapError('pdfFilePaths must be a non-empty array. Provide at least one PDF file path.');
    }
    for (let i = 0; i < pdfFilePaths.length; i++) {
        const p = pdfFilePaths[i];
        if (typeof p !== 'string' || p.trim() === '') {
            throw new types_1.RunBootstrapError(`pdfFilePaths[${i}] must be a non-empty string. Received: ${JSON.stringify(p)}`);
        }
    }
    // Preserve input order exactly — do not sort
    const sources = pdfFilePaths.map((filePath, index) => ({
        source_id: deriveSourceId(index, filePath),
        file_path: filePath,
        file_name: path_1.default.basename(filePath),
        input_order: index,
    }));
    return {
        run_id: generateRunId(),
        run_label: runLabel,
        sources,
        config,
        started_at: new Date().toISOString(),
    };
}
//# sourceMappingURL=bootstrap.js.map