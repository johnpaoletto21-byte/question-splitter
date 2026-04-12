/**
 * core/run-orchestrator/__tests__/review-step.test.ts
 *
 * Unit tests for the review orchestrator step.
 *
 * Proves:
 *   - Orchestrator calls the injected reviewer with the correct arguments.
 *   - Returns corrected result when reviewer provides one.
 *   - Returns original result when reviewer returns null ("pass").
 *   - Errors from the reviewer propagate correctly.
 */

import { runReviewStep } from '../review-step';
import type { SegmentationReviewer } from '../review-step';
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

const ORIGINAL: SegmentationResult = {
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
    },
  ],
};

const CORRECTED: SegmentationResult = {
  run_id: 'run_2024-01-01_abc12345',
  targets: [
    {
      target_id: 'q_0001',
      target_type: 'question',
      regions: [{ page_number: 1 }, { page_number: 2 }],
    },
  ],
};

describe('runReviewStep', () => {
  it('calls the reviewer with all expected arguments', async () => {
    const reviewer: SegmentationReviewer = jest.fn().mockResolvedValue(null);
    const pages = [makePage(1), makePage(2), makePage(3)];

    await runReviewStep('run_2024-01-01_abc12345', ORIGINAL, pages, PROFILE, 'prompt', reviewer);

    expect(reviewer).toHaveBeenCalledTimes(1);
    expect(reviewer).toHaveBeenCalledWith(
      'run_2024-01-01_abc12345',
      ORIGINAL,
      pages,
      PROFILE,
      'prompt',
    );
  });

  it('returns the original result when reviewer returns null (pass)', async () => {
    const reviewer: SegmentationReviewer = jest.fn().mockResolvedValue(null);
    const result = await runReviewStep(
      ORIGINAL.run_id, ORIGINAL, [makePage(1)], PROFILE, '', reviewer,
    );
    expect(result).toBe(ORIGINAL);
  });

  it('returns corrected result when reviewer provides one', async () => {
    const reviewer: SegmentationReviewer = jest.fn().mockResolvedValue(CORRECTED);
    const result = await runReviewStep(
      ORIGINAL.run_id, ORIGINAL, [makePage(1)], PROFILE, '', reviewer,
    );
    expect(result).toBe(CORRECTED);
    expect(result).not.toBe(ORIGINAL);
  });

  it('passes extractionFields option to the reviewer when provided', async () => {
    const reviewer: SegmentationReviewer = jest.fn().mockResolvedValue(null);
    const fields = [{
      key: 'has_diagram',
      label: 'Has Diagram',
      description: 'true if diagram appears',
      type: 'boolean' as const,
    }];

    await runReviewStep(
      ORIGINAL.run_id, ORIGINAL, [makePage(1)], PROFILE, '', reviewer,
      { extractionFields: fields },
    );

    expect(reviewer).toHaveBeenCalledWith(
      expect.any(String), expect.any(Object), expect.any(Array),
      expect.any(Object), expect.any(String),
      { extractionFields: fields },
    );
  });

  it('re-throws errors from the reviewer', async () => {
    const error = new Error('Gemini API failed');
    const reviewer: SegmentationReviewer = jest.fn().mockRejectedValue(error);
    await expect(
      runReviewStep('run_x', ORIGINAL, [makePage(1)], PROFILE, '', reviewer),
    ).rejects.toThrow('Gemini API failed');
  });

  it('passes the promptSnapshot string to the reviewer', async () => {
    const reviewer: SegmentationReviewer = jest.fn().mockResolvedValue(null);
    const snapshot = 'CUSTOM REVIEWER PROMPT';
    await runReviewStep(ORIGINAL.run_id, ORIGINAL, [makePage(1)], PROFILE, snapshot, reviewer);
    expect(reviewer).toHaveBeenCalledWith(
      expect.any(String), expect.any(Object), expect.any(Array),
      expect.any(Object), snapshot,
    );
  });
});
