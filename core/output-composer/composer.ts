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

import path from 'path';
import type { ComposerInput, ComposerResult } from './types';
import { CompositionError } from './types';

/**
 * A function that stacks exactly two image files top-to-bottom and writes
 * the combined result to a new file.
 *
 * Implemented outside `core/**` (e.g. adapters/image-combiner).
 * Injected here so core/output-composer stays I/O-free (INV-9).
 *
 * @param targetId   The target being composed (for file naming / tracing).
 * @param topPath    Absolute path to the top image (region 0, reading order).
 * @param bottomPath Absolute path to the bottom image (region 1, reading order).
 * @returns          Absolute path to the combined output file.
 */
export type ImageStackerFn = (
  targetId: string,
  topPath: string,
  bottomPath: string,
) => Promise<string>;

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
export async function composeOutput(
  input: ComposerInput,
  imageStacker: ImageStackerFn,
): Promise<ComposerResult> {
  const { targetId, sourcePages, regions, compositionMode } = input;

  // INV-6 guard: only top_to_bottom is a valid V1 composition mode.
  if (compositionMode !== 'top_to_bottom') {
    throw new CompositionError(
      targetId,
      `unsupported composition_mode: ${JSON.stringify(compositionMode)}`,
    );
  }

  if (regions.length === 0) {
    throw new CompositionError(
      targetId,
      `unsupported region count: 0`,
    );
  }

  let localOutputPath: string;

  if (regions.length === 1) {
    // One-region passthrough: the crop file IS the final output.
    localOutputPath = regions[0].cropFilePath;
  } else {
    // Multi-region top-to-bottom combination.
    // Chain: stack regions sequentially in reading order.
    localOutputPath = regions[0].cropFilePath;
    for (let i = 1; i < regions.length; i++) {
      localOutputPath = await imageStacker(
        `${targetId}_step${i}`,
        localOutputPath,
        regions[i].cropFilePath,
      );
    }
  }

  const outputFileName = path.basename(localOutputPath);

  return {
    targetId,
    sourcePages,
    outputFileName,
    localOutputPath,
  };
}
