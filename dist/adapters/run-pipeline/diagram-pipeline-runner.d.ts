/**
 * adapters/run-pipeline/diagram-pipeline-runner.ts
 *
 * Adapter-layer glue for the diagram-only cropper.
 *
 * Flow:
 *   Read source PNG dimensions
 *     → Detect diagrams (Agent D, single Gemini call)
 *     → For each bbox: validate, convert to pixels, crop to file
 *     → Render sanity-overlay PNG with red rectangles around each crop
 *
 * No PDF rendering, no segmentation, no deduplication, no stacking.
 * Mirrors the dependency-injection style of full-pipeline-runner.ts so tests
 * can swap in fakes without network or canvas calls.
 */
import type { LocalConfig } from '../config/local-config/types';
import { type GeminiDiagramDetectorConfig } from '../diagram-detection/gemini-diagram-detector';
import { type DiagramCropper, type DiagramOverlayRenderer } from '../../core/diagram-detection';
import type { DiagramDetectionResult, DiagramRunResult } from '../../core/diagram-detection/types';
export interface PipelineLogEvent {
    stage: string;
    message: string;
    timestamp: string;
}
export interface RunDiagramPipelineInput {
    /** Absolute path to the uploaded source PNG (a previously cropped question). */
    sourceImagePath: string;
    /** Run-scoped output directory; the runner writes diagrams + overlay here. */
    outputDir: string;
    config: LocalConfig;
    /** Override the default detector prompt (e.g. for prompt experiments). */
    promptOverride?: string;
    onLog?: (event: PipelineLogEvent) => void;
}
/** Detector signature — accepts the source image + prompt, returns bboxes. */
export type DetectorFn = (sourceImagePath: string, promptText: string, config: GeminiDiagramDetectorConfig) => Promise<DiagramDetectionResult>;
export interface RunDiagramPipelineDependencies {
    detector?: DetectorFn;
    cropper?: DiagramCropper;
    overlayRenderer?: DiagramOverlayRenderer;
    imageDimensions?: (imagePath: string) => Promise<{
        width: number;
        height: number;
    }>;
}
/**
 * Runs the diagram-only pipeline end-to-end and returns the result summary.
 */
export declare function runDiagramPipeline(input: RunDiagramPipelineInput, deps?: RunDiagramPipelineDependencies): Promise<DiagramRunResult>;
//# sourceMappingURL=diagram-pipeline-runner.d.ts.map