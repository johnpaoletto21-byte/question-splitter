/**
 * adapters/ui/local-app/prompt-editor.ts
 *
 * Renders the session-only prompt editing form as a self-contained HTML string.
 *
 * Design constraints:
 *   - Depends only on core/prompt-config-store types (no provider SDK, INV-9).
 *   - Does not import model adapters or upload adapter directly (boundary map).
 *   - "Session only" notice is always visible (INV-7: user must understand the scope).
 *   - All inputs use data-testid attributes for automated selector verification.
 *
 * UI selector plan (stable data-testid values):
 *   - Form container:        data-testid="prompt-edit-form"
 *   - Agent 1 textarea:      data-testid="prompt-editor-agent1"
 *   - Agent 2 textarea:      data-testid="prompt-editor-agent2"
 *   - Session-only notice:   data-testid="prompt-editor-session-note"
 *   - Save button:           data-testid="prompt-editor-save"
 *
 * Reachable route (via preview server):
 *   GET  http://localhost:3002/prompt-edit  — renders the editor with current prompts
 *   POST http://localhost:3002/prompt-edit  — applies edits, redirects back to GET
 *
 * TASK-502 adds this module.
 */

import type { PromptConfigState } from '../../../core/prompt-config-store/types';

/** Escapes HTML special characters to prevent XSS in injected strings. */
function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the prompt editing form as a self-contained HTML document.
 *
 * The form posts to POST /prompt-edit which updates the in-memory store and
 * redirects back. Editing via this form is session-only (INV-7): changes reset
 * when the process restarts, and any active run uses its start-time snapshot.
 *
 * @param state  Current session prompt state from getPromptConfig().
 * @returns      UTF-8 HTML string suitable for serving at GET /prompt-edit.
 */
export function renderPromptEditorHtml(state: PromptConfigState): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt Editor — Session Only</title>
  <style>
    body { font-family: monospace; padding: 1.5rem; max-width: 900px; }
    h1 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    .session-note {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 0.6rem 1rem;
      margin: 1rem 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .nav { margin-bottom: 1.2rem; font-size: 0.875rem; }
    label { display: block; margin-top: 1.2rem; font-weight: bold; font-size: 0.9rem; }
    .label-hint { font-weight: normal; color: #555; margin-left: 0.5rem; }
    textarea {
      width: 100%;
      height: 120px;
      font-family: monospace;
      font-size: 0.85rem;
      margin-top: 0.4rem;
      padding: 0.5rem;
      box-sizing: border-box;
      border: 1px solid #ccc;
    }
    button { margin-top: 1.2rem; padding: 0.5rem 1.5rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Prompt Editor</h1>
  <div class="session-note" data-testid="prompt-editor-session-note">
    <strong>Session only</strong> — prompt changes apply to future runs in this session and
    reset when the app restarts. An active run always uses the snapshot captured at its start
    time; editing here does not affect a run already in progress (INV-7).
    The boxes start with the default prompt text for this session.
  </div>
  <div class="nav">
    <a href="/run" data-testid="prompt-editor-run-link">Run PDF Pipeline</a> |
    <a href="/summary-preview">\u2190 Back to Run Summary</a>
  </div>
  <form method="POST" action="/prompt-edit" data-testid="prompt-edit-form">
    <label for="agent1Prompt">
      Agent 1 — Segmenter Prompt
      <span class="label-hint">(Question Segmenter)</span>
    </label>
    <textarea
      id="agent1Prompt"
      name="agent1Prompt"
      data-testid="prompt-editor-agent1"
      placeholder="Edit the Agent 1 default prompt"
    >${esc(state.agent1Prompt)}</textarea>

    <label for="agent2Prompt">
      Agent 2 — Localizer Prompt
      <span class="label-hint">(Region Localizer)</span>
    </label>
    <textarea
      id="agent2Prompt"
      name="agent2Prompt"
      data-testid="prompt-editor-agent2"
      placeholder="Edit the Agent 2 default prompt"
    >${esc(state.agent2Prompt)}</textarea>

    <button type="submit" data-testid="prompt-editor-save">Save for This Session</button>
  </form>
</body>
</html>`;
}
