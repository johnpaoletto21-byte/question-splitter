/**
 * core/run-summary/summary.ts
 *
 * Builds and updates run-summary state from normalized agent outputs.
 *
 * TASK-201: buildRunSummaryFromSegmentation — Agent 1 (segmentation) output.
 * TASK-301: applyLocalizationToSummary — Agent 2 (localization) output.
 * Later tasks will add final-result fields.
 *
 * INV-4 compliance: review_comment fields flow into RunSummaryTargetEntry
 * (visible to the UI) but are not present in any result-model type.
 * INV-9 compliance: depends only on normalized contracts, not provider types.
 */

import type { SegmentationResult } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';
import type { FinalResultRow } from '../result-model/types';
import type { RunSummaryState, RunSummaryTargetEntry } from './types';
import type { ExtractionFieldDefinition } from '../extraction-fields';

/**
 * Builds a RunSummaryState from a normalized SegmentationResult plus
 * optional localization results (for page_numbers).
 *
 * - Sets agent1_status = 'needs_review' when review_comment is present.
 * - Includes review_comment in the entry for UI display.
 * - page_numbers come from localizedResults if provided, otherwise empty.
 * - Preserves target order from the segmentation result (reading order).
 */
export function buildRunSummaryFromSegmentation(
  result: SegmentationResult,
  extractionFields: ReadonlyArray<ExtractionFieldDefinition> = [],
  localizedResults?: ReadonlyArray<LocalizationResult>,
): RunSummaryState {
  // Build a lookup for page_numbers from localization results
  const pageNumbersByTarget = new Map<string, number[]>();
  if (localizedResults) {
    for (const loc of localizedResults) {
      pageNumbersByTarget.set(
        loc.target_id,
        loc.regions.map((r) => r.page_number),
      );
    }
  }

  const targets: RunSummaryTargetEntry[] = result.targets.map((t) => {
    const entry: RunSummaryTargetEntry = {
      target_id: t.target_id,
      target_type: t.target_type,
      page_numbers: pageNumbersByTarget.get(t.target_id) ?? [],
      agent1_status: t.review_comment !== undefined ? 'needs_review' : 'ok',
    };

    if (t.extraction_fields !== undefined) {
      entry.extraction_fields = t.extraction_fields;
    }

    if (t.review_comment !== undefined) {
      entry.review_comment = t.review_comment;
    }

    return entry;
  });

  return {
    run_id: result.run_id,
    ...(extractionFields.length > 0 ? { extraction_fields: [...extractionFields] } : {}),
    targets,
  };
}

/**
 * Returns a new RunSummaryState with the target entry for the given
 * LocalizationResult updated to include Agent 2 status fields.
 *
 * - Sets agent2_status = 'needs_review' when review_comment is present.
 * - Carries agent2_review_comment for UI display (INV-4: not in result rows).
 * - Returns a new state object; does not mutate the input.
 * - Throws if the target_id from the localization result is not found in the
 *   summary state (indicates a contract violation upstream).
 *
 * @param state   Current RunSummaryState (from buildRunSummaryFromSegmentation).
 * @param result  Normalized LocalizationResult for one target.
 * @returns       Updated RunSummaryState with agent2 fields set for that target.
 * @throws        Error if result.target_id is not found in state.targets.
 */
export function applyLocalizationToSummary(
  state: RunSummaryState,
  result: LocalizationResult,
): RunSummaryState {
  const index = state.targets.findIndex((t) => t.target_id === result.target_id);

  if (index === -1) {
    throw new Error(
      `applyLocalizationToSummary: target_id "${result.target_id}" not found in summary state. ` +
      'Ensure buildRunSummaryFromSegmentation was called before applying localization results.',
    );
  }

  const updatedEntry: RunSummaryTargetEntry = {
    ...state.targets[index],
    agent2_status: result.review_comment !== undefined ? 'needs_review' : 'ok',
  };

  if (result.review_comment !== undefined) {
    updatedEntry.agent2_review_comment = result.review_comment;
  }

  const updatedTargets = [
    ...state.targets.slice(0, index),
    updatedEntry,
    ...state.targets.slice(index + 1),
  ];

  return {
    ...state,
    targets: updatedTargets,
  };
}

/**
 * Returns a new RunSummaryState with each target entry updated to reflect
 * the final pipeline outcome (composition + optional upload).
 *
 * - Sets final_status = 'ok' | 'failed' from FinalResultRow.status.
 * - Carries drive_url when upload succeeded (FinalResultOk.drive_url).
 * - Carries failure_code and failure_message when the target failed.
 * - Returns a new state object; does not mutate the input.
 * - Throws if any row.target_id is not found in state.targets (contract violation).
 *
 * INV-4 compliance: review_comment stays in RunSummaryTargetEntry (already set by
 * prior steps) and is never written back into any FinalResultRow shape.
 * INV-8 compliance: all rows are processed; one failed target does not hide others.
 *
 * @param state  Current RunSummaryState (after localization step at minimum).
 * @param rows   FinalResultRow[] from runUploadStep (or runCompositionStep if
 *               no upload was performed).
 * @returns      Updated RunSummaryState with final_status and optional drive_url /
 *               failure fields set for every target.
 * @throws       Error if any row.target_id is not found in state.targets.
 */
export function applyFinalResultsToSummary(
  state: RunSummaryState,
  rows: FinalResultRow[],
): RunSummaryState {
  // Build a target-id → index map for O(1) lookup.
  const indexMap = new Map<string, number>(
    state.targets.map((t, i) => [t.target_id, i]),
  );

  // Collect updates: start with a shallow copy of the targets array.
  const updatedTargets: RunSummaryTargetEntry[] = [...state.targets];

  for (const row of rows) {
    const idx = indexMap.get(row.target_id);
    if (idx === undefined) {
      throw new Error(
        `applyFinalResultsToSummary: target_id "${row.target_id}" not found in summary state. ` +
        'Ensure buildRunSummaryFromSegmentation was called before applying final results.',
      );
    }

    if (row.status === 'ok') {
      const updated: RunSummaryTargetEntry = {
        ...updatedTargets[idx],
        final_status: 'ok',
      };
      if (row.drive_url !== undefined) {
        updated.drive_url = row.drive_url;
      }
      if (row.drive_file_id !== undefined) {
        updated.drive_file_id = row.drive_file_id;
      }
      if (row.local_output_path !== undefined) {
        updated.local_output_path = row.local_output_path;
      }
      updatedTargets[idx] = updated;
    } else {
      // status === 'failed'
      updatedTargets[idx] = {
        ...updatedTargets[idx],
        final_status: 'failed',
        failure_code: row.failure_code,
        failure_message: row.failure_message,
        ...(row.local_output_path !== undefined
          ? { local_output_path: row.local_output_path }
          : {}),
      };
    }
  }

  return {
    ...state,
    targets: updatedTargets,
  };
}
