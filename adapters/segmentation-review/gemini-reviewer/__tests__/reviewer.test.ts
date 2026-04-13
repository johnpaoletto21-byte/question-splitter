/**
 * adapters/segmentation-review/gemini-reviewer/__tests__/reviewer.test.ts
 *
 * Unit tests for the Gemini reviewer adapter.
 * Uses injected mocks for HTTP client and image encoder — no real network calls.
 *
 * Proves:
 *   - reviewSegmentation returns null for "pass" verdict.
 *   - reviewSegmentation returns corrected SegmentationResult for "corrected" verdict.
 *   - Sends all pages (no windowing).
 *   - API errors propagate.
 */

import { reviewSegmentation } from '../reviewer';
import type { PreparedPageImage } from '../../../../core/source-model/types';
import type { CropTargetProfile } from '../../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../../core/segmentation-contract/types';
import type { GeminiReviewerConfig } from '../types';

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

const CONFIG: GeminiReviewerConfig = { apiKey: 'test-api-key' };

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
      question_number: '1',
      question_text: 'What is X?',
      sub_questions: [],
    },
  ],
};

function makeGeminiEnvelope(innerJson: unknown): unknown {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(innerJson) }],
        },
      },
    ],
  };
}

describe('reviewSegmentation', () => {
  const RUN_ID = 'run_2024-01-15_abc12345';
  const mockHttpPost = jest.fn();
  const mockEncodeFn = jest.fn(() => 'FAKE_BASE64');

  beforeEach(() => {
    mockHttpPost.mockClear();
    mockEncodeFn.mockClear();
  });

  it('returns null when verdict is "pass"', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({ verdict: 'pass' }));

    const result = await reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );

    expect(result).toBeNull();
  });

  it('returns corrected SegmentationResult when verdict is "corrected"', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          question_number: '1',
          question_text: 'What is X?',
          sub_questions: [],
        },
        {
          target_type: 'question',
          question_number: '2',
          question_text: 'Explain Y.',
          sub_questions: ['(a)', '(b)'],
        },
      ],
    }));

    const result = await reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1), makePage(2)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );

    expect(result).not.toBeNull();
    expect(result!.run_id).toBe(RUN_ID);
    expect(result!.targets).toHaveLength(2);
    expect(result!.targets[0].target_id).toBe('q_0001');
    expect(result!.targets[1].target_id).toBe('q_0002');
  });

  it('sends all pages to the Gemini endpoint', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({ verdict: 'pass' }));
    const pages = [makePage(1), makePage(2), makePage(3), makePage(4)];

    await reviewSegmentation(
      RUN_ID, SEGMENTATION, pages, PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );

    expect(mockEncodeFn).toHaveBeenCalledTimes(4);
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });

  it('calls httpPost with the Gemini endpoint URL containing the API key', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({ verdict: 'pass' }));

    await reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );

    const url = mockHttpPost.mock.calls[0][0] as string;
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('generateContent');
    expect(url).toContain('test-api-key');
  });

  it('uses custom model when specified in config', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({ verdict: 'pass' }));
    const customConfig = { apiKey: 'key', model: 'gemini-1.5-pro' };

    await reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1)], PROFILE, '', customConfig,
      mockHttpPost, mockEncodeFn,
    );

    const url = mockHttpPost.mock.calls[0][0] as string;
    expect(url).toContain('gemini-1.5-pro');
  });

  it('surfaces httpPost errors', async () => {
    mockHttpPost.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    )).rejects.toThrow('Network timeout');
  });

  it('surfaces non-schema errors from parsing without retry', async () => {
    // Return something that's not an object at all
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope('not an object'));

    await expect(reviewSegmentation(
      RUN_ID, SEGMENTATION, [makePage(1)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    )).rejects.toThrow('must be an object');

    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });
});
