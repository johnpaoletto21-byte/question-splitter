import { bootstrapRun } from '../bootstrap';
import { RunBootstrapError, RunRequest } from '../types';
import { LocalConfig } from '../../../adapters/config/local-config/types';

const MOCK_CONFIG: LocalConfig = {
  GEMINI_API_KEY: 'test-key',
  DRIVE_FOLDER_ID: 'test-folder',
  OAUTH_TOKEN_PATH: '/tmp/token.json',
  OUTPUT_DIR: '/tmp/output',
};

function makeRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    pdfFilePaths: ['/docs/exam_a.pdf', '/docs/exam_b.pdf'],
    config: MOCK_CONFIG,
    ...overrides,
  };
}

describe('bootstrapRun — run context creation', () => {
  it('returns a RunContext with a non-empty run_id', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.run_id).toBeTruthy();
    expect(ctx.run_id).toMatch(/^run_/);
  });

  it('captures a started_at ISO timestamp', () => {
    const before = new Date().toISOString();
    const ctx = bootstrapRun(makeRequest());
    const after = new Date().toISOString();
    expect(ctx.started_at >= before).toBe(true);
    expect(ctx.started_at <= after).toBe(true);
  });

  it('passes through config reference', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.config).toBe(MOCK_CONFIG);
  });

  it('passes through run_label when provided', () => {
    const ctx = bootstrapRun(makeRequest({ runLabel: 'Exam 2024-Q1' }));
    expect(ctx.run_label).toBe('Exam 2024-Q1');
  });

  it('run_label is undefined when not provided', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.run_label).toBeUndefined();
  });
});

describe('bootstrapRun — PDF source ordering', () => {
  it('preserves input file order exactly (A before B)', () => {
    const ctx = bootstrapRun(
      makeRequest({ pdfFilePaths: ['/docs/exam_a.pdf', '/docs/exam_b.pdf'] })
    );
    expect(ctx.sources[0].file_path).toBe('/docs/exam_a.pdf');
    expect(ctx.sources[1].file_path).toBe('/docs/exam_b.pdf');
  });

  it('preserves input file order even when filenames sort differently (C before A)', () => {
    const ctx = bootstrapRun(
      makeRequest({
        pdfFilePaths: ['/docs/exam_c.pdf', '/docs/exam_a.pdf', '/docs/exam_b.pdf'],
      })
    );
    expect(ctx.sources[0].file_path).toBe('/docs/exam_c.pdf');
    expect(ctx.sources[1].file_path).toBe('/docs/exam_a.pdf');
    expect(ctx.sources[2].file_path).toBe('/docs/exam_b.pdf');
  });

  it('assigns input_order values matching array indices (0-based)', () => {
    const ctx = bootstrapRun(
      makeRequest({ pdfFilePaths: ['/docs/p1.pdf', '/docs/p2.pdf', '/docs/p3.pdf'] })
    );
    expect(ctx.sources[0].input_order).toBe(0);
    expect(ctx.sources[1].input_order).toBe(1);
    expect(ctx.sources[2].input_order).toBe(2);
  });

  it('assigns stable source_ids that embed the index for traceability', () => {
    const ctx = bootstrapRun(
      makeRequest({ pdfFilePaths: ['/docs/exam_a.pdf', '/docs/exam_b.pdf'] })
    );
    expect(ctx.sources[0].source_id).toMatch(/^src_0000_/);
    expect(ctx.sources[1].source_id).toMatch(/^src_0001_/);
  });

  it('file_name is the basename of the file_path', () => {
    const ctx = bootstrapRun(
      makeRequest({ pdfFilePaths: ['/docs/subfolder/exam_a.pdf'] })
    );
    expect(ctx.sources[0].file_name).toBe('exam_a.pdf');
  });

  it('single PDF produces one source entry', () => {
    const ctx = bootstrapRun(makeRequest({ pdfFilePaths: ['/docs/solo.pdf'] }));
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].source_id).toMatch(/^src_0000_/);
  });
});

describe('bootstrapRun — validation / fail-fast', () => {
  it('throws RunBootstrapError for empty pdfFilePaths array', () => {
    expect(() => bootstrapRun(makeRequest({ pdfFilePaths: [] }))).toThrow(
      RunBootstrapError
    );
  });

  it('throws RunBootstrapError when pdfFilePaths contains an empty string', () => {
    expect(() =>
      bootstrapRun(makeRequest({ pdfFilePaths: ['/valid.pdf', ''] }))
    ).toThrow(RunBootstrapError);
  });

  it('throws RunBootstrapError when pdfFilePaths contains a whitespace-only string', () => {
    expect(() =>
      bootstrapRun(makeRequest({ pdfFilePaths: ['   '] }))
    ).toThrow(RunBootstrapError);
  });

  it('error code is RUN_BOOTSTRAP_INVALID', () => {
    try {
      bootstrapRun(makeRequest({ pdfFilePaths: [] }));
    } catch (err) {
      expect(err).toBeInstanceOf(RunBootstrapError);
      expect((err as RunBootstrapError).code).toBe('RUN_BOOTSTRAP_INVALID');
    }
  });
});

describe('bootstrapRun — run_id uniqueness', () => {
  it('generates different run_ids for two consecutive calls', () => {
    const ctx1 = bootstrapRun(makeRequest());
    const ctx2 = bootstrapRun(makeRequest());
    expect(ctx1.run_id).not.toBe(ctx2.run_id);
  });
});
