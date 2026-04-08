/**
 * core/run-summary/__tests__/summary-final.test.ts
 *
 * Unit tests for applyFinalResultsToSummary.
 *
 * Proves:
 *   - final_status = 'ok' set for a successful row.
 *   - final_status = 'failed' set for a failed row.
 *   - drive_url carried into summary entry when present on FinalResultOk (INV-4: UI visibility).
 *   - drive_url absent when not present on FinalResultOk (upload may not have run).
 *   - failure_code and failure_message carried for failed rows.
 *   - All target rows updated (INV-8: partial failure does not hide other targets).
 *   - review_comment and agent2_review_comment are NOT lost after applying final results (INV-4).
 *   - review_comment does not appear on FinalResultRow shapes — only in summary state.
 *   - Returns a new state object (immutable update).
 *   - Throws when a row target_id is not found in summary state (contract violation).
 */

import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../summary';
import type { SegmentationResult } from '../../segmentation-contract/types';
import type { LocalizationResult } from '../../localization-contract/types';
import type { FinalResultRow } from '../../result-model/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegResult(): SegmentationResult {
  return {
    run_id: 'run_test_501',
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
      {
        target_id: 'q_0003',
        target_type: 'question',
        regions: [{ page_number: 4 }],
      },
    ],
  };
}

function makeLocResult(targetId: string, reviewComment?: string): LocalizationResult {
  return {
    run_id: 'run_test_501',
    target_id: targetId,
    regions: [{ page_number: 1, bbox_1000: [100, 50, 800, 950] }],
    ...(reviewComment !== undefined ? { review_comment: reviewComment } : {}),
  };
}

function makeOkRow(
  targetId: string,
  driveUrl?: string,
): FinalResultRow {
  return {
    target_id: targetId,
    source_pages: [1],
    output_file_name: `${targetId}.png`,
    status: 'ok',
    local_output_path: `/tmp/${targetId}.png`,
    ...(driveUrl !== undefined ? { drive_url: driveUrl } : {}),
  };
}

function makeFailedRow(
  targetId: string,
  code: string,
  message: string,
): FinalResultRow {
  return {
    target_id: targetId,
    source_pages: [1],
    output_file_name: '',
    status: 'failed',
    failure_code: code,
    failure_message: message,
  };
}

// Build a base summary with localization applied to all three targets.
function makeBaseState() {
  const seg = makeSegResult();
  let state = buildRunSummaryFromSegmentation(seg);
  state = applyLocalizationToSummary(state, makeLocResult('q_0001'));
  state = applyLocalizationToSummary(
    state,
    makeLocResult('q_0002', 'Agent 2 bbox uncertain'),
  );
  state = applyLocalizationToSummary(state, makeLocResult('q_0003'));
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyFinalResultsToSummary', () => {
  it('sets final_status = "ok" for a successful row', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect(updated.targets[0].final_status).toBe('ok');
  });

  it('sets final_status = "failed" for a failed row', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [
      makeFailedRow('q_0001', 'CROP_FAILED', 'Crop error'),
    ]);
    expect(updated.targets[0].final_status).toBe('failed');
  });

  it('carries drive_url into summary entry when present (INV-4: UI visibility)', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [
      makeOkRow('q_0001', 'https://drive.google.com/file/d/abc123/view'),
    ]);
    expect(updated.targets[0].drive_url).toBe('https://drive.google.com/file/d/abc123/view');
  });

  it('does not set drive_url when absent on FinalResultOk', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect('drive_url' in updated.targets[0]).toBe(false);
  });

  it('carries failure_code and failure_message for failed rows', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [
      makeFailedRow('q_0001', 'BBOX_INVALID', 'x_max <= x_min'),
    ]);
    expect(updated.targets[0].failure_code).toBe('BBOX_INVALID');
    expect(updated.targets[0].failure_message).toBe('x_max <= x_min');
  });

  it('updates all targets from a mixed ok/failed row set (INV-8: partial failure visible)', () => {
    const state = makeBaseState();
    const rows: FinalResultRow[] = [
      makeOkRow('q_0001', 'https://drive.google.com/file/d/abc/view'),
      makeFailedRow('q_0002', 'COMPOSITION_FAILED', 'stacker error'),
      makeOkRow('q_0003'),
    ];
    const updated = applyFinalResultsToSummary(state, rows);

    expect(updated.targets[0].final_status).toBe('ok');
    expect(updated.targets[0].drive_url).toBe('https://drive.google.com/file/d/abc/view');

    // q_0002 failed — must remain visible (INV-8)
    expect(updated.targets[1].final_status).toBe('failed');
    expect(updated.targets[1].failure_code).toBe('COMPOSITION_FAILED');

    expect(updated.targets[2].final_status).toBe('ok');
  });

  it('preserves Agent 1 review_comment after applying final results (INV-4)', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0002')]);
    // q_0002 had review_comment from Agent 1 — must not be lost
    expect(updated.targets[1].review_comment).toBe('Agent 1 boundary ambiguous');
    expect(updated.targets[1].agent1_status).toBe('needs_review');
  });

  it('preserves Agent 2 agent2_review_comment after applying final results (INV-4)', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0002')]);
    // q_0002 had agent2_review_comment from Agent 2 step
    expect(updated.targets[1].agent2_review_comment).toBe('Agent 2 bbox uncertain');
    expect(updated.targets[1].agent2_status).toBe('needs_review');
  });

  it('does not add review_comment to a row that never had one', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect('review_comment' in updated.targets[0]).toBe(false);
  });

  it('returns a new state object (immutable update)', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect(updated).not.toBe(state);
    expect(updated.targets).not.toBe(state.targets);
    expect(updated.targets[0]).not.toBe(state.targets[0]);
  });

  it('does not mutate the original state', () => {
    const state = makeBaseState();
    const originalFinalStatus = state.targets[0].final_status;
    applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect(state.targets[0].final_status).toBe(originalFinalStatus);
    expect(state.targets[0].final_status).toBeUndefined();
  });

  it('carries run_id through unchanged', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect(updated.run_id).toBe(state.run_id);
  });

  it('leaves unmentioned targets unchanged', () => {
    const state = makeBaseState();
    // Only apply q_0001 result; q_0002 and q_0003 should have no final_status yet.
    const updated = applyFinalResultsToSummary(state, [makeOkRow('q_0001')]);
    expect(updated.targets[1].final_status).toBeUndefined();
    expect(updated.targets[2].final_status).toBeUndefined();
  });

  it('handles empty rows array (no-op update)', () => {
    const state = makeBaseState();
    const updated = applyFinalResultsToSummary(state, []);
    // Targets still present, none updated
    expect(updated.targets).toHaveLength(3);
    expect(updated.targets[0].final_status).toBeUndefined();
  });

  it('throws when a row target_id is not found in summary state', () => {
    const state = makeBaseState();
    expect(() =>
      applyFinalResultsToSummary(state, [makeOkRow('q_9999')]),
    ).toThrow('q_9999');
  });
});
