"use strict";
/**
 * core/output-composer/composer.ts
 *
 * Output composition: one-region passthrough and two-region top-to-bottom combine.
 *
 * Design (mirrors crop-step.ts injection pattern):
 *   - No image I/O in core (INV-9 / PO-8). Actual pixel-level stacking is
 *     injected as an `ImageStackerFn` by the caller (adapters layer).
 *   - 1 region → passthrough: the crop file path IS the final output.
 *     No I/O needed; the existing file is reused directly (INV-5, INV-6).
 *   - 2 regions → calls imageStacker(targetId, topPath, bottomPath) to
 *     produce a combined image (top-to-bottom order, INV-6).
 *   - 0 or 3+ regions → throws CompositionError immediately (INV-3 guard;
 *     no silent 3+ region support).
 *   - composition_mode other than 'top_to_bottom' → throws CompositionError
 *     (INV-6 guard).
 *
 * TASK-401 adds this module.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeOutput = composeOutput;
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
/**
 * Compose crop regions into a single final output file for one target.
 *
 * Routes to passthrough (1 region) or injected stacker (2 regions).
 * Guards against unsupported region counts and composition modes before
 * any I/O is attempted.
 *
 * @param input        Composer input with regions, sourcePages, and policy.
 * @param imageStacker Injected function for two-region pixel stacking.
 * @returns            ComposerResult with output path and filename.
 *
 * @throws CompositionError if region count is 0 or 3+, or if
 *         compositionMode is not 'top_to_bottom'.
 */
async function composeOutput(input, imageStacker) {
    const { targetId, sourcePages, regions, compositionMode } = input;
    // INV-6 guard: only top_to_bottom is a valid V1 composition mode.
    if (compositionMode !== 'top_to_bottom') {
        throw new types_1.CompositionError(targetId, `unsupported composition_mode: ${JSON.stringify(compositionMode)}`);
    }
    // INV-3 guard: reject 0 or 3+ regions explicitly — no silent 3+ support.
    if (regions.length === 0 || regions.length > 2) {
        throw new types_1.CompositionError(targetId, `unsupported region count: ${regions.length} (V1 supports 1 or 2)`);
    }
    let localOutputPath;
    if (regions.length === 1) {
        // One-region passthrough: the crop file IS the final output.
        // No image I/O needed; return the existing file path directly.
        localOutputPath = regions[0].cropFilePath;
    }
    else {
        // Two-region top-to-bottom combination.
        // Region 0 is top, region 1 is bottom (reading order from Agent 2).
        localOutputPath = await imageStacker(targetId, regions[0].cropFilePath, regions[1].cropFilePath);
    }
    const outputFileName = path_1.default.basename(localOutputPath);
    return {
        targetId,
        sourcePages,
        outputFileName,
        localOutputPath,
    };
}
//# sourceMappingURL=composer.js.map