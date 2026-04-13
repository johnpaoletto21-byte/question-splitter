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

  it('includes number of page images provided', () => {
    const pages = [makePage(1), makePage(2)];
    const prompt = buildSegmentationPrompt(pages, PROFILE, '');
    expect(prompt).toContain('2');
  });

  it('uses promptSnapshot as the editable instruction block when non-empty', () => {
    const snapshot = 'CUSTOM PROMPT: identify targets';
    const prompt = buildSegmentationPrompt([makePage(1)], PROFILE, snapshot);
    expect(prompt).toContain(snapshot);
    expect(prompt).toContain('## Run Context');
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

  it('does not mention regions or image indices', () => {
    const prompt = buildSegmentationPrompt([makePage(1), makePage(2)], PROFILE, '');
    expect(prompt).not.toContain('image_index');
    expect(prompt).not.toContain('finish_image_index');
  });

  it('includes chunk context when chunkStartPage and chunkEndPage are provided', () => {
    const prompt = buildSegmentationPrompt(
      [makePage(4), makePage(5), makePage(6)],
      PROFILE,
      '',
      { chunkStartPage: 4, chunkEndPage: 6 },
    );
    expect(prompt).toContain('pages 4 to 6');
  });

  it('includes custom extraction field keys and descriptions', () => {
    const prompt = buildSegmentationPrompt(
      [makePage(1)],
      PROFILE,
      '',
      {
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if the question includes a diagram',
          type: 'boolean',
        }],
      },
    );

    expect(prompt).toContain('has_diagram');
    expect(prompt).toContain('true if the question includes a diagram');
  });
});
