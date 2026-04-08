/**
 * core/output-composer/__tests__/composer.test.ts
 *
 * Proves (TASK-401 acceptance bar):
 *   - 1-region passthrough: imageStacker is NOT called; localOutputPath is
 *     the single crop file path; outputFileName is its basename.
 *   - 2-region composition: imageStacker IS called with
 *     (targetId, topPath, bottomPath) in reading order.
 *   - 0 regions: CompositionError thrown (INV-3 guard).
 *   - 3+ regions: CompositionError thrown (INV-3 guard — no silent 3+ support).
 *   - compositionMode other than 'top_to_bottom': CompositionError (INV-6 guard).
 *   - outputFileName equals path.basename(localOutputPath).
 *   - sourcePages and targetId are preserved from input.
 */

import { composeOutput } from '../composer';
import type { ImageStackerFn } from '../composer';
import type { ComposerInput } from '../types';
import { CompositionError } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<ComposerInput> = {}): ComposerInput {
  return {
    targetId: 'q_0001',
    sourcePages: [1],
    regions: [{ page_number: 1, cropFilePath: '/tmp/crops/q_0001_r0.png' }],
    compositionMode: 'top_to_bottom',
    ...overrides,
  };
}

// Stacker that must not be called — will throw if invoked.
function forbiddenStacker(): ImageStackerFn {
  return jest.fn<Promise<string>, [string, string, string]>().mockRejectedValue(
    new Error('imageStacker must not be called in this test'),
  );
}

// ---------------------------------------------------------------------------
// 1-region passthrough
// ---------------------------------------------------------------------------

describe('composeOutput — 1-region passthrough', () => {
  it('does not call imageStacker', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    await composeOutput(makeInput(), stacker);
    expect(stacker).not.toHaveBeenCalled();
  });

  it('returns the crop file path as localOutputPath', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const result = await composeOutput(makeInput(), stacker);
    expect(result.localOutputPath).toBe('/tmp/crops/q_0001_r0.png');
  });

  it('sets outputFileName to the basename of the crop file', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const result = await composeOutput(makeInput(), stacker);
    expect(result.outputFileName).toBe('q_0001_r0.png');
  });

  it('preserves targetId and sourcePages', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>();
    const input = makeInput({ targetId: 'q_0042', sourcePages: [3] });
    const result = await composeOutput(input, stacker);
    expect(result.targetId).toBe('q_0042');
    expect(result.sourcePages).toEqual([3]);
  });
});

// ---------------------------------------------------------------------------
// 2-region top-to-bottom composition
// ---------------------------------------------------------------------------

describe('composeOutput — 2-region top-to-bottom composition', () => {
  it('calls imageStacker with (targetId, topPath, bottomPath) in reading order', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async () => '/tmp/output/q_0001.png',
    );
    const input = makeInput({
      regions: [
        { page_number: 1, cropFilePath: '/tmp/crops/q_0001_r0.png' },
        { page_number: 2, cropFilePath: '/tmp/crops/q_0001_r1.png' },
      ],
      sourcePages: [1, 2],
    });

    await composeOutput(input, stacker);

    expect(stacker).toHaveBeenCalledTimes(1);
    expect(stacker).toHaveBeenCalledWith(
      'q_0001',
      '/tmp/crops/q_0001_r0.png',
      '/tmp/crops/q_0001_r1.png',
    );
  });

  it('returns the stacker output path as localOutputPath', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async () => '/tmp/output/q_0001.png',
    );
    const input = makeInput({
      regions: [
        { page_number: 1, cropFilePath: '/tmp/crops/r0.png' },
        { page_number: 2, cropFilePath: '/tmp/crops/r1.png' },
      ],
    });

    const result = await composeOutput(input, stacker);

    expect(result.localOutputPath).toBe('/tmp/output/q_0001.png');
    expect(result.outputFileName).toBe('q_0001.png');
  });

  it('preserves targetId and sourcePages from input', async () => {
    const stacker = jest.fn<Promise<string>, [string, string, string]>(
      async () => '/tmp/output/q_0002.png',
    );
    const input = makeInput({
      targetId: 'q_0002',
      sourcePages: [1, 2],
      regions: [
        { page_number: 1, cropFilePath: '/tmp/crops/r0.png' },
        { page_number: 2, cropFilePath: '/tmp/crops/r1.png' },
      ],
    });

    const result = await composeOutput(input, stacker);

    expect(result.targetId).toBe('q_0002');
    expect(result.sourcePages).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// INV-3 guard: reject 0 and 3+ regions
// ---------------------------------------------------------------------------

describe('composeOutput — INV-3: region count guard', () => {
  it('throws CompositionError for 0 regions', async () => {
    const input = makeInput({ regions: [] });
    await expect(composeOutput(input, forbiddenStacker())).rejects.toMatchObject({
      code: 'COMPOSITION_FAILED',
    });
  });

  it('throws CompositionError for 3 regions (no silent 3+ support)', async () => {
    const input = makeInput({
      regions: [
        { page_number: 1, cropFilePath: '/tmp/r0.png' },
        { page_number: 2, cropFilePath: '/tmp/r1.png' },
        { page_number: 3, cropFilePath: '/tmp/r2.png' },
      ],
    });
    await expect(composeOutput(input, forbiddenStacker())).rejects.toMatchObject({
      code: 'COMPOSITION_FAILED',
    });
  });

  it('error message for 3 regions names the count', async () => {
    const input = makeInput({
      regions: [
        { page_number: 1, cropFilePath: '/tmp/r0.png' },
        { page_number: 2, cropFilePath: '/tmp/r1.png' },
        { page_number: 3, cropFilePath: '/tmp/r2.png' },
      ],
    });
    let err: CompositionError | undefined;
    try {
      await composeOutput(input, forbiddenStacker());
    } catch (e) {
      err = e as CompositionError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain('3');
    expect(err!.targetId).toBe('q_0001');
  });
});

// ---------------------------------------------------------------------------
// INV-6 guard: only top_to_bottom is valid
// ---------------------------------------------------------------------------

describe('composeOutput — INV-6: composition mode guard', () => {
  it('throws CompositionError for unsupported composition_mode', async () => {
    // Cast through unknown to bypass TS narrowing so the runtime guard is tested.
    const input = makeInput({
      compositionMode: 'side_by_side' as unknown as 'top_to_bottom',
    });
    await expect(composeOutput(input, forbiddenStacker())).rejects.toMatchObject({
      code: 'COMPOSITION_FAILED',
    });
  });

  it('error message names the unsupported mode', async () => {
    const input = makeInput({
      compositionMode: 'side_by_side' as unknown as 'top_to_bottom',
    });
    let err: CompositionError | undefined;
    try {
      await composeOutput(input, forbiddenStacker());
    } catch (e) {
      err = e as CompositionError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain('side_by_side');
  });
});
