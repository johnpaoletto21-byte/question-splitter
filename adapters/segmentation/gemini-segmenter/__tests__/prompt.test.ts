/**
 * adapters/segmentation/gemini-segmenter/__tests__/prompt.test.ts
 *
 * Unit tests for prompt construction.
 */

import { buildSegmentationPrompt } from '../prompt';
import type { PreparedPageImage } from '../../../../core/source-model/types';
import type { CropTargetProfile } from '../../../../core/crop-target-profile/types';

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

function makePage(pageNum: number, sourceId: string = 'src_0000_exam'): PreparedPageImage {
  return {
    source_id: sourceId,
    page_number: pageNum,
    image_path: `/tmp/${sourceId}_page_${pageNum}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

describe('buildSegmentationPrompt', () => {
  it('includes target_type from profile', () => {
    const prompt = buildSegmentationPrompt([makePage(1)], PROFILE, '');
    expect(prompt).toContain('question');
  });

  it('includes max_regions_per_target from profile', () => {
    const prompt = buildSegmentationPrompt([makePage(1)], PROFILE, '');
    expect(prompt).toContain('2');
  });

  it('lists page numbers in the prompt', () => {
    const pages = [makePage(1), makePage(2), makePage(3)];
    const prompt = buildSegmentationPrompt(pages, PROFILE, '');
    expect(prompt).toContain('Page 1');
    expect(prompt).toContain('Page 2');
    expect(prompt).toContain('Page 3');
  });

  it('includes source_id for each page', () => {
    const pages = [makePage(1, 'src_0001_paper'), makePage(2, 'src_0001_paper')];
    const prompt = buildSegmentationPrompt(pages, PROFILE, '');
    expect(prompt).toContain('src_0001_paper');
  });

  it('uses promptSnapshot verbatim when non-empty (TASK-502 hook point)', () => {
    const snapshot = 'CUSTOM PROMPT: identify targets';
    const prompt = buildSegmentationPrompt([makePage(1)], PROFILE, snapshot);
    expect(prompt).toBe(snapshot);
  });

  it('ignores whitespace-only promptSnapshot and uses built-in prompt', () => {
    const prompt = buildSegmentationPrompt([makePage(1)], PROFILE, '   ');
    expect(prompt).toContain('Agent 1');
  });

  it('does not mention bbox or crop coordinates', () => {
    const prompt = buildSegmentationPrompt([makePage(1), makePage(2)], PROFILE, '');
    expect(prompt).not.toContain('bbox');
    expect(prompt).not.toContain('coordinate');
    expect(prompt).not.toContain('pixel');
  });
});
