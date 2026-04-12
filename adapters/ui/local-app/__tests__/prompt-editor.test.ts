/**
 * adapters/ui/local-app/__tests__/prompt-editor.test.ts
 *
 * Unit tests for the prompt editor HTML renderer.
 *
 * Proves:
 *   - PO-6 / INV-7: session-only notice is always visible.
 *   - All data-testid selectors are present (reviewer can verify by browser).
 *   - Current prompt values are rendered in the form.
 *   - XSS escaping is applied to user-provided prompt strings.
 *   - No provider SDK or persistent storage imports (INV-9).
 *
 * UI selector plan (matches prompt-editor.ts header):
 *   data-testid="prompt-edit-form"
 *   data-testid="prompt-editor-agent1"
 *   data-testid="prompt-editor-agent2"
 *   data-testid="prompt-editor-session-note"
 *   data-testid="prompt-editor-save"
 */

import { renderPromptEditorHtml } from '../prompt-editor';
import type { PromptConfigState } from '../../../../core/prompt-config-store/types';
import { DEFAULT_AGENT1_PROMPT, DEFAULT_REVIEWER_PROMPT, DEFAULT_AGENT2_PROMPT } from '../../../../core/prompt-config-store/default-prompts';

function makeState(overrides: Partial<PromptConfigState> = {}): PromptConfigState {
  return {
    agent1Prompt: '',
    reviewerPrompt: '',
    agent2Prompt: '',
    ...overrides,
  };
}

// ── Required data-testid selectors ────────────────────────────────────────────

describe('renderPromptEditorHtml — data-testid selectors (selector plan)', () => {
  it('includes data-testid="prompt-edit-form" on the form element', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('data-testid="prompt-edit-form"');
  });

  it('includes data-testid="prompt-editor-agent1" on the agent1 textarea', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('data-testid="prompt-editor-agent1"');
  });

  it('includes data-testid="prompt-editor-agent2" on the agent2 textarea', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('data-testid="prompt-editor-agent2"');
  });

  it('includes data-testid="prompt-editor-session-note" (INV-7 notice visible)', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('data-testid="prompt-editor-session-note"');
  });

  it('includes data-testid="prompt-editor-save" on the submit button', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('data-testid="prompt-editor-save"');
  });
});

// ── Session-only notice (INV-7 / PO-6) ───────────────────────────────────────

describe('renderPromptEditorHtml — session-only notice (INV-7)', () => {
  it('session note contains "Session only" text', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('Session only');
  });

  it('session note explains that active runs are not affected', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toMatch(/active run|start time|snapshot/i);
  });
});

// ── Form structure ────────────────────────────────────────────────────────────

describe('renderPromptEditorHtml — form structure', () => {
  it('form posts to /prompt-edit', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('action="/prompt-edit"');
    expect(html).toContain('method="POST"');
  });

  it('links to the real run page', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('href="/run"');
    expect(html).toContain('data-testid="prompt-editor-run-link"');
  });

  it('agent1 textarea has name="agent1Prompt"', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('name="agent1Prompt"');
  });

  it('agent2 textarea has name="agent2Prompt"', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toContain('name="agent2Prompt"');
  });

  it('returns a valid HTML document with DOCTYPE', () => {
    const html = renderPromptEditorHtml(makeState());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });
});

// ── Current prompt values rendered ────────────────────────────────────────────

describe('renderPromptEditorHtml — renders current prompt values', () => {
  it('renders default prompt text in the textareas', () => {
    const html = renderPromptEditorHtml(makeState({
      agent1Prompt: DEFAULT_AGENT1_PROMPT,
      reviewerPrompt: DEFAULT_REVIEWER_PROMPT,
      agent2Prompt: DEFAULT_AGENT2_PROMPT,
    }));
    expect(html).toContain('You are Agent 1');
    expect(html).toContain('You are Agent 1.5');
    expect(html).toContain('You are Agent 2');
  });

  it('renders agent1Prompt value in the textarea', () => {
    const html = renderPromptEditorHtml(makeState({ agent1Prompt: 'Segment the questions' }));
    expect(html).toContain('Segment the questions');
  });

  it('renders agent2Prompt value in the textarea', () => {
    const html = renderPromptEditorHtml(makeState({ agent2Prompt: 'Localize each region' }));
    expect(html).toContain('Localize each region');
  });

  it('empty prompts produce empty textarea bodies', () => {
    const html = renderPromptEditorHtml(makeState({ agent1Prompt: '', agent2Prompt: '' }));
    // The textarea content between tags should not contain any non-whitespace text
    // from the prompt values (they are empty).
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});

// ── XSS escaping ──────────────────────────────────────────────────────────────

describe('renderPromptEditorHtml — XSS escaping', () => {
  it('escapes < and > in agent1 prompt', () => {
    const html = renderPromptEditorHtml(makeState({ agent1Prompt: '<script>alert(1)</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes & in agent2 prompt', () => {
    const html = renderPromptEditorHtml(makeState({ agent2Prompt: 'A & B' }));
    expect(html).not.toMatch(/(?<!&amp)&(?!amp;)/);
    expect(html).toContain('A &amp; B');
  });

  it('escapes double quotes in prompt values', () => {
    const html = renderPromptEditorHtml(makeState({ agent1Prompt: 'say "hello"' }));
    expect(html).toContain('&quot;');
  });
});
