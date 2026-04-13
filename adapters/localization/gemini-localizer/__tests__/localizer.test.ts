/**
 * adapters/localization/gemini-localizer/__tests__/localizer.test.ts
 *
 * Unit tests for the Gemini localization adapter (localizeWindow).
 *
 * Proves:
 *   - Correct Gemini API call shape (URL, request body, auth header).
 *   - Response unwrapping and parsing pipeline.
 *   - HTTP errors propagate cleanly.
 *   - Repair retry on bbox validation error.
 *   - buildGeminiLocalizationRequest structure.
 *   - unwrapGeminiLocalizationResponse envelope parsing.
 */

import {
  localizeWindow,
  buildGeminiLocalizationRequest,
  unwrapGeminiLocalizationResponse,
} from '../localizer';
import type { GeminiLocalizerConfig, HttpPostFn } from '../types';
import type { SegmentationTarget } from '../../../../core/segmentation-contract/types';
import type { PreparedPageImage } from '../../../../core/source-model/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG: GeminiLocalizerConfig = { apiKey: 'test-key-abc', model: 'gemini-test' };

function makeQuestion(qn: string): SegmentationTarget {
  return {
    target_id: `q_${qn.padStart(4, '0')}`,
    target_type: 'question',
    question_number: qn,
    question_text: `Question ${qn} text`,
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

function makeGeminiEnvelope(jsonText: string): unknown {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: jsonText }],
        },
      },
    ],
  };
}

function makeValidWindowJson(): string {
  return JSON.stringify({
    targets: [
      { question_number: '1', image_position: 1, bbox_1000: [100, 50, 800, 950] },
    ],
  });
}

const PROFILE = {
  target_type: 'question' as const,
  max_regions_per_target: 2,
  composition_mode: 'top_to_bottom' as const,
};

// ---------------------------------------------------------------------------
// buildGeminiLocalizationRequest
// ---------------------------------------------------------------------------

describe('buildGeminiLocalizationRequest', () => {
  it('includes text prompt as first content part', () => {
    const pages = [makePage(1)];
    const encodeFn = () => 'base64data';
    const body = buildGeminiLocalizationRequest('Test prompt', pages, encodeFn);
    const contents = (body as Record<string, unknown>)['contents'] as unknown[];
    const parts = (contents[0] as Record<string, unknown>)['parts'] as unknown[];
    expect((parts[0] as Record<string, unknown>)['text']).toBe('Test prompt');
  });

  it('includes one inlineData part per page', () => {
    const pages = [makePage(1), makePage(2)];
    const encodeFn = (path: string) => `b64_${path}`;
    const body = buildGeminiLocalizationRequest('Prompt', pages, encodeFn);
    const contents = (body as Record<string, unknown>)['contents'] as unknown[];
    const parts = (contents[0] as Record<string, unknown>)['parts'] as unknown[];
    // text + 2 images = 3 parts
    expect(parts).toHaveLength(3);
    const imagePart = parts[1] as Record<string, unknown>;
    expect((imagePart['inline_data'] as Record<string, unknown>)['mime_type']).toBe('image/png');
  });

  it('sets responseMimeType to application/json', () => {
    const body = buildGeminiLocalizationRequest('Prompt', [makePage(1)], () => 'b64');
    const genConfig = (body as Record<string, unknown>)['generationConfig'] as Record<string, unknown>;
    expect(genConfig['responseMimeType']).toBe('application/json');
  });

  it('includes responseSchema in generationConfig', () => {
    const body = buildGeminiLocalizationRequest('Prompt', [makePage(1)], () => 'b64');
    const genConfig = (body as Record<string, unknown>)['generationConfig'] as Record<string, unknown>;
    expect(genConfig['responseSchema']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// unwrapGeminiLocalizationResponse
// ---------------------------------------------------------------------------

describe('unwrapGeminiLocalizationResponse', () => {
  it('parses valid JSON text from the response envelope', () => {
    const payload = { targets: [{ question_number: '1', image_position: 1, bbox_1000: [0, 0, 500, 1000] }] };
    const envelope = makeGeminiEnvelope(JSON.stringify(payload));
    const result = unwrapGeminiLocalizationResponse(envelope);
    expect(result).toEqual(payload);
  });

  it('throws when candidates array is missing', () => {
    expect(() => unwrapGeminiLocalizationResponse({ other: 'field' })).toThrow('candidates');
  });

  it('throws when content.parts are missing', () => {
    const bad = { candidates: [{ content: {} }] };
    expect(() => unwrapGeminiLocalizationResponse(bad)).toThrow();
  });

  it('throws when first part is not a text string', () => {
    const bad = { candidates: [{ content: { parts: [{ inline_data: {} }] } }] };
    expect(() => unwrapGeminiLocalizationResponse(bad)).toThrow();
  });

  it('throws when text is not valid JSON', () => {
    const bad = makeGeminiEnvelope('not json {{{');
    expect(() => unwrapGeminiLocalizationResponse(bad)).toThrow('not valid JSON');
  });
});

// ---------------------------------------------------------------------------
// localizeWindow — happy path
// ---------------------------------------------------------------------------

describe('localizeWindow', () => {
  it('calls the API with the correct URL including model and key', async () => {
    let capturedUrl = '';
    const httpPost: HttpPostFn = async (url) => {
      capturedUrl = url;
      return makeGeminiEnvelope(makeValidWindowJson());
    };

    await localizeWindow(
      'run_test',
      [makeQuestion('1')],
      [makePage(1), makePage(2), makePage(3)],
      PROFILE,
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(capturedUrl).toContain('gemini-test');
    expect(capturedUrl).toContain('test-key-abc');
    expect(capturedUrl).toContain('generateContent');
  });

  it('returns a WindowLocalizationResult on success', async () => {
    const httpPost: HttpPostFn = async () =>
      makeGeminiEnvelope(makeValidWindowJson());

    const result = await localizeWindow(
      'run_001',
      [makeQuestion('1')],
      [makePage(1), makePage(2), makePage(3)],
      PROFILE,
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(result.run_id).toBe('run_001');
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].question_number).toBe('1');
    expect(result.regions[0].page_number).toBe(1);
    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('propagates HTTP errors cleanly', async () => {
    const httpPost: HttpPostFn = async () => {
      throw new Error('Gemini API error: HTTP 500');
    };

    await expect(
      localizeWindow(
        'run_err',
        [makeQuestion('1')],
        [makePage(1)],
        PROFILE,
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toThrow('HTTP 500');
  });

  it('rejects malformed Gemini response (no candidates)', async () => {
    const httpPost: HttpPostFn = async () => ({ no_candidates: true });

    await expect(
      localizeWindow(
        'run_bad',
        [makeQuestion('1')],
        [makePage(1)],
        PROFILE,
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toThrow();
  });

  it('defaults model to gemini-3.1-flash-lite-preview when not specified', async () => {
    let capturedUrl = '';
    const httpPost: HttpPostFn = async (url) => {
      capturedUrl = url;
      return makeGeminiEnvelope(makeValidWindowJson());
    };

    await localizeWindow(
      'run_default',
      [makeQuestion('1')],
      [makePage(1)],
      PROFILE,
      '',
      { apiKey: 'key123' },
      httpPost,
      () => 'b64',
    );

    expect(capturedUrl).toContain('gemini-3.1-flash-lite-preview');
  });
});

// ---------------------------------------------------------------------------
// localizeWindow — repair retry on bbox error
// ---------------------------------------------------------------------------

describe('localizeWindow — repair retries', () => {
  it('retries once with a correction prompt when Gemini returns an invalid bbox', async () => {
    const responses = [
      // First response: inverted y bbox
      JSON.stringify({
        targets: [{ question_number: '1', image_position: 1, bbox_1000: [800, 50, 100, 950] }],
      }),
      // Second response: valid
      makeValidWindowJson(),
    ];
    const capturedPrompts: string[] = [];
    const httpPost: HttpPostFn = async (_url, body) => {
      const contents = ((body as Record<string, unknown>)['contents'] as unknown[]);
      const parts = ((contents[0] as Record<string, unknown>)['parts'] as unknown[]);
      capturedPrompts.push((parts[0] as Record<string, unknown>)['text'] as string);
      return makeGeminiEnvelope(responses.shift()!);
    };

    const result = await localizeWindow(
      'run_retry',
      [makeQuestion('1')],
      [makePage(1), makePage(2), makePage(3)],
      PROFILE,
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[1]).toContain('Correction Required');
    expect(capturedPrompts[1]).toContain('y_min');
    expect(capturedPrompts[1]).toContain('bbox_1000');
  });

  it('allows two correction retries before failing', async () => {
    const invalidJson = JSON.stringify({
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [800, 50, 100, 950] }],
    });
    let callCount = 0;
    const httpPost: HttpPostFn = async () => {
      callCount += 1;
      return makeGeminiEnvelope(invalidJson);
    };

    await expect(
      localizeWindow(
        'run_retry_bad',
        [makeQuestion('1')],
        [makePage(1)],
        PROFILE,
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toMatchObject({
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: expect.stringContaining('after 2 retries'),
    });
    expect(callCount).toBe(3); // initial + 2 retries
  });

  it('succeeds on second retry when third attempt is valid', async () => {
    const responses = [
      JSON.stringify({
        targets: [{ question_number: '1', image_position: 1, bbox_1000: [800, 50, 100, 950] }],
      }),
      JSON.stringify({
        targets: [{ question_number: '1', image_position: 1, bbox_1000: [800, 50, 100, 950] }],
      }),
      makeValidWindowJson(),
    ];
    const httpPost: HttpPostFn = async () => makeGeminiEnvelope(responses.shift()!);

    const result = await localizeWindow(
      'run_retry_twice',
      [makeQuestion('1')],
      [makePage(1)],
      PROFILE,
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });
});
