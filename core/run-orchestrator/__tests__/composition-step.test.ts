/**
 * core/run-orchestrator/__tests__/composition-step.test.ts
 *
 * Proves (TASK-401 acceptance bar):
 *   - Failed CropStepTargetResult → failed FinalResultRow, no stacker call (INV-8).
 *   - 1-region ok crop → ok FinalResultRow via passthrough, no stacker call (INV-5, INV-6).
 *   - 2-region ok crop → ok FinalResultRow, stacker called once (INV-5, INV-6).
 *   - CompositionError (3-region trigger) → failed row, next target continues (INV-8).
 *   - review_comment absent from every FinalResultRow (INV-4).
 *   - source_pages derived from localizedTargets, not crop result (correct data source).
 *   - One FinalResultRow per cropResult, same order (INV-5).
 */

import { runCompositionStep } from '../composition-step';
import type { ImageStackerFn } from '../composition-step';
import type { CropStepTargetResult } from '../crop-step';
import type { LocalizationResult } from '../../localization-contract/types';
import type { CropTargetProfile } from '../../crop-target-profile/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

function makeOkCrop1(targetId: string): CropStepTargetResult {
  return {
    status: 'ok',
    targetId,
    regions: [
      {
        page_number: 1,
        pixelRect: { x: 0, y: 0, width: 100, height: 200 },
        cropFilePath: `/tmp/crops/${targetId}_r0.png`,
      },
    ],
  };
}

function makeOkCrop2(targetId: string, p1 = 1, p2 = 2): CropStepTargetResult {
  return {
    status: 'ok',
    targetId,
    regions: [
      {
        page_number: p1,
        pixelRect: { x: 0, y: 0, width: 100, height: 200 },
        cropFilePath: `/tmp/crops/${targetId}_r0.png`,
      },
      {
        page_number: p2,
        pixelRect: { x: 0, y: 0, width: 100, height: 150 },
        cropFilePath: `/tmp/crops/${targetId}_r1.png`,
      },
    ],
  };
}

function makeFailedCrop(targetId: string): CropStepTargetResult {
  return {
    status: 'failed',
    targetId,
    code: 'BBOX_INVALID',
    message: `BBOX_INVALID: target "${targetId}" — inverted y-axis`,
  };
}

// 3-region ok crop — will trigger CompositionError in composeOutput (INV-3 guard).
function makeOkCrop3(targetId: string): CropStepTargetResult {
  return {
    status: 'ok',
    targetId,
    regions: [
      { page_number: 1, pixelRect: { x: 0, y: 0, width: 100, height: 200 }, cropFilePath: `/tmp/crops/${targetId}_r0.png` },
      { page_number: 2, pixelRect: { x: 0, y: 0, width: 100, height: 200 }, cropFilePath: `/tmp/crops/${targetId}_r1.png` },
      { page_number: 3, pixelRect: { x: 0, y: 0, width: 100, height: 200 }, cropFilePath: `/tmp/crops/${targetId}_r2.png` },
    ],
  };
}

function makeLoc(targetId: string, pages: number[]): LocalizationResult {
  return {
    run_id: 'run_test_401',
    target_id: targetId,
    regions: pages.map((p) => ({ page_number: p, bbox_1000: [100, 50, 800, 950] })),
  };
}

// ---------------------------------------------------------------------------
// Failed crop passthrough (INV-8)
// ---------------------------------------------------------------------------

describe('runCompositionStep — failed crop passthrough', () => {
  it('emits a failed FinalResultRow without calling imageStacker', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const rows = await runCompositionStep(
      'run_test_401',
      [makeFailedCrop('q_0001')],
      [makeLoc('q_0001', [1])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].target_id).toBe('q_0001');
    expect(rows[0].output_file_name).toBe('');
    expect(stacker).not.toHaveBeenCalled();
  });

  it('does not include review_comment in the failed row (INV-4)', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const rows = await runCompositionStep(
      'run_test_401',
      [makeFailedCrop('q_0001')],
      [makeLoc('q_0001', [1])],
      PROFILE,
      stacker,
    );
    expect('review_comment' in rows[0]).toBe(false);
  });

  it('continues to compose subsequent targets after a crop failure (INV-8)', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async () => '/tmp/output/q_0002.png',
    );
    const rows = await runCompositionStep(
      'run_test_401',
      [makeFailedCrop('q_0001'), makeOkCrop1('q_0002')],
      [makeLoc('q_0001', [1]), makeLoc('q_0002', [2])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('failed');
    expect(rows[1].status).toBe('ok');
    expect(rows[1].target_id).toBe('q_0002');
  });
});

// ---------------------------------------------------------------------------
// 1-region passthrough (INV-5, INV-6)
// ---------------------------------------------------------------------------

describe('runCompositionStep — 1-region passthrough', () => {
  it('emits ok row with the crop file as local_output_path', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop1('q_0001')],
      [makeLoc('q_0001', [1])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].output_file_name).toBe('q_0001_r0.png');
    if (rows[0].status === 'ok') {
      expect(rows[0].local_output_path).toBe('/tmp/crops/q_0001_r0.png');
    }
    expect(stacker).not.toHaveBeenCalled();
  });

  it('derives source_pages from localizedTargets', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop1('q_0001')],
      [makeLoc('q_0001', [5])],
      PROFILE,
      stacker,
    );
    expect(rows[0].source_pages).toEqual([5]);
  });

  it('does not include review_comment in the ok row (INV-4)', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop1('q_0001')],
      [makeLoc('q_0001', [1])],
      PROFILE,
      stacker,
    );
    expect('review_comment' in rows[0]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2-region composition (INV-5, INV-6)
// ---------------------------------------------------------------------------

describe('runCompositionStep — 2-region composition', () => {
  it('calls imageStacker once and emits ok row', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async () => '/tmp/output/q_0001.png',
    );
    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop2('q_0001', 1, 2)],
      [makeLoc('q_0001', [1, 2])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    expect(stacker).toHaveBeenCalledTimes(1);
    expect(stacker).toHaveBeenCalledWith(
      'q_0001',
      '/tmp/crops/q_0001_r0.png',
      '/tmp/crops/q_0001_r1.png',
    );
    expect(rows[0].output_file_name).toBe('q_0001.png');
    expect(rows[0].source_pages).toEqual([1, 2]);
  });

  it('emits one row per target in input order (INV-5)', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async (id) => `/tmp/output/${id}.png`,
    );
    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop2('q_0001'), makeOkCrop2('q_0002', 3, 4)],
      [makeLoc('q_0001', [1, 2]), makeLoc('q_0002', [3, 4])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].target_id).toBe('q_0001');
    expect(rows[1].target_id).toBe('q_0002');
  });
});

// ---------------------------------------------------------------------------
// CompositionError continuation (INV-8 — triggered via 3-region guard)
// ---------------------------------------------------------------------------

describe('runCompositionStep — CompositionError continuation (INV-8)', () => {
  it('emits failed row for 3-region target and continues to next target', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async (id) => `/tmp/output/${id}.png`,
    );

    const rows = await runCompositionStep(
      'run_test_401',
      [makeOkCrop3('q_0001'), makeOkCrop1('q_0002')],
      [makeLoc('q_0001', [1, 2, 3]), makeLoc('q_0002', [4])],
      PROFILE,
      stacker,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].target_id).toBe('q_0001');
    expect(rows[0].output_file_name).toBe('');
    // Stacker must not have been called for the 3-region target (guard fires before I/O).
    expect(stacker).not.toHaveBeenCalledWith('q_0001', expect.any(String), expect.any(String));
    // Second target should succeed.
    expect(rows[1].status).toBe('ok');
    expect(rows[1].target_id).toBe('q_0002');
  });
});
