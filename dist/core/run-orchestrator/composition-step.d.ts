/**
 * core/run-orchestrator/composition-step.ts
 *
 * Orchestrator step that composes crop outputs into final result rows.
 *
 * Design (mirrors crop-step.ts pattern):
 *   - Image I/O is injected via ImageStackerFn (keeps core I/O-free, INV-9).
 *   - Emits exactly one FinalResultRow per CropStepTargetResult (INV-5).
 *   - Targets that failed the crop step are forwarded as failed rows without
 *     attempting composition (INV-8 continuation).
 *   - Targets where composeOutput throws CompositionError are emitted as
 *     failed rows; remaining targets continue (INV-8).
 *   - review_comment never enters FinalResultRow (INV-4).
 *   - source_pages are derived from localizedTargets (Agent 2 region order).
 *
 * TASK-401 adds this module.
 */
import type { LocalizationResult } from '../localization-contract/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { CropStepTargetResult } from './crop-step';
import type { ImageStackerFn } from '../output-composer/composer';
import type { FinalResultRow } from '../result-model/types';
export type { ImageStackerFn };
/**
 * Runs the composition step for all crop results.
 *
 * For each CropStepTargetResult:
 *  - `status: 'failed'` → emit a failed FinalResultRow (INV-8 continuation).
 *  - `status: 'ok'`     → build ComposerInput, call composeOutput, emit ok row.
 *     If composeOutput throws CompositionError, emit failed row and continue (INV-8).
 *
 * @param runId             Current run_id (for traceability).
 * @param cropResults       Ordered CropStepTargetResult[] from runCropStep.
 * @param localizedTargets  LocalizationResult[] used to derive source_pages.
 * @param profile           Active CropTargetProfile (composition_mode read here).
 * @param imageStacker      Injected function for two-region pixel stacking.
 * @returns                 FinalResultRow[] — one per crop result, same order.
 */
export declare function runCompositionStep(runId: string, cropResults: CropStepTargetResult[], localizedTargets: LocalizationResult[], profile: CropTargetProfile, imageStacker: ImageStackerFn): Promise<FinalResultRow[]>;
//# sourceMappingURL=composition-step.d.ts.map