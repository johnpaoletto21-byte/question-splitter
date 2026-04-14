/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 *
 * New flow:
 *   Render → [per chunk: Segment → Review → Localize (sliding windows)] → Dedup → Crop → Compose → Upload
 */
import type { LocalConfig } from '../config/local-config/types';
import type { PageRenderer, Segmenter, SegmentationReviewer, WindowLocalizer, Deduplicator, CropExecutor, ImageStackerFn, DriveUploaderFn } from '../../core/run-orchestrator';
import type { RunSummaryState } from '../../core/run-summary/types';
import type { PromptSnapshot } from '../../core/prompt-config-store/types';
import type { ExtractionFieldDefinition } from '../../core/extraction-fields';
export interface PipelineLogEvent {
    stage: string;
    message: string;
    timestamp: string;
}
export interface RunFullPipelineInput {
    pdfFilePaths: string[];
    runLabel?: string;
    config: LocalConfig;
    extractionFields?: ExtractionFieldDefinition[];
    promptSnapshot?: PromptSnapshot;
    onLog?: (event: PipelineLogEvent) => void;
    /** Pages per chunk (default 10). */
    chunkSize?: number;
    /** Overlap pages between consecutive chunks (default 3). */
    chunkOverlap?: number;
}
export interface RunFullPipelineDependencies {
    renderer?: PageRenderer;
    segmenter?: Segmenter;
    reviewer?: SegmentationReviewer;
    windowLocalizer?: WindowLocalizer;
    deduplicator?: Deduplicator;
    cropExecutor?: CropExecutor;
    imageStacker?: ImageStackerFn;
    driveUploader?: DriveUploaderFn;
}
/**
 * Runs the complete local pipeline and returns the final summary state.
 */
export declare function runFullPipeline(input: RunFullPipelineInput, deps?: RunFullPipelineDependencies): Promise<RunSummaryState>;
//# sourceMappingURL=full-pipeline-runner.d.ts.map