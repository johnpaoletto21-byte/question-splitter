/**
 * core/run-orchestrator/__tests__/localization-step.test.ts
 *
 * Unit tests for the runLocalizationStep orchestrator step.
 *
 * Proves:
 *   - All targets from SegmentationResult are processed in reading order.
 *   - Results are returned in the same order as the targets array.
 *   - The injected Localizer is called once per target with the correct args.
 *   - Errors from the localizer propagate to the caller.
 *   - The Localizer type is defined in core (no SDK import needed here).
 */

import { runLocalizationStep } from '../localization-step';
import type { Localizer } from '../localization-step';
import type { SegmentationResult } from '../../segmentation-contract/types';
import type { PreparedPageImage } from '../../source-model/types';
import type { CropTargetProfile } from '../../crop-target-profile/types';
import type { LocalizationResult } from '../../localization-contract/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

function makeSegResult(targetCount: number = 2): SegmentationResult {
  return {
    run_id: 'run_test_001',
    targets: Array.from({ length: targetCount }, (_, i) => ({
      target_id: `q_${String(i + 1).padStart(4, '0')}`,
      target_type: 'question',
      regions: [{ page_number: i + 1 }],
    })),
  };
}

function makePage(pageNumber: number): PreparedPageImage {
  return {
    source_id: 'src_0001_test',
    page_number: pageNumber,
    image_path: `/tmp/page_${pageNumber}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

function makeLocResult(targetId: string, pageNumber: number): LocalizationResult {
  return {
    run_id: 'run_test_001',
    target_id: targetId,
    regions: [{ page_number: pageNumber, bbox_1000: [100, 50, 800, 950] }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runLocalizationStep', () => {
  it('processes all targets from the segmentation result', async () => {
    const segResult = makeSegResult(3);
    const pages = [makePage(1), makePage(2), makePage(3)];
    const callLog: string[] = [];

    const localizer: Localizer = async (_runId, target) => {
      callLog.push(target.target_id);
      return makeLocResult(target.target_id, target.regions[0].page_number);
    };

    const results = await runLocalizationStep(
      'run_test_001',
      segResult,
      pages,
      PROFILE,
      '',
      localizer,
    );

    expect(results).toHaveLength(3);
    expect(callLog).toEqual(['q_0001', 'q_0002', 'q_0003']);
  });

  it('returns results in the same reading order as segmentation targets', async () => {
    const segResult = makeSegResult(2);
    const pages = [makePage(1), makePage(2)];

    const localizer: Localizer = async (_runId, target) =>
      makeLocResult(target.target_id, target.regions[0].page_number);

    const results = await runLocalizationStep(
      'run_test_001',
      segResult,
      pages,
      PROFILE,
      '',
      localizer,
    );

    expect(results[0].target_id).toBe('q_0001');
    expect(results[1].target_id).toBe('q_0002');
  });

  it('calls the localizer with the correct run_id, target, pages, and profile', async () => {
    const segResult = makeSegResult(1);
    const pages = [makePage(1)];
    let capturedRunId = '';
    let capturedTargetId = '';
    let capturedProfile: CropTargetProfile | undefined;

    const localizer: Localizer = async (runId, target, _pages, profile) => {
      capturedRunId = runId;
      capturedTargetId = target.target_id;
      capturedProfile = profile;
      return makeLocResult(target.target_id, target.regions[0].page_number);
    };

    await runLocalizationStep('run_test_001', segResult, pages, PROFILE, '', localizer);

    expect(capturedRunId).toBe('run_test_001');
    expect(capturedTargetId).toBe('q_0001');
    expect(capturedProfile).toEqual(PROFILE);
  });

  it('passes promptSnapshot to the localizer', async () => {
    const segResult = makeSegResult(1);
    let capturedSnapshot = '';

    const localizer: Localizer = async (_runId, target, _pages, _profile, promptSnapshot) => {
      capturedSnapshot = promptSnapshot;
      return makeLocResult(target.target_id, target.regions[0].page_number);
    };

    await runLocalizationStep(
      'run_test_001',
      segResult,
      [makePage(1)],
      PROFILE,
      'custom-snapshot',
      localizer,
    );

    expect(capturedSnapshot).toBe('custom-snapshot');
  });

  it('returns an empty array when segmentation result has no targets', async () => {
    const segResult: SegmentationResult = { run_id: 'run_empty', targets: [] };
    const localizer: Localizer = jest.fn();

    const results = await runLocalizationStep('run_empty', segResult, [], PROFILE, '', localizer);

    expect(results).toEqual([]);
    expect(localizer).not.toHaveBeenCalled();
  });

  it('propagates errors from the localizer', async () => {
    const segResult = makeSegResult(1);

    const localizer: Localizer = async () => {
      throw { code: 'LOCALIZATION_SCHEMA_INVALID', message: 'bbox invalid' };
    };

    await expect(
      runLocalizationStep('run_err', segResult, [makePage(1)], PROFILE, '', localizer),
    ).rejects.toMatchObject({ code: 'LOCALIZATION_SCHEMA_INVALID' });
  });
});
