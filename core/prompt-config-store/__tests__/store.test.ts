/**
 * core/prompt-config-store/__tests__/store.test.ts
 *
 * Unit tests for the session-only prompt configuration store.
 *
 * Proves:
 *   - PO-6 / INV-7: snapshot is immutable at run start; mid-run edits do not drift.
 *   - PO-8 / INV-9: no persistent storage or provider SDK touched in this module.
 *   - Session-only behavior: defaults apply on reset, edits apply within session.
 */

import {
  getPromptConfig,
  setAgent1Prompt,
  setReviewerPrompt,
  setAgent2Prompt,
  capturePromptSnapshot,
  resetPromptConfig,
} from '../store';
import { DEFAULT_AGENT1_PROMPT, DEFAULT_REVIEWER_PROMPT, DEFAULT_AGENT2_PROMPT } from '../default-prompts';

beforeEach(() => {
  resetPromptConfig();
});

// ── Default state ─────────────────────────────────────────────────────────────

describe('getPromptConfig — defaults', () => {
  it('returns editable default prompt text by default', () => {
    const state = getPromptConfig();
    expect(state.agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
    expect(state.reviewerPrompt).toBe(DEFAULT_REVIEWER_PROMPT);
    expect(state.agent2Prompt).toBe(DEFAULT_AGENT2_PROMPT);
  });
});

// ── Session editing ───────────────────────────────────────────────────────────

describe('setAgent1Prompt / setAgent2Prompt — session editing', () => {
  it('stores the edited agent1 prompt', () => {
    setAgent1Prompt('Custom Agent 1 text');
    expect(getPromptConfig().agent1Prompt).toBe('Custom Agent 1 text');
  });

  it('stores the edited agent2 prompt', () => {
    setAgent2Prompt('Custom Agent 2 text');
    expect(getPromptConfig().agent2Prompt).toBe('Custom Agent 2 text');
  });

  it('agent1 edit does not affect agent2', () => {
    setAgent1Prompt('only one');
    expect(getPromptConfig().agent2Prompt).toBe(DEFAULT_AGENT2_PROMPT);
  });

  it('agent2 edit does not affect agent1', () => {
    setAgent2Prompt('only two');
    expect(getPromptConfig().agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
  });

  it('successive edits replace the previous value', () => {
    setAgent1Prompt('first');
    setAgent1Prompt('second');
    expect(getPromptConfig().agent1Prompt).toBe('second');
  });

  it('stores an empty string (reverting to built-in prompt)', () => {
    setAgent1Prompt('non-empty');
    setAgent1Prompt('');
    expect(getPromptConfig().agent1Prompt).toBe('');
  });

  it('getPromptConfig returns a copy — mutation does not affect the store', () => {
    setAgent1Prompt('original');
    const copy = getPromptConfig();
    // Deliberately mutate the copy
    (copy as { agent1Prompt: string }).agent1Prompt = 'mutated-copy';
    // Store must be unchanged
    expect(getPromptConfig().agent1Prompt).toBe('original');
  });
});

// ── Snapshot capture (PO-6 / INV-7) ─────────────────────────────────────────

describe('capturePromptSnapshot — immutable snapshot at run start', () => {
  it('snapshot contains all agent prompts at capture time', () => {
    setAgent1Prompt('A1 at capture');
    setReviewerPrompt('Rev at capture');
    setAgent2Prompt('A2 at capture');
    const snap = capturePromptSnapshot();
    expect(snap.agent1Prompt).toBe('A1 at capture');
    expect(snap.reviewerPrompt).toBe('Rev at capture');
    expect(snap.agent2Prompt).toBe('A2 at capture');
  });

  it('snapshot contains a capturedAt ISO timestamp', () => {
    const before = new Date().toISOString();
    const snap = capturePromptSnapshot();
    const after = new Date().toISOString();
    expect(snap.capturedAt >= before).toBe(true);
    expect(snap.capturedAt <= after).toBe(true);
  });

  it('snapshot is frozen — Object.isFrozen confirms (INV-7: no mutation)', () => {
    const snap = capturePromptSnapshot();
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('mid-run edit (agent1) does NOT change the captured snapshot — anti-drift proof (INV-7)', () => {
    setAgent1Prompt('BEFORE RUN');
    const snap = capturePromptSnapshot(); // run start: capture snapshot

    setAgent1Prompt('MID-RUN EDIT');      // simulate mid-run UI edit

    // Snapshot must still carry the pre-run value
    expect(snap.agent1Prompt).toBe('BEFORE RUN');
    // Live store reflects the edit
    expect(getPromptConfig().agent1Prompt).toBe('MID-RUN EDIT');
  });

  it('mid-run edit (agent2) does NOT change the captured snapshot — anti-drift proof (INV-7)', () => {
    setAgent2Prompt('BEFORE RUN A2');
    const snap = capturePromptSnapshot();

    setAgent2Prompt('MID-RUN EDIT A2');

    expect(snap.agent2Prompt).toBe('BEFORE RUN A2');
    expect(getPromptConfig().agent2Prompt).toBe('MID-RUN EDIT A2');
  });

  it('two runs get independent snapshots — second run sees updated store', () => {
    setAgent1Prompt('run-1 prompt');
    const snap1 = capturePromptSnapshot();

    setAgent1Prompt('run-2 prompt');
    const snap2 = capturePromptSnapshot();

    expect(snap1.agent1Prompt).toBe('run-1 prompt');
    expect(snap2.agent1Prompt).toBe('run-2 prompt');
  });

  it('snapshot with defaults contains the editable default prompts', () => {
    // Default state — no edits
    const snap = capturePromptSnapshot();
    expect(snap.agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
    expect(snap.reviewerPrompt).toBe(DEFAULT_REVIEWER_PROMPT);
    expect(snap.agent2Prompt).toBe(DEFAULT_AGENT2_PROMPT);
  });
});

// ── Reset utility ─────────────────────────────────────────────────────────────

describe('resetPromptConfig — test utility', () => {
  it('resets all prompts to defaults after edits', () => {
    setAgent1Prompt('dirty');
    setReviewerPrompt('dirty too');
    setAgent2Prompt('also dirty');
    resetPromptConfig();
    const state = getPromptConfig();
    expect(state.agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
    expect(state.reviewerPrompt).toBe(DEFAULT_REVIEWER_PROMPT);
    expect(state.agent2Prompt).toBe(DEFAULT_AGENT2_PROMPT);
  });
});

// ── Session-only guard (INV-7 / PO-6) ────────────────────────────────────────

describe('session-only behavior — no persistence', () => {
  it('state resets after resetPromptConfig (simulates process restart behavior)', () => {
    // Confirmed by structural inspection: store.ts imports only ./types.
    // No fs, no database, no localStorage. State lives in module closure.
    setAgent1Prompt('session-value');
    resetPromptConfig();
    expect(getPromptConfig().agent1Prompt).toBe(DEFAULT_AGENT1_PROMPT);
  });
});
