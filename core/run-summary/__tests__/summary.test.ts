/**
 * core/run-summary/__tests__/summary.test.ts
 *
 * Unit tests for buildRunSummaryFromSegmentation.
 *
 * Proves:
 *   - review_comment flows into summary state (INV-4: visible in UI).
 *   - agent1_status is 'needs_review' when comment present, 'ok' otherwise.
 *   - page_numbers are extracted from regions[].
 *   - Target order from segmentation result is preserved.
 *   - run_id is carried through.
 */

import { buildRunSummaryFromSegmentation } from '../summary';
import type { SegmentationResult } from '../../segmentation-contract/types';

function makeResult(overrides: Partial<SegmentationResult> = {}): SegmentationResult {
  return {
    run_id: 'run_2024-01-01_test',
    targets: [
      {
        target_id: 'q_0001',
        target_type: 'question',
        regions: [{ page_number: 1 }],
      },
      {
        target_id: 'q_0002',
        target_type: 'question',
        regions: [{ page_number: 2 }, { page_number: 3 }],
        review_comment: 'Boundary is ambiguous near footer',
      },
    ],
    ...overrides,
  };
}

describe('buildRunSummaryFromSegmentation', () => {
  it('carries run_id from the segmentation result', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.run_id).toBe('run_2024-01-01_test');
  });

  it('produces one summary entry per target', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets).toHaveLength(2);
  });

  it('preserves target order from segmentation result', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[0].target_id).toBe('q_0001');
    expect(summary.targets[1].target_id).toBe('q_0002');
  });

  it('sets agent1_status = "ok" when no review_comment', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[0].agent1_status).toBe('ok');
    expect(summary.targets[0].review_comment).toBeUndefined();
  });

  it('sets agent1_status = "needs_review" when review_comment is present (INV-4)', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[1].agent1_status).toBe('needs_review');
  });

  it('includes review_comment in summary entry when present (INV-4: UI visibility)', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[1].review_comment).toBe('Boundary is ambiguous near footer');
  });

  it('extracts page_numbers from regions for single-region target', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[0].page_numbers).toEqual([1]);
  });

  it('extracts page_numbers from regions for two-region target', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[1].page_numbers).toEqual([2, 3]);
  });

  it('carries target_id and target_type for each entry', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect(summary.targets[0].target_id).toBe('q_0001');
    expect(summary.targets[0].target_type).toBe('question');
  });

  it('handles empty targets list', () => {
    const summary = buildRunSummaryFromSegmentation({ run_id: 'run_x', targets: [] });
    expect(summary.targets).toHaveLength(0);
  });

  it('does not include review_comment key when absent (clean entry)', () => {
    const summary = buildRunSummaryFromSegmentation(makeResult());
    expect('review_comment' in summary.targets[0]).toBe(false);
  });

  // INV-4 compliance: RunSummaryTargetEntry carries review_comment
  // but it is NOT part of the result-model contract (that module is TASK-401+).
  // This test confirms the summary type does not prevent future clean result rows.
  it('summary state type contains review_comment but this is not a result-row type', () => {
    // The RunSummaryTargetEntry is a UI view model, not a result row.
    // Confirm the entry type structure is separate from any result contract.
    const summary = buildRunSummaryFromSegmentation(makeResult());
    const entry = summary.targets[1];
    // review_comment is present here (in summary) — this is correct per INV-4
    expect(entry.review_comment).toBeDefined();
    // The entry does NOT have drive_url, output_file_name, status fields
    // (those belong to the result-model in TASK-401+)
    expect('drive_url' in entry).toBe(false);
    expect('output_file_name' in entry).toBe(false);
  });
});
