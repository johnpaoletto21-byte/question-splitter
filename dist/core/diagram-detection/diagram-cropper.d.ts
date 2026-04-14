/**
 * core/diagram-detection/diagram-cropper.ts
 *
 * Pure orchestration logic for the diagram-only cropper.
 *
 * Given a detector function (calls Gemini), a cropper function (canvas I/O),
 * and an overlay-renderer function (canvas I/O), this module:
 *   1. Validates each bbox via the existing core/crop-engine/bbox validator.
 *   2. Converts each bbox to pixel coordinates via the existing pixel converter.
 *   3. Calls the cropper to write one PNG per diagram.
 *   4. Calls the overlay renderer to write a visual sanity-check PNG.
 *
 * Per-diagram failures continue (mirrors composition-step.ts INV-8 pattern):
 *   one bad bbox does not kill the whole run.
 *
 * Pure module — no fs, no canvas, no provider SDKs. All I/O is injected.
 */
import { type PixelRect } from '../crop-engine/types';
import type { DiagramDetectionResult, DiagramRunResult } from './types';
/**
 * Cropper signature: read the source image at `sourceImagePath`, cut out
 * `pixelRect`, and write a PNG. Returns the absolute path of the written file.
 */
export type DiagramCropper = (sourceImagePath: string, outputDir: string, diagramIndex: number, pixelRect: PixelRect) => Promise<string>;
/**
 * Overlay renderer signature: draw red rectangles over the source image at
 * the given pixel rects and write the result. Returns the output path.
 */
export type DiagramOverlayRenderer = (sourceImagePath: string, outputDir: string, rects: ReadonlyArray<{
    diagram_index: number;
    pixelRect: PixelRect;
}>) => Promise<string>;
export interface CropDiagramsInput {
    detection: DiagramDetectionResult;
    sourceWidth: number;
    sourceHeight: number;
    outputDir: string;
}
/**
 * Runs the per-diagram crop step plus the overlay generation.
 *
 * Each diagram is processed independently:
 *  - validateBbox throws BboxInvalidError → emit a failed DiagramCropResult.
 *  - cropper throws → emit a failed DiagramCropResult with code DIAGRAM_CROP_FAILED.
 *  - cropper succeeds → emit an ok DiagramCropResult with the output path.
 *
 * The overlay is rendered for ALL successfully-converted pixel rects, even if
 * the actual crop write failed — the overlay is a debug view of what the
 * detector returned, not of what was successfully written.
 */
export declare function cropDiagrams(input: CropDiagramsInput, cropper: DiagramCropper, overlayRenderer: DiagramOverlayRenderer): Promise<DiagramRunResult>;
//# sourceMappingURL=diagram-cropper.d.ts.map