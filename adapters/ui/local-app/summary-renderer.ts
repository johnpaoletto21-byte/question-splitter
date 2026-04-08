/**
 * adapters/ui/local-app/summary-renderer.ts
 *
 * Renders RunSummaryState as a self-contained HTML string for local viewing.
 *
 * Design constraints:
 *   - Depends only on core/run-summary types (no provider SDK types, INV-9).
 *   - Does not import upload adapter or model adapters directly (boundary map rule).
 *   - review_comment and agent2_review_comment are rendered in the UI (INV-4: visible
 *     in summary) — they are carried on RunSummaryTargetEntry, never on result rows.
 *   - Every rendered row uses data-testid attributes so the summary container,
 *     per-row status, drive URL, and review comment are addressable for verification.
 *   - Partial failures remain visible: all target rows are always rendered regardless
 *     of final_status value (INV-8: one failed target must not hide the rest).
 *
 * UI selector plan (stable data-testid values):
 *   - Summary container:   data-testid="run-summary"
 *   - Per-row container:   data-testid="summary-row-{target_id}"
 *   - Per-row status:      data-testid="summary-row-status-{target_id}"
 *   - Drive URL anchor:    data-testid="summary-row-drive-url-{target_id}"
 *   - Agent 1 review note: data-testid="summary-row-review-comment-{target_id}"
 *   - Agent 2 review note: data-testid="summary-row-agent2-review-comment-{target_id}"
 *   - Failure code:        data-testid="summary-row-failure-code-{target_id}"
 *   - Failure message:     data-testid="summary-row-failure-message-{target_id}"
 *
 * TASK-501 adds this module.
 */

import type { RunSummaryState, RunSummaryTargetEntry } from '../../../core/run-summary/types';

/** Escapes HTML special characters to prevent XSS in injected strings. */
function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a single summary row for one target entry.
 *
 * Per INV-8: this is always called for every entry; the caller must not skip failed rows.
 */
function renderTargetRow(entry: RunSummaryTargetEntry): string {
  const id = entry.target_id;

  // Status badge — shows final pipeline outcome, or 'pending' if not yet set.
  const statusLabel = entry.final_status ?? 'pending';
  const statusRow = `
    <td data-testid="summary-row-status-${esc(id)}">${esc(statusLabel)}</td>`;

  // Drive URL cell — rendered as an anchor when present, dash otherwise.
  const driveCell = entry.drive_url
    ? `<a href="${esc(entry.drive_url)}" data-testid="summary-row-drive-url-${esc(id)}" target="_blank" rel="noopener noreferrer">Open in Drive</a>`
    : `<span data-testid="summary-row-drive-url-${esc(id)}">—</span>`;

  // Agent 1 review comment (INV-4: visible in UI).
  const agent1Comment = entry.review_comment
    ? `<span data-testid="summary-row-review-comment-${esc(id)}">${esc(entry.review_comment)}</span>`
    : `<span data-testid="summary-row-review-comment-${esc(id)}">—</span>`;

  // Agent 2 review comment (INV-4: visible in UI).
  const agent2Comment = entry.agent2_review_comment
    ? `<span data-testid="summary-row-agent2-review-comment-${esc(id)}">${esc(entry.agent2_review_comment)}</span>`
    : `<span data-testid="summary-row-agent2-review-comment-${esc(id)}">—</span>`;

  // Failure details — only visible when final_status = 'failed'.
  const failureCode = entry.failure_code
    ? `<span data-testid="summary-row-failure-code-${esc(id)}">${esc(entry.failure_code)}</span>`
    : `<span data-testid="summary-row-failure-code-${esc(id)}">—</span>`;

  const failureMessage = entry.failure_message
    ? `<span data-testid="summary-row-failure-message-${esc(id)}">${esc(entry.failure_message)}</span>`
    : `<span data-testid="summary-row-failure-message-${esc(id)}">—</span>`;

  return `
  <tr data-testid="summary-row-${esc(id)}">
    <td>${esc(id)}</td>
    <td>${esc(entry.target_type)}</td>
    <td>${entry.page_numbers.join(', ')}</td>${statusRow}
    <td>${driveCell}</td>
    <td>${agent1Comment}</td>
    <td>${agent2Comment}</td>
    <td>${failureCode}</td>
    <td>${failureMessage}</td>
  </tr>`;
}

/**
 * Renders a RunSummaryState as a self-contained HTML string.
 *
 * All target rows are always rendered (INV-8: partial failures stay visible).
 * review_comment fields appear in the rendered table (INV-4: visible in summary UI).
 *
 * @param state  The run summary state, typically after applyFinalResultsToSummary.
 * @returns      UTF-8 HTML string suitable for writing to a .html file and opening
 *               in a browser for manual or automated review.
 */
export function renderSummaryHtml(state: RunSummaryState): string {
  const rows = state.targets.map(renderTargetRow).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Run Summary — ${esc(state.run_id)}</title>
  <style>
    body { font-family: monospace; padding: 1.5rem; }
    h1 { font-size: 1.2rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.7rem; text-align: left; font-size: 0.85rem; }
    th { background: #f0f0f0; }
    tr[data-testid]:hover { background: #fafafa; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Run Summary: <code>${esc(state.run_id)}</code></h1>
  <table data-testid="run-summary">
    <thead>
      <tr>
        <th>Target ID</th>
        <th>Type</th>
        <th>Pages</th>
        <th>Status</th>
        <th>Drive URL</th>
        <th>Agent 1 Note</th>
        <th>Agent 2 Note</th>
        <th>Failure Code</th>
        <th>Failure Message</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>`;
}
