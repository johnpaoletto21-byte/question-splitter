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
 *   GET  http://localhost:3001/prompt-edit  — renders the editor with current prompts
 *   POST http://localhost:3001/prompt-edit  — applies edits, redirects back to GET
 *
 * TASK-502 adds this module.
 */
import type { PromptConfigState } from '../../../core/prompt-config-store/types';
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
export declare function renderPromptEditorHtml(state: PromptConfigState): string;
//# sourceMappingURL=prompt-editor.d.ts.map