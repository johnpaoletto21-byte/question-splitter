/**
 * core/run-summary/__tests__/summary-localization.test.ts
 *
 * Unit tests for applyLocalizationToSummary.
 *
 * Proves:
 *   - agent2_status = 'ok' when no review_comment.
 *   - agent2_status = 'needs_review' when review_comment is present (INV-4).
 *   - agent2_review_comment flows through when present (INV-4: visible in summary).
 *   - agent2_review_comment is absent when not provided (clean result).
 *   - Unrelated target entries are not modified (immutable update).
 *   - Returns a new state object (does not mutate the input).
 *   - Throws when target_id is not found in summary state.
 *   - review_comment (Agent 1) is not lost after applying Agent 2 result.
 */

import { buildRunSummaryFromSegmentation, applyLocalizationToSummary } from '../summary';
import type { LocalizationResult } from '../../localization-contract/types';
import type { SegmentationResult } from '../../segmentation-contract/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegResult(): SegmentationResult {
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
        review_comment: 'Agent 1 boundary ambiguous',
      },
    ],
  };
}

function makeLocResult(overrides: Partial<LocalizationResult> = {}): LocalizationResult {
  return {
    run_id: 'run_2024-01-01_test',
    target_id: 'q_0001',
    regions: [{ page_number: 1, bbox_1000: [100, 50, 800, 950] }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyLocalizationToSummary', () => {
  it('sets agent2_status = "ok" when no review_comment', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_0001' });
    const updated = applyLocalizationToSummary(state, result);
    expect(updated.targets[0].agent2_status).toBe('ok');
  });

  it('sets agent2_status = "needs_review" when review_comment is present (INV-4)', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({
      target_id: 'q_0001',
      review_comment: 'bbox confidence low near fold',
    });
    const updated = applyLocalizationToSummary(state, result);
    expect(updated.targets[0].agent2_status).toBe('needs_review');
  });

  it('carries agent2_review_comment when present (INV-4: visible in UI)', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({
      target_id: 'q_0001',
      review_comment: 'bbox confidence low near fold',
    });
    const updated = applyLocalizationToSummary(state, result);
    expect(updated.targets[0].agent2_review_comment).toBe('bbox confidence low near fold');
  });

  it('does not include agent2_review_comment when absent (clean result)', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_0001' });
    const updated = applyLocalizationToSummary(state, result);
    expect('agent2_review_comment' in updated.targets[0]).toBe(false);
  });

  it('does not modify target entries not in the localization result', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_0001' });
    const updated = applyLocalizationToSummary(state, result);
    // q_0002 should not have agent2_status yet
    expect(updated.targets[1].agent2_status).toBeUndefined();
    expect(updated.targets[1].agent2_review_comment).toBeUndefined();
  });

  it('preserves Agent 1 review_comment when applying Agent 2 result', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({
      target_id: 'q_0002',
      regions: [
        { page_number: 2, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 3, bbox_1000: [0, 0, 500, 1000] },
      ],
    });
    const updated = applyLocalizationToSummary(state, result);
    // Agent 1 comment should still be there
    expect(updated.targets[1].review_comment).toBe('Agent 1 boundary ambiguous');
    expect(updated.targets[1].agent1_status).toBe('needs_review');
    // And agent2 fields are now set
    expect(updated.targets[1].agent2_status).toBe('ok');
  });

  it('returns a new state object (immutable update)', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_0001' });
    const updated = applyLocalizationToSummary(state, result);
    expect(updated).not.toBe(state);
    expect(updated.targets).not.toBe(state.targets);
    expect(updated.targets[0]).not.toBe(state.targets[0]);
  });

  it('does not mutate the original state', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const originalAgent2Status = state.targets[0].agent2_status;
    const result = makeLocResult({ target_id: 'q_0001' });
    applyLocalizationToSummary(state, result);
    // Original state should be unchanged
    expect(state.targets[0].agent2_status).toBe(originalAgent2Status);
    expect(state.targets[0].agent2_status).toBeUndefined();
  });

  it('throws when target_id is not found in summary state', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_9999' });
    expect(() => applyLocalizationToSummary(state, result)).toThrow('q_9999');
  });

  it('carries run_id through unchanged', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const result = makeLocResult({ target_id: 'q_0001' });
    const updated = applyLocalizationToSummary(state, result);
    expect(updated.run_id).toBe(state.run_id);
  });

  it('can apply localization for all targets sequentially', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());

    const loc1 = makeLocResult({ target_id: 'q_0001' });
    const loc2: LocalizationResult = {
      run_id: 'run_2024-01-01_test',
      target_id: 'q_0002',
      regions: [
        { page_number: 2, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 3, bbox_1000: [0, 0, 300, 1000] },
      ],
      review_comment: 'Agent 2 bbox uncertain',
    };

    const state1 = applyLocalizationToSummary(state, loc1);
    const state2 = applyLocalizationToSummary(state1, loc2);

    expect(state2.targets[0].agent2_status).toBe('ok');
    expect(state2.targets[1].agent2_status).toBe('needs_review');
    expect(state2.targets[1].agent2_review_comment).toBe('Agent 2 bbox uncertain');
  });
});
