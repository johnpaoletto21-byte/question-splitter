/**
 * adapters/segmentation-review/gemini-reviewer/__tests__/prompt.test.ts
 *
 * Unit tests for the review prompt builder.
 *
 * Proves:
 *   - Includes Agent 1 segmentation JSON in the prompt.
 *   - Uses custom prompt when provided.
 *   - Falls back to DEFAULT_REVIEWER_PROMPT when snapshot is empty.
 *   - Includes extraction field definitions when provided.
 *   - Lists all pages.
 */

import { buildReviewPrompt } from '../prompt';
import { DEFAULT_REVIEWER_PROMPT } from '../../../../core/prompt-config-store/default-prompts';
import type { PreparedPageImage } from '../../../../core/source-model/types';
import type { CropTargetProfile } from '../../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../../core/segmentation-contract/types';

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

const SEGMENTATION: SegmentationResult = {
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

describe('buildReviewPrompt', () => {
  it('includes Agent 1 segmentation JSON in the prompt', () => {
    const prompt = buildReviewPrompt(
      [makePage(1), makePage(2), makePage(3)],
      PROFILE,
      'Custom instructions',
      SEGMENTATION,
    );
    expect(prompt).toContain('"target_id": "q_0001"');
    expect(prompt).toContain('"target_id": "q_0002"');
    expect(prompt).toContain('Agent 1 Segmentation Output');
  });

  it('uses custom prompt snapshot when provided', () => {
    const prompt = buildReviewPrompt(
      [makePage(1)],
      PROFILE,
      'My custom reviewer instructions',
      SEGMENTATION,
    );
    expect(prompt).toContain('My custom reviewer instructions');
    expect(prompt).not.toContain(DEFAULT_REVIEWER_PROMPT.slice(0, 40));
  });

  it('falls back to DEFAULT_REVIEWER_PROMPT when snapshot is empty', () => {
    const prompt = buildReviewPrompt([makePage(1)], PROFILE, '', SEGMENTATION);
    expect(prompt).toContain(DEFAULT_REVIEWER_PROMPT.slice(0, 40));
  });

  it('falls back to DEFAULT_REVIEWER_PROMPT when snapshot is whitespace', () => {
    const prompt = buildReviewPrompt([makePage(1)], PROFILE, '   ', SEGMENTATION);
    expect(prompt).toContain(DEFAULT_REVIEWER_PROMPT.slice(0, 40));
  });

  it('lists all pages in the prompt', () => {
    const pages = [makePage(1), makePage(2), makePage(3)];
    const prompt = buildReviewPrompt(pages, PROFILE, 'instructions', SEGMENTATION);
    expect(prompt).toContain('Page 1');
    expect(prompt).toContain('Page 2');
    expect(prompt).toContain('Page 3');
  });

  it('includes target type and max regions from profile', () => {
    const prompt = buildReviewPrompt([makePage(1)], PROFILE, 'instructions', SEGMENTATION);
    expect(prompt).toContain('Target type: question');
    expect(prompt).toContain('Maximum page regions per target: 2');
  });

  it('includes extraction field definitions when provided', () => {
    const prompt = buildReviewPrompt(
      [makePage(1)],
      PROFILE,
      'instructions',
      SEGMENTATION,
      {
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if diagram appears',
          type: 'boolean',
        }],
      },
    );
    expect(prompt).toContain('has_diagram');
    expect(prompt).toContain('true if diagram appears');
    expect(prompt).toContain('Custom Boolean Extraction Fields');
  });

  it('omits extraction fields block when none provided', () => {
    const prompt = buildReviewPrompt([makePage(1)], PROFILE, 'instructions', SEGMENTATION);
    expect(prompt).not.toContain('Custom Boolean Extraction Fields');
  });
});
