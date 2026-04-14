"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cropDiagrams = cropDiagrams;
const bbox_1 = require("../crop-engine/bbox");
const types_1 = require("../crop-engine/types");
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
async function cropDiagrams(input, cropper, overlayRenderer) {
    const { detection, sourceWidth, sourceHeight, outputDir } = input;
    const results = [];
    const overlayRects = [];
    for (const diagram of detection.diagrams) {
        const item = await processOne(diagram, sourceWidth, sourceHeight, detection.source_image_path, outputDir, cropper);
        results.push(item.cropResult);
        if (item.pixelRect) {
            overlayRects.push({ diagram_index: diagram.diagram_index, pixelRect: item.pixelRect });
        }
    }
    const overlayPath = await overlayRenderer(detection.source_image_path, outputDir, overlayRects);
    return {
        source_image_path: detection.source_image_path,
        source_width: sourceWidth,
        source_height: sourceHeight,
        diagrams: results,
        overlay_image_path: overlayPath,
    };
}
async function processOne(diagram, sourceWidth, sourceHeight, sourceImagePath, outputDir, cropper) {
    const targetIdForError = `diagram_${diagram.diagram_index}`;
    let pixelRect;
    try {
        (0, bbox_1.validateBbox)(diagram.bbox_1000, targetIdForError);
        pixelRect = (0, bbox_1.bboxToPixelRect)(diagram.bbox_1000, sourceWidth, sourceHeight);
    }
    catch (err) {
        if (err instanceof types_1.BboxInvalidError) {
            return {
                cropResult: {
                    status: 'failed',
                    diagram_index: diagram.diagram_index,
                    label: diagram.label,
                    failure_code: err.code,
                    failure_message: err.message,
                },
            };
        }
        throw err;
    }
    try {
        const outputPath = await cropper(sourceImagePath, outputDir, diagram.diagram_index, pixelRect);
        return {
            cropResult: {
                status: 'ok',
                diagram_index: diagram.diagram_index,
                label: diagram.label,
                output_file_path: outputPath,
                pixel_rect: pixelRect,
            },
            pixelRect,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            cropResult: {
                status: 'failed',
                diagram_index: diagram.diagram_index,
                label: diagram.label,
                failure_code: 'DIAGRAM_CROP_FAILED',
                failure_message: message,
            },
            pixelRect,
        };
    }
}
//# sourceMappingURL=diagram-cropper.js.map