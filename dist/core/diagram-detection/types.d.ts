/**
 * core/diagram-detection/types.ts
 *
 * Type contracts for the diagram-only cropper.
 *
 * Input to this feature is a single PNG (a previously cropped exam question
 * containing one or more diagrams). Output is one PNG per detected diagram.
 *
 * Design constraints (mirror INV-9 from the question pipeline):
 *   - No provider SDK types here — this module is core, adapter-clean.
 *   - bbox_1000 uses the same [y_min, x_min, y_max, x_max] convention as Agent 3
 *     so we can reuse core/crop-engine/bbox.ts validators unchanged.
 */
/**
 * One diagram bounding box returned by the detector adapter (Agent D).
 *
 * - bbox_1000: same 0-1000 normalized scale used by Agent 3, [y_min, x_min, y_max, x_max].
 * - diagram_index: 1-based ordering position assigned by the detector
 *   (top-to-bottom, then left-to-right reading order).
 * - label: optional caption text the model spotted (e.g. "図1", "Fig. 2").
 */
export interface DiagramBbox {
    diagram_index: number;
    bbox_1000: [number, number, number, number];
    label?: string;
}
/**
 * Normalized output of the diagram-detection adapter for one source image.
 */
export interface DiagramDetectionResult {
    source_image_path: string;
    diagrams: DiagramBbox[];
}
/**
 * Outcome of cropping ONE diagram from the source image.
 *
 * `status: 'ok'`     — diagram was cropped successfully; output_file_path points to the PNG.
 * `status: 'failed'` — bbox failed validation or cropping threw; surfaced on the UI but
 *                     never aborts the run (per-diagram failure isolation).
 */
export type DiagramCropResult = {
    status: 'ok';
    diagram_index: number;
    label?: string;
    output_file_path: string;
    pixel_rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
} | {
    status: 'failed';
    diagram_index: number;
    label?: string;
    failure_code: string;
    failure_message: string;
};
/**
 * Final result of one diagram-only run.
 *
 * - source_image_path: absolute path to the uploaded PNG.
 * - source_width / source_height: pixel dimensions of the source image.
 * - diagrams: one entry per diagram the detector returned, in reading order.
 * - overlay_image_path: PNG showing the source with red rectangles drawn around
 *   each crop — the visual sanity check the user inspects on the results page.
 */
export interface DiagramRunResult {
    source_image_path: string;
    source_width: number;
    source_height: number;
    diagrams: DiagramCropResult[];
    overlay_image_path: string;
}
//# sourceMappingURL=types.d.ts.map