/**
 * adapters/segmentation/gemini-segmenter/__tests__/segmenter.test.ts
 *
 * Unit tests for the segmenter adapter.
 * Uses injected mocks for HTTP client and image encoder — no real network calls.
 *
 * Proves:
 *   - segmentPages calls the Gemini endpoint correctly.
 *   - Returns a normalized SegmentationResult (question inventory).
 *   - review_comment propagates through.
 *   - API errors are surfaced with a descriptive message.
 *   - buildGeminiRequest and unwrapGeminiResponse helper behavior.
 */

import { segmentPages, buildGeminiRequest, unwrapGeminiResponse } from '../segmenter';
import { buildGeminiSegmentationSchema } from '../schema';
import type { PreparedPageImage } from '../../../../core/source-model/types';
import type { CropTargetProfile } from '../../../../core/crop-target-profile/types';
import type { GeminiSegmenterConfig } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom',
};

const CONFIG: GeminiSegmenterConfig = { apiKey: 'test-api-key' };

function makePage(pageNum: number): PreparedPageImage {
  return {
    source_id: 'src_0000_exam',
    page_number: pageNum,
    image_path: `/tmp/src_0000_exam_page_${pageNum}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

/** Builds a fake Gemini response envelope with a JSON-stringified body. */
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

// ---------------------------------------------------------------------------
// buildGeminiRequest
// ---------------------------------------------------------------------------

describe('buildGeminiRequest', () => {
  it('includes a text part as first element', () => {
    const req = buildGeminiRequest('hello', [makePage(1)], () => 'BASE64DATA');
    const parts = (req['contents'] as unknown[][])[0] as unknown;
    const partsArr = (parts as Record<string, unknown[]>)['parts'];
    expect((partsArr[0] as Record<string, unknown>)['text']).toBe('hello');
  });

  it('adds one image part per page', () => {
    const pages = [makePage(1), makePage(2)];
    const req = buildGeminiRequest('prompt', pages, () => 'DATA');
    const parts = ((req['contents'] as unknown[])[0] as Record<string, unknown[]>)['parts'];
    // 1 text + 2 images = 3 parts
    expect(parts).toHaveLength(3);
    expect((parts[1] as Record<string, unknown>)['inline_data']).toBeDefined();
    expect((parts[2] as Record<string, unknown>)['inline_data']).toBeDefined();
  });

  it('sets responseMimeType to application/json', () => {
    const req = buildGeminiRequest('p', [makePage(1)], () => 'D');
    const gc = req['generationConfig'] as Record<string, unknown>;
    expect(gc['responseMimeType']).toBe('application/json');
  });

  it('calls encodeFn for each page image path', () => {
    const encodeFn = jest.fn(() => 'ENC');
    const pages = [makePage(1), makePage(3)];
    buildGeminiRequest('p', pages, encodeFn);
    expect(encodeFn).toHaveBeenCalledTimes(2);
    expect(encodeFn).toHaveBeenCalledWith('/tmp/src_0000_exam_page_1.png');
    expect(encodeFn).toHaveBeenCalledWith('/tmp/src_0000_exam_page_3.png');
  });
});

describe('buildGeminiSegmentationSchema', () => {
  it('requires configured boolean fields when provided', () => {
    const schema = buildGeminiSegmentationSchema({
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
    });
    const targets = ((schema['properties'] as Record<string, unknown>)['targets'] as Record<string, unknown>);
    const item = (targets['items'] as Record<string, unknown>);
    const required = item['required'] as string[];
    const properties = item['properties'] as Record<string, unknown>;
    const extraction = properties['extraction_fields'] as Record<string, unknown>;

    expect(required).toContain('extraction_fields');
    expect((extraction['required'] as string[])).toContain('has_diagram');
  });

  it('includes question_number, question_text, sub_questions in schema', () => {
    const schema = buildGeminiSegmentationSchema();
    const targets = ((schema['properties'] as Record<string, unknown>)['targets'] as Record<string, unknown>);
    const item = (targets['items'] as Record<string, unknown>);
    const properties = item['properties'] as Record<string, unknown>;

    expect(properties['question_number']).toBeDefined();
    expect(properties['question_text']).toBeDefined();
    expect(properties['sub_questions']).toBeDefined();
  });

  it('does not include regions or finish_page_number in schema', () => {
    const schema = buildGeminiSegmentationSchema();
    const targets = ((schema['properties'] as Record<string, unknown>)['targets'] as Record<string, unknown>);
    const item = (targets['items'] as Record<string, unknown>);
    const properties = item['properties'] as Record<string, unknown>;

    expect(properties['regions']).toBeUndefined();
    expect(properties['finish_page_number']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// unwrapGeminiResponse
// ---------------------------------------------------------------------------

describe('unwrapGeminiResponse', () => {
  it('extracts and parses JSON from the first candidate text part', () => {
    const inner = { targets: [{ target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] }] };
    const envelope = makeGeminiEnvelope(inner);
    const result = unwrapGeminiResponse(envelope);
    expect(result).toEqual(inner);
  });

  it('throws when candidates array is missing', () => {
    expect(() => unwrapGeminiResponse({ other: 'x' })).toThrow('candidates');
  });

  it('throws when candidates is empty', () => {
    expect(() => unwrapGeminiResponse({ candidates: [] })).toThrow();
  });

  it('throws when text is not valid JSON', () => {
    const bad = {
      candidates: [{ content: { parts: [{ text: 'not json {' }] } }],
    };
    expect(() => unwrapGeminiResponse(bad)).toThrow('not valid JSON');
  });
});

// ---------------------------------------------------------------------------
// segmentPages (integration via mocked HTTP + encoder)
// ---------------------------------------------------------------------------

describe('segmentPages', () => {
  const RUN_ID = 'run_2024-01-15_abc12345';

  const mockInner = {
    targets: [
      { target_type: 'question', question_number: '1', question_text: 'What is X?', sub_questions: [] },
      {
        target_type: 'question',
        question_number: '2',
        question_text: 'Explain Y.',
        sub_questions: ['(a)', '(b)'],
        review_comment: 'Spans two pages',
      },
    ],
  };

  const mockHttpPost = jest.fn().mockResolvedValue(makeGeminiEnvelope(mockInner));
  const mockEncodeFn = jest.fn(() => 'FAKE_BASE64');

  beforeEach(() => {
    mockHttpPost.mockClear();
    mockEncodeFn.mockClear();
    mockHttpPost.mockResolvedValue(makeGeminiEnvelope(mockInner));
  });

  it('returns a normalized SegmentationResult', async () => {
    const pages = [makePage(1), makePage(2), makePage(3)];
    const result = await segmentPages(RUN_ID, pages, PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn);

    expect(result.run_id).toBe(RUN_ID);
    expect(result.targets).toHaveLength(2);
  });

  it('assigns sequential target_ids in reading order', async () => {
    const result = await segmentPages(
      RUN_ID, [makePage(1), makePage(2), makePage(3)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[1].target_id).toBe('q_0002');
  });

  it('propagates review_comment from raw response', async () => {
    const result = await segmentPages(
      RUN_ID, [makePage(1), makePage(2), makePage(3)], PROFILE, '', CONFIG,
      mockHttpPost, mockEncodeFn,
    );
    expect(result.targets[1].review_comment).toBe('Spans two pages');
  });

  it('calls httpPost with the Gemini endpoint URL containing the API key', async () => {
    await segmentPages(RUN_ID, [makePage(1)], PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn);
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
    const url = mockHttpPost.mock.calls[0][0] as string;
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('generateContent');
    expect(url).toContain('test-api-key');
  });

  it('calls encodeFn for each page', async () => {
    const pages = [makePage(1), makePage(2)];
    await segmentPages(RUN_ID, pages, PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn);
    expect(mockEncodeFn).toHaveBeenCalledTimes(2);
  });

  it('uses custom model when specified in config', async () => {
    const customConfig = { apiKey: 'key', model: 'gemini-1.5-pro' };
    await segmentPages(RUN_ID, [makePage(1)], PROFILE, '', customConfig, mockHttpPost, mockEncodeFn);
    const url = mockHttpPost.mock.calls[0][0] as string;
    expect(url).toContain('gemini-1.5-pro');
  });

  it('defaults to gemini-3.1-flash-lite-preview when model not specified', async () => {
    await segmentPages(RUN_ID, [makePage(1)], PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn);
    const url = mockHttpPost.mock.calls[0][0] as string;
    expect(url).toContain('gemini-3.1-flash-lite-preview');
  });

  it('throws when httpPost returns an invalid response shape', async () => {
    mockHttpPost.mockResolvedValueOnce({ bad: 'response' });
    await expect(
      segmentPages(RUN_ID, [makePage(1)], PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn),
    ).rejects.toThrow('candidates');
  });

  it('passes extraction field options into schema, prompt, and parser', async () => {
    mockHttpPost.mockResolvedValueOnce(makeGeminiEnvelope({
      targets: [{
        target_type: 'question',
        question_number: '1',
        question_text: 'Q1',
        sub_questions: [],
        extraction_fields: { has_diagram: true },
      }],
    }));

    const result = await segmentPages(
      RUN_ID,
      [makePage(1), makePage(2), makePage(3)],
      PROFILE,
      '',
      CONFIG,
      mockHttpPost,
      mockEncodeFn,
      {
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if diagram appears',
          type: 'boolean',
        }],
      },
    );

    const body = mockHttpPost.mock.calls[0][1] as Record<string, unknown>;
    const contents = body['contents'] as Record<string, unknown>[];
    const prompt = ((contents[0]['parts'] as Record<string, unknown>[])[0]['text']) as string;
    expect(prompt).toContain('has_diagram');
    expect(result.targets[0].extraction_fields).toEqual({ has_diagram: true });
  });

  it('surfaces httpPost errors', async () => {
    mockHttpPost.mockRejectedValueOnce(new Error('Network timeout'));
    await expect(
      segmentPages(RUN_ID, [makePage(1)], PROFILE, '', CONFIG, mockHttpPost, mockEncodeFn),
    ).rejects.toThrow('Network timeout');
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });
});
