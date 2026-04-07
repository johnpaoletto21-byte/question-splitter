/**
 * core/run-orchestrator/__tests__/segmentation-step.test.ts
 *
 * Unit tests for the segmentation orchestrator step.
 *
 * Proves:
 *   - Orchestrator calls the injected segmenter with the correct arguments.
 *   - SegmentationResult is returned as-is (reading order preserved).
 *   - Errors from the segmenter propagate correctly.
 */

import { runSegmentationStep } from '../segmentation-step';
import type { PreparedPageImage } from '../../source-model/types';
import type { CropTargetProfile } from '../../crop-target-profile/types';
import type { SegmentationResult } from '../../segmentation-contract/types';

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

function makePage(pageNum: number): PreparedPageImage {
  return {
    source_id: 'src_0000_exam',
    page_number: pageNum,
    image_path: `/tmp/src_0000_exam_page_${pageNum}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

const MOCK_RESULT: SegmentationResult = {
  run_id: 'run_2024-01-01_abc12345',
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
      review_comment: 'Spans two pages',
    },
  ],
};

describe('runSegmentationStep', () => {
  it('calls the segmenter with run_id, pages, profile, and promptSnapshot', async () => {
    const segmenter = jest.fn().mockResolvedValue(MOCK_RESULT);
    const pages = [makePage(1), makePage(2), makePage(3)];

    await runSegmentationStep('run_2024-01-01_abc12345', pages, PROFILE, '', segmenter);

    expect(segmenter).toHaveBeenCalledTimes(1);
    expect(segmenter).toHaveBeenCalledWith(
      'run_2024-01-01_abc12345',
      pages,
      PROFILE,
      '',
    );
  });

  it('returns the SegmentationResult from the segmenter unchanged', async () => {
    const segmenter = jest.fn().mockResolvedValue(MOCK_RESULT);
    const result = await runSegmentationStep(
      MOCK_RESULT.run_id, [makePage(1), makePage(2), makePage(3)],
      PROFILE, '', segmenter,
    );
    expect(result).toBe(MOCK_RESULT);
  });

  it('preserves target order from the segmenter result', async () => {
    const segmenter = jest.fn().mockResolvedValue(MOCK_RESULT);
    const result = await runSegmentationStep(
      MOCK_RESULT.run_id, [makePage(1)], PROFILE, '', segmenter,
    );
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[1].target_id).toBe('q_0002');
  });

  it('passes the promptSnapshot string to the segmenter', async () => {
    const segmenter = jest.fn().mockResolvedValue(MOCK_RESULT);
    const snapshot = 'CUSTOM PROMPT TEXT';
    await runSegmentationStep(MOCK_RESULT.run_id, [makePage(1)], PROFILE, snapshot, segmenter);
    expect(segmenter).toHaveBeenCalledWith(
      expect.any(String), expect.any(Array), expect.any(Object), snapshot,
    );
  });

  it('re-throws errors from the segmenter', async () => {
    const error = new Error('Gemini API failed');
    const segmenter = jest.fn().mockRejectedValue(error);
    await expect(
      runSegmentationStep('run_x', [makePage(1)], PROFILE, '', segmenter),
    ).rejects.toThrow('Gemini API failed');
  });

  it('works with an empty pages list (passes through to segmenter)', async () => {
    const segmenter = jest.fn().mockResolvedValue({ run_id: 'run_x', targets: [] });
    const result = await runSegmentationStep('run_x', [], PROFILE, '', segmenter);
    expect(result.targets).toHaveLength(0);
  });
});
