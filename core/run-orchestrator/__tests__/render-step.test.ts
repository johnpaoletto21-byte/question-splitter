/**
 * Unit tests for core/run-orchestrator/render-step.ts
 *
 * Validates that renderAllSources correctly:
 *   - calls the injected renderer for each source in order
 *   - accumulates pages from all sources
 *   - validates the combined page list (via core/source-model)
 *   - returns a RunContext with preparedPages populated
 *   - re-throws renderer errors without wrapping
 *
 * The renderer is a jest.fn() mock — no real PDF I/O in these tests.
 * Real PDF rendering is tested in adapters/source-preparation/pdf-renderer/__tests__.
 */

import { renderAllSources } from '../render-step';
import type { RunContext } from '../types';
import { V1_ACTIVE_PROFILE } from '../../crop-target-profile/profile';
import type { PreparedPageImage } from '../../source-model/types';
import { PreparedPageValidationError } from '../../source-model/types';

// ── Shared fixtures ────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  GEMINI_API_KEY: 'key',
  DRIVE_FOLDER_ID: 'folder',
  OAUTH_TOKEN_PATH: '/token.json',
  OUTPUT_DIR: '/tmp/output',
};

function makeContext(sourceCount: number): RunContext {
  const sources = Array.from({ length: sourceCount }, (_, i) => ({
    source_id: `src_${String(i).padStart(4, '0')}_test`,
    file_path: `/pdfs/test${i}.pdf`,
    file_name: `test${i}.pdf`,
    input_order: i,
  }));
  return {
    run_id: 'run_test_0001',
    sources,
    config: MOCK_CONFIG,
    activeProfile: V1_ACTIVE_PROFILE,
    promptSnapshot: {
      agent1Prompt: '',
      reviewerPrompt: '',
      agent2Prompt: '',
      deduplicatorPrompt: '',
      capturedAt: '2026-01-01T00:00:00.000Z',
    },
    started_at: '2026-01-01T00:00:00.000Z',
  };
}

function makePage(sourceId: string, pageNum: number): PreparedPageImage {
  return {
    source_id: sourceId,
    page_number: pageNum,
    image_path: `/tmp/output/${sourceId}_page_${String(pageNum).padStart(4, '0')}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('renderAllSources', () => {
  // ── basic accumulation ───────────────────────────────────────────────

  it('calls renderer once per source', async () => {
    const ctx = makeContext(3);
    const renderer = jest.fn().mockImplementation(async (src) => [
      makePage(src.source_id, 1),
    ]);

    await renderAllSources(ctx, renderer);

    expect(renderer).toHaveBeenCalledTimes(3);
  });

  it('calls renderer with source and OUTPUT_DIR from config', async () => {
    const ctx = makeContext(1);
    const renderer = jest.fn().mockResolvedValue([
      makePage(ctx.sources[0].source_id, 1),
    ]);

    await renderAllSources(ctx, renderer);

    expect(renderer).toHaveBeenCalledWith(ctx.sources[0], '/tmp/output');
  });

  it('accumulates pages from all sources in call order', async () => {
    const ctx = makeContext(2);
    const renderer = jest.fn().mockImplementation(async (src) => [
      makePage(src.source_id, 1),
      makePage(src.source_id, 2),
    ]);

    const result = await renderAllSources(ctx, renderer);

    expect(result.preparedPages).toHaveLength(4);
    expect(result.preparedPages[0].source_id).toBe('src_0000_test');
    expect(result.preparedPages[2].source_id).toBe('src_0001_test');
  });

  // ── returned context ─────────────────────────────────────────────────

  it('returns all original context fields plus preparedPages', async () => {
    const ctx = makeContext(1);
    const renderer = jest.fn().mockResolvedValue([
      makePage(ctx.sources[0].source_id, 1),
    ]);

    const result = await renderAllSources(ctx, renderer);

    expect(result.run_id).toBe(ctx.run_id);
    expect(result.sources).toBe(ctx.sources);
    expect(result.config).toBe(ctx.config);
    expect(result.started_at).toBe(ctx.started_at);
    expect(Array.isArray(result.preparedPages)).toBe(true);
  });

  it('does not mutate the input context object', async () => {
    const ctx = makeContext(1);
    const renderer = jest.fn().mockResolvedValue([
      makePage(ctx.sources[0].source_id, 1),
    ]);

    await renderAllSources(ctx, renderer);

    // The original RunContext object must not be mutated.
    expect((ctx as RunContext).preparedPages).toBeUndefined();
  });

  // ── source ordering ───────────────────────────────────────────────────

  it('processes sources in their input_order (index) order', async () => {
    const ctx = makeContext(3);
    const callOrder: string[] = [];
    const renderer = jest.fn().mockImplementation(async (src) => {
      callOrder.push(src.source_id);
      return [makePage(src.source_id, 1)];
    });

    await renderAllSources(ctx, renderer);

    expect(callOrder).toEqual([
      'src_0000_test',
      'src_0001_test',
      'src_0002_test',
    ]);
  });

  // ── validation gate ───────────────────────────────────────────────────

  it('throws PreparedPageValidationError when renderer returns empty list', async () => {
    const ctx = makeContext(1);
    const renderer = jest.fn().mockResolvedValue([]);

    await expect(renderAllSources(ctx, renderer)).rejects.toThrow(
      PreparedPageValidationError,
    );
  });

  it('re-throws renderer errors without additional wrapping', async () => {
    const ctx = makeContext(1);
    const rendererError = new Error('PDF parse failed');
    const renderer = jest.fn().mockRejectedValue(rendererError);

    await expect(renderAllSources(ctx, renderer)).rejects.toBe(rendererError);
  });
});
