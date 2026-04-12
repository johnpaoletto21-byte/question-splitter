/**
 * adapters/image-processing/canvas-images.ts
 *
 * Concrete canvas-based image I/O adapters for the local pipeline.
 */
import type { CropExecutor } from '../../core/run-orchestrator/crop-step';
import type { ImageStackerFn } from '../../core/output-composer/composer';
/**
 * Creates a CropExecutor that crops rendered page PNGs to per-target region PNGs.
 */
export declare function makeCanvasCropExecutor(outputDir: string): CropExecutor;
/**
 * Creates an ImageStackerFn that stacks two PNGs top-to-bottom.
 */
export declare function makeCanvasImageStacker(outputDir: string, runId: string): ImageStackerFn;
//# sourceMappingURL=canvas-images.d.ts.map