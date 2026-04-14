/**
 * adapters/image-processing/canvas-images.ts
 *
 * Concrete canvas-based image I/O adapters for the local pipeline.
 *
 * Two consumers share one underlying primitive (`cropPngToBuffer`):
 *   1. The question pipeline's `makeCanvasCropExecutor` — keeps its existing
 *      4-pixel safety buffer behavior (byte-identical output to the prior
 *      implementation).
 *   2. The diagram-only cropper's `cropImageToFile` — same primitive, no
 *      filename-mangling for run/target conventions.
 *
 * Also exports `drawDiagramOverlayToFile` for the sanity-check overlay PNG
 * shown on the diagram-run results page.
 */
import type { PixelRect } from '../../core/crop-engine/types';
import type { CropExecutor } from '../../core/run-orchestrator/crop-step';
import type { ImageStackerFn } from '../../core/output-composer/composer';
/**
 * Creates a CropExecutor that crops rendered page PNGs to per-target region PNGs.
 *
 * Behavior preserved from the original implementation: pads the requested rect
 * by 4 pixels on every side and clamps to image bounds. File-naming convention
 * (`<targetId>_p<page>_<x>_<y>_<w>x<h>.png`) is unchanged so existing question
 * pipeline tests keep passing.
 */
export declare function makeCanvasCropExecutor(outputDir: string): CropExecutor;
/**
 * Creates an ImageStackerFn that stacks two PNGs top-to-bottom.
 */
export declare function makeCanvasImageStacker(outputDir: string, runId: string): ImageStackerFn;
/**
 * Reads a PNG from disk and returns its pixel dimensions. Used by the
 * diagram-pipeline runner to convert the model's 0-1000 bbox into pixels.
 */
export declare function getImageDimensions(imagePath: string): Promise<{
    width: number;
    height: number;
}>;
/**
 * Crops a single rectangle out of the source PNG and writes it as
 * `diagram_<index>.png` under `outputDir`. Pads by the same 4-pixel safety
 * buffer the question pipeline uses (empirically working — see plan
 * "On Clipping" section).
 */
export declare function cropImageToFile(sourceImagePath: string, outputDir: string, diagramIndex: number, pixelRect: PixelRect): Promise<string>;
/**
 * Renders the source PNG with red rectangles drawn around each diagram's
 * pixel rect. Saved as `overlay.png` under `outputDir`. This is the visual
 * sanity check on the results page — if a rectangle clips through a diagram
 * the user will see it immediately.
 */
export declare function drawDiagramOverlayToFile(sourceImagePath: string, outputDir: string, rects: ReadonlyArray<{
    diagram_index: number;
    pixelRect: PixelRect;
}>): Promise<string>;
//# sourceMappingURL=canvas-images.d.ts.map