/**
 * adapters/hint-annotation/gemini-hint-image-gen/__tests__/annotator.test.ts
 *
 * Unit tests for the Gemini image-generation hint annotator.
 *
 * Proves:
 *   - unwrapGeminiImageResponse parses camelCase responses (the shape Gemini
 *     actually returns on v1beta: `inlineData` / `mimeType`).
 *   - It also accepts snake_case (`inline_data` / `mime_type`) as a fallback.
 *   - It throws a helpful error when no image part is present, surfacing any
 *     text the model returned.
 */

import { unwrapGeminiImageResponse } from '../annotator';

function makePngBase64(): string {
  // Minimal valid-looking base64 payload; contents aren't decoded in tests.
  return Buffer.from('fake-png-bytes').toString('base64');
}

describe('unwrapGeminiImageResponse', () => {
  it('parses camelCase responses returned by Gemini v1beta', () => {
    const data = makePngBase64();
    const envelope = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'here is your image' },
              { inlineData: { mimeType: 'image/png', data } },
            ],
          },
        },
      ],
    };

    const result = unwrapGeminiImageResponse(envelope);

    expect(result.mimeType).toBe('image/png');
    expect(result.data.toString()).toBe('fake-png-bytes');
  });

  it('parses snake_case responses as a fallback', () => {
    const data = makePngBase64();
    const envelope = {
      candidates: [
        {
          content: {
            parts: [
              { inline_data: { mime_type: 'image/png', data } },
            ],
          },
        },
      ],
    };

    const result = unwrapGeminiImageResponse(envelope);

    expect(result.mimeType).toBe('image/png');
    expect(result.data.toString()).toBe('fake-png-bytes');
  });

  it('throws with the model text when no image part is present', () => {
    const envelope = {
      candidates: [
        {
          content: {
            parts: [{ text: 'I cannot generate that image.' }],
          },
        },
      ],
    };

    expect(() => unwrapGeminiImageResponse(envelope)).toThrow(
      /no image part.*I cannot generate that image/,
    );
  });

  it('throws when the response envelope is malformed', () => {
    expect(() => unwrapGeminiImageResponse({})).toThrow(/candidates/);
    expect(() => unwrapGeminiImageResponse({ candidates: [{}] })).toThrow(
      /content\.parts/,
    );
  });
});
