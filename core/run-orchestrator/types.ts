import { LocalConfig } from '../../adapters/config/local-config/types';
import { CropTargetProfile } from '../crop-target-profile/types';
import { PdfSource, PreparedPageImage } from '../source-model/types';
import { PromptSnapshot } from '../prompt-config-store/types';

/**
 * The input accepted by `bootstrapRun`.
 */
export interface RunRequest {
  /**
   * Ordered list of absolute paths to input PDF files.
   * The caller controls the order; bootstrap preserves it exactly.
   */
  pdfFilePaths: string[];

  /** Resolved and validated local configuration. */
  config: LocalConfig;

  /**
   * Optional human-readable label for this run (e.g. "Exam 2024-Q1").
   * Used in logs and summary display.
   */
  runLabel?: string;

  /**
   * Optional prompt snapshot supplied by an adapter that needs to persist the
   * exact prompts alongside queued run state. When omitted, bootstrapRun
   * captures the current session prompts itself.
   */
  promptSnapshot?: PromptSnapshot;
}

/**
 * The context produced by `bootstrapRun` and handed off to
 * preparation, segmentation, localization, and crop steps.
 *
 * At bootstrap time `preparedPages` is empty; the PDF renderer
 * (TASK-102) populates it before any agent work begins.
 */
export interface RunContext {
  /** Unique, stable identifier for this run (ISO timestamp + random suffix). */
  run_id: string;

  /** Optional label carried through from RunRequest. */
  run_label?: string;

  /**
   * Ordered PDF source list — preserves `pdfFilePaths` input order exactly.
   * Each entry has a stable `source_id` for downstream traceability.
   */
  sources: PdfSource[];

  /** Resolved and validated config for the whole run. */
  config: LocalConfig;

  /**
   * Active crop target profile attached at run start.
   * Centralizes target_type, max_regions_per_target, and composition_mode
   * so downstream steps (segmentation guard, composer) read from one place.
   * Satisfies PO-3 / INV-3 / INV-6.
   */
  activeProfile: CropTargetProfile;

  /**
   * Immutable prompt snapshot captured at run start from core/prompt-config-store.
   * Agent steps (segmentation, localization) use this snapshot exclusively —
   * mid-run UI edits to the live store do not affect an active run (INV-7 / PO-6).
   */
  promptSnapshot: PromptSnapshot;

  /** ISO-8601 timestamp captured at bootstrap time. */
  started_at: string;

  /**
   * Rendered prepared page images — populated by `renderAllSources` (TASK-102)
   * before any segmentation or localization step runs.
   *
   * Absent until rendering is complete; downstream steps must not run
   * before this field is set (INV-1).
   */
  preparedPages?: PreparedPageImage[];
}

/** Error thrown when a RunRequest is structurally invalid. */
export class RunBootstrapError extends Error {
  public readonly code = 'RUN_BOOTSTRAP_INVALID' as const;

  constructor(reason: string) {
    super(`RUN_BOOTSTRAP_INVALID: ${reason}`);
    this.name = 'RunBootstrapError';
  }
}
