/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 */
import type { LocalConfig } from '../config/local-config/types';
import type { PageRenderer, Segmenter, Localizer, CropExecutor, ImageStackerFn, DriveUploaderFn } from '../../core/run-orchestrator';
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
}
export interface RunFullPipelineDependencies {
    renderer?: PageRenderer;
    segmenter?: Segmenter;
    localizer?: Localizer;
    cropExecutor?: CropExecutor;
    imageStacker?: ImageStackerFn;
    driveUploader?: DriveUploaderFn;
}
/**
 * Runs the complete local pipeline and returns the final summary state.
 */
export declare function runFullPipeline(input: RunFullPipelineInput, deps?: RunFullPipelineDependencies): Promise<RunSummaryState>;
//# sourceMappingURL=full-pipeline-runner.d.ts.map