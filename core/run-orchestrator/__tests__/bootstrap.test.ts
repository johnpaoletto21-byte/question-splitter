import { bootstrapRun } from '../bootstrap';
import { RunBootstrapError, RunRequest } from '../types';
import { V1_ACTIVE_PROFILE } from '../../crop-target-profile/profile';
import { LocalConfig } from '../../../adapters/config/local-config/types';
import { resetPromptConfig, setAgent1Prompt, setAgent2Prompt } from '../../prompt-config-store/store';
import { DEFAULT_AGENT1_PROMPT, DEFAULT_AGENT2_PROMPT } from '../../prompt-config-store/default-prompts';

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

  it('uses a caller-supplied promptSnapshot when provided', () => {
    const promptSnapshot = {
      agent1Prompt: 'provided agent 1',
      reviewerPrompt: 'provided reviewer',
      agent2Prompt: 'provided agent 2',
      deduplicatorPrompt: 'provided deduplicator',
      hintImageGenPrompt: '',
      hintOverlayPrompt: '',
      hintBlendRenderPrompt: '',
      capturedAt: '2024-01-01T00:00:00.000Z',
    };
    const ctx = bootstrapRun(makeRequest({ promptSnapshot }));
    expect(ctx.promptSnapshot).toBe(promptSnapshot);
  });

  it('run_label is undefined when not provided', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.run_label).toBeUndefined();
  });

  it('attaches the V1 active profile at run start', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.activeProfile).toBe(V1_ACTIVE_PROFILE);
  });

  it('activeProfile has target_type = "question"', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.activeProfile.target_type).toBe('question');
  });

  it('activeProfile has max_regions_per_target = 10', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.activeProfile.max_regions_per_target).toBe(10);
  });

  it('activeProfile has composition_mode = "top_to_bottom"', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.activeProfile.composition_mode).toBe('top_to_bottom');
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

describe('bootstrapRun — prompt snapshot (PO-6 / INV-7)', () => {
  beforeEach(() => {
    resetPromptConfig();
  });

  it('captures a promptSnapshot at run start', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.promptSnapshot).toBeDefined();
    expect(typeof ctx.promptSnapshot.agent1Prompt).toBe('string');
    expect(typeof ctx.promptSnapshot.agent2Prompt).toBe('string');
    expect(typeof ctx.promptSnapshot.capturedAt).toBe('string');
  });

  it('promptSnapshot is frozen — mid-run mutation impossible (INV-7)', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(Object.isFrozen(ctx.promptSnapshot)).toBe(true);
  });

  it('snapshot reflects the session prompt at run start', () => {
    setAgent1Prompt('custom-a1');
    setAgent2Prompt('custom-a2');
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.promptSnapshot.agent1Prompt).toBe('custom-a1');
    expect(ctx.promptSnapshot.agent2Prompt).toBe('custom-a2');
  });

  it('mid-run edit does not change an already-captured snapshot (anti-drift)', () => {
    setAgent1Prompt('pre-run');
    const ctx = bootstrapRun(makeRequest());

    setAgent1Prompt('post-run edit');  // simulate mid-run UI edit

    expect(ctx.promptSnapshot.agent1Prompt).toBe('pre-run');
  });

  it('snapshot with default prompts captures the editable defaults', () => {
    const ctx = bootstrapRun(makeRequest());
    expect(ctx.promptSnapshot.agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
    expect(ctx.promptSnapshot.agent2Prompt).toBe(DEFAULT_AGENT2_PROMPT);
  });
});
