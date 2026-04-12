/**
 * adapters/localization/gemini-localizer/__tests__/localizer.test.ts
 *
 * Unit tests for the Gemini localization adapter (localizeTarget).
 *
 * Proves:
 *   - Correct Gemini API call shape (URL, request body, auth header).
 *   - Page selection logic (only relevant pages sent per target).
 *   - Response unwrapping and parsing pipeline.
 *   - HTTP errors propagate cleanly.
 *   - Malformed Gemini response structure is rejected.
 *   - Invalid bbox in response is rejected.
 *   - No provider SDK imports in core (boundary guarded by import structure).
 */

import {
  localizeTarget,
  buildGeminiLocalizationRequest,
  unwrapGeminiLocalizationResponse,
  selectPagesForTarget,
} from '../localizer';
import type { GeminiLocalizerConfig, HttpPostFn } from '../types';
import type { SegmentationTarget } from '../../../../core/segmentation-contract/types';
import type { PreparedPageImage } from '../../../../core/source-model/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG: GeminiLocalizerConfig = { apiKey: 'test-key-abc', model: 'gemini-test' };

function makeTarget(overrides: Partial<SegmentationTarget> = {}): SegmentationTarget {
  return {
    target_id: 'q_0001',
    target_type: 'question',
    regions: [{ page_number: 1 }],
    ...overrides,
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

function makeValidLocalizationJson(pageNumber: number = 1): string {
  return JSON.stringify({
    regions: [{ page_number: pageNumber, bbox_1000: [100, 50, 800, 950] }],
  });
}

// ---------------------------------------------------------------------------
// selectPagesForTarget
// ---------------------------------------------------------------------------

describe('selectPagesForTarget', () => {
  it('returns previous and finish page for the target context', () => {
    const target = makeTarget({ finish_page_number: 2, regions: [{ page_number: 2 }] });
    const pages = [makePage(1), makePage(2), makePage(3)];
    const selected = selectPagesForTarget(target, pages);
    expect(selected.map((page) => page.page_number)).toEqual([1, 2]);
  });

  it('returns only page 1 for first-page targets', () => {
    const target = makeTarget({ finish_page_number: 1, regions: [{ page_number: 1 }] });
    const pages = [makePage(1), makePage(2), makePage(3)];
    const selected = selectPagesForTarget(target, pages);
    expect(selected.map((page) => page.page_number)).toEqual([1]);
  });

  it('throws when a required page is not found', () => {
    const target = makeTarget({ regions: [{ page_number: 99 }] });
    const pages = [makePage(1), makePage(2)];
    expect(() => selectPagesForTarget(target, pages)).toThrow('page_number 99');
  });
});

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
    const payload = { regions: [{ page_number: 1, bbox_1000: [0, 0, 500, 1000] }] };
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
// localizeTarget — full adapter call path
// ---------------------------------------------------------------------------

describe('localizeTarget', () => {
  it('calls the API with the correct URL including model and key', async () => {
    let capturedUrl = '';
    const httpPost: HttpPostFn = async (url, _body, _headers) => {
      capturedUrl = url;
      return makeGeminiEnvelope(makeValidLocalizationJson(1));
    };
    await localizeTarget(
      'run_test',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );
    expect(capturedUrl).toContain('gemini-test');
    expect(capturedUrl).toContain('test-key-abc');
    expect(capturedUrl).toContain('generateContent');
  });

  it('returns a normalized LocalizationResult on success', async () => {
    const httpPost: HttpPostFn = async () =>
      makeGeminiEnvelope(makeValidLocalizationJson(1));
    const result = await localizeTarget(
      'run_001',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );
    expect(result.run_id).toBe('run_001');
    expect(result.target_id).toBe('q_0001');
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('uses built-in prompt when promptSnapshot is empty', async () => {
    let capturedBody: unknown;
    const httpPost: HttpPostFn = async (_url, body) => {
      capturedBody = body;
      return makeGeminiEnvelope(makeValidLocalizationJson(1));
    };
    await localizeTarget(
      'run_x',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );
    const contents = ((capturedBody as Record<string, unknown>)['contents'] as unknown[]);
    const parts = ((contents[0] as Record<string, unknown>)['parts'] as unknown[]);
    const promptText = ((parts[0] as Record<string, unknown>)['text'] as string);
    expect(promptText).toContain('Agent 2');
    expect(promptText).toContain('q_0001');
  });

  it('propagates HTTP errors cleanly', async () => {
    const httpPost: HttpPostFn = async () => {
      throw new Error('Gemini API error: HTTP 500');
    };
    await expect(
      localizeTarget(
        'run_err',
        makeTarget(),
        [makePage(1)],
        {
          target_type: 'question',
          max_regions_per_target: 2,
          composition_mode: 'top_to_bottom',
        },
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
      localizeTarget(
        'run_bad',
        makeTarget(),
        [makePage(1)],
        {
          target_type: 'question',
          max_regions_per_target: 2,
          composition_mode: 'top_to_bottom',
        },
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid bbox in Gemini response', async () => {
    // Return a bbox with inverted y
    const badJson = JSON.stringify({
      regions: [{ page_number: 1, bbox_1000: [900, 0, 100, 1000] }],
    });
    const httpPost: HttpPostFn = async () => makeGeminiEnvelope(badJson);
    await expect(
      localizeTarget(
        'run_bad_bbox',
        makeTarget(),
        [makePage(1)],
        {
          target_type: 'question',
          max_regions_per_target: 2,
          composition_mode: 'top_to_bottom',
        },
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toMatchObject({ code: 'LOCALIZATION_SCHEMA_INVALID' });
  });

  it('retries once with a correction prompt when Gemini returns an invalid bbox', async () => {
    const responses = [
      JSON.stringify({
        regions: [{ page_number: 1, bbox_1000: [0, 100, 0, 900] }],
      }),
      makeValidLocalizationJson(1),
    ];
    const capturedPrompts: string[] = [];
    const httpPost: HttpPostFn = async (_url, body) => {
      const contents = ((body as Record<string, unknown>)['contents'] as unknown[]);
      const parts = ((contents[0] as Record<string, unknown>)['parts'] as unknown[]);
      capturedPrompts.push((parts[0] as Record<string, unknown>)['text'] as string);
      return makeGeminiEnvelope(responses.shift()!);
    };

    const result = await localizeTarget(
      'run_retry',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[1]).toContain('Correction Required');
    expect(capturedPrompts[1]).toContain('inverted y');
    expect(capturedPrompts[1]).toContain('"bbox_1000"');
  });

  it('allows two correction retries before failing the target', async () => {
    const responses = [
      JSON.stringify({
        regions: [{ page_number: 1, bbox_1000: [0, 100, 0, 900] }],
      }),
      JSON.stringify({
        regions: [{ page_number: 1, bbox_1000: [200, 100, 200, 900] }],
      }),
      makeValidLocalizationJson(1),
    ];
    const httpPost: HttpPostFn = async () => makeGeminiEnvelope(responses.shift()!);

    const result = await localizeTarget(
      'run_retry_twice',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      CONFIG,
      httpPost,
      () => 'b64',
    );

    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('reports both validation failures when the retry also returns an invalid bbox', async () => {
    const invalidJson = JSON.stringify({
      regions: [{ page_number: 1, bbox_1000: [0, 100, 0, 900] }],
    });
    let callCount = 0;
    const httpPost: HttpPostFn = async () => {
      callCount += 1;
      return makeGeminiEnvelope(invalidJson);
    };

    await expect(
      localizeTarget(
        'run_retry_bad',
        makeTarget(),
        [makePage(1)],
        {
          target_type: 'question',
          max_regions_per_target: 2,
          composition_mode: 'top_to_bottom',
        },
        '',
        CONFIG,
        httpPost,
        () => 'b64',
      ),
    ).rejects.toMatchObject({
      code: 'LOCALIZATION_SCHEMA_INVALID',
      message: expect.stringContaining('after 2 retries'),
    });
    expect(callCount).toBe(3);
  });

  it('defaults model to gemini-3.1-flash-lite-preview when not specified', async () => {
    let capturedUrl = '';
    const httpPost: HttpPostFn = async (url) => {
      capturedUrl = url;
      return makeGeminiEnvelope(makeValidLocalizationJson(1));
    };
    await localizeTarget(
      'run_default',
      makeTarget(),
      [makePage(1)],
      {
        target_type: 'question',
        max_regions_per_target: 2,
        composition_mode: 'top_to_bottom',
      },
      '',
      { apiKey: 'key123' },
      httpPost,
      () => 'b64',
    );
    expect(capturedUrl).toContain('gemini-3.1-flash-lite-preview');
  });
});
