"use strict";
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
 *   - AI comments:        data-testid="summary-row-ai-comments-{target_id}"
 *   - Agent 1 review note: data-testid="summary-row-review-comment-{target_id}"
 *   - Agent 2 review note: data-testid="summary-row-agent2-review-comment-{target_id}"
 *   - Failure code:        data-testid="summary-row-failure-code-{target_id}"
 *   - Failure message:     data-testid="summary-row-failure-message-{target_id}"
 *
 * TASK-501 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSummaryHtml = renderSummaryHtml;
/** Escapes HTML special characters to prevent XSS in injected strings. */
function esc(raw) {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function labelComment(label, comment) {
    if (comment === undefined) {
        return '—';
    }
    const trimmed = comment.trim();
    return trimmed.toLowerCase().startsWith(`${label.toLowerCase()}:`)
        ? trimmed
        : `${label}: ${trimmed}`;
}
/**
 * Renders a single summary row for one target entry.
 *
 * Per INV-8: this is always called for every entry; the caller must not skip failed rows.
 */
function renderTargetRow(entry, state) {
    const id = entry.target_id;
    // Status badge — shows final pipeline outcome, or 'pending' if not yet set.
    const statusLabel = entry.final_status ?? 'pending';
    const statusRow = `
    <td data-testid="summary-row-status-${esc(id)}">${esc(statusLabel)}</td>`;
    // Drive URL cell — rendered as an anchor when present, dash otherwise.
    const driveCell = entry.drive_url
        ? `<a href="${esc(entry.drive_url)}" data-testid="summary-row-drive-url-${esc(id)}" target="_blank" rel="noopener noreferrer">Open in Drive</a>`
        : `<span data-testid="summary-row-drive-url-${esc(id)}">—</span>`;
    const previewCell = entry.preview_url
        ? `<img src="${esc(entry.preview_url)}" alt="Preview for ${esc(id)}" data-testid="summary-row-preview-${esc(id)}">`
        : `<span data-testid="summary-row-preview-${esc(id)}">—</span>`;
    const agent1Comment = labelComment('Agent 1', entry.review_comment);
    const agent2Comment = labelComment('Agent 2', entry.agent2_review_comment);
    const comments = [
        entry.review_comment ? agent1Comment : '',
        entry.agent2_review_comment ? agent2Comment : '',
    ].filter((value) => value !== '').join('\n');
    const aiComments = comments
        ? `<span data-testid="summary-row-ai-comments-${esc(id)}">${esc(comments)}</span>`
        : `<span data-testid="summary-row-ai-comments-${esc(id)}">—</span>`;
    const commentCompat = [
        `<span class="comment-compat" data-testid="summary-row-review-comment-${esc(id)}">${esc(agent1Comment)}</span>`,
        `<span class="comment-compat" data-testid="summary-row-agent2-review-comment-${esc(id)}">${esc(agent2Comment)}</span>`,
    ].join('');
    const customCells = (state.extraction_fields ?? [])
        .map((field) => {
        const value = entry.extraction_fields?.[field.key];
        const label = value === undefined ? '—' : value ? 'Yes' : 'No';
        return `<td data-testid="summary-row-field-${esc(id)}-${esc(field.key)}">${esc(label)}</td>`;
    })
        .join('');
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
    <td>${entry.page_numbers.join(', ')}</td>
    <td>${entry.finish_page_number ?? '—'}</td>${statusRow}
    <td>${previewCell}</td>
    <td>${driveCell}</td>
    ${customCells}
    <td>${aiComments}${commentCompat}</td>
    <td>${failureCode}</td>
    <td>${failureMessage}</td>
  </tr>`;
}
/**
 * Renders a single target as a card for the split-view layout.
 */
function renderTargetCard(entry, state) {
    const id = entry.target_id;
    const statusLabel = entry.final_status ?? 'pending';
    const statusClass = statusLabel === 'ok' ? 'status-ok' : statusLabel === 'failed' ? 'status-failed' : 'status-pending';
    const previewImg = entry.preview_url
        ? `<img src="${esc(entry.preview_url)}" alt="Preview for ${esc(id)}" data-testid="summary-row-preview-${esc(id)}" loading="lazy">`
        : `<span data-testid="summary-row-preview-${esc(id)}" class="no-preview">No preview</span>`;
    const agent1Comment = labelComment('Agent 1', entry.review_comment);
    const agent2Comment = labelComment('Agent 2', entry.agent2_review_comment);
    const comments = [
        entry.review_comment ? agent1Comment : '',
        entry.agent2_review_comment ? agent2Comment : '',
    ].filter((v) => v !== '').join('<br>');
    const driveLink = entry.drive_url
        ? `<a href="${esc(entry.drive_url)}" data-testid="summary-row-drive-url-${esc(id)}" target="_blank" rel="noopener noreferrer">Open in Drive</a>`
        : '';
    const customFields = (state.extraction_fields ?? [])
        .map((field) => {
        const value = entry.extraction_fields?.[field.key];
        const label = value === undefined ? '—' : value ? 'Yes' : 'No';
        return `<span class="card-field" data-testid="summary-row-field-${esc(id)}-${esc(field.key)}"><strong>${esc(field.label)}:</strong> ${esc(label)}</span>`;
    })
        .join('');
    const failureInfo = entry.final_status === 'failed'
        ? `<div class="card-failure">
        <span data-testid="summary-row-failure-code-${esc(id)}">${esc(entry.failure_code ?? '—')}</span>:
        <span data-testid="summary-row-failure-message-${esc(id)}">${esc(entry.failure_message ?? '—')}</span>
      </div>`
        : `<span class="card-hidden" data-testid="summary-row-failure-code-${esc(id)}">—</span><span class="card-hidden" data-testid="summary-row-failure-message-${esc(id)}">—</span>`;
    return `
  <div class="target-card" data-testid="summary-row-${esc(id)}" data-pages="${entry.page_numbers.join(',')}">
    <div class="card-header">
      <span class="card-id">${esc(id)}</span>
      <span class="card-type">${esc(entry.target_type)}</span>
      <span class="card-badge ${statusClass}" data-testid="summary-row-status-${esc(id)}">${esc(statusLabel)}</span>
    </div>
    <div class="card-preview">${previewImg}</div>
    <div class="card-meta">
      <span class="card-pages">Pages: ${entry.page_numbers.join(', ')}${entry.finish_page_number ? ` (ends ${entry.finish_page_number})` : ''}</span>
      ${driveLink}
      ${customFields}
      <div class="card-comments" data-testid="summary-row-ai-comments-${esc(id)}">${comments || '—'}</div>
      <span class="comment-compat" data-testid="summary-row-review-comment-${esc(id)}">${esc(agent1Comment)}</span>
      <span class="comment-compat" data-testid="summary-row-agent2-review-comment-${esc(id)}">${esc(agent2Comment)}</span>
    </div>
    ${failureInfo}
  </div>`;
}
/**
 * Renders a RunSummaryState as a self-contained HTML string.
 *
 * All target rows are always rendered (INV-8: partial failures stay visible).
 * review_comment fields appear in the rendered table (INV-4: visible in summary UI).
 *
 * When `options.sourcePdfUrl` is provided, renders a split-view layout with
 * target cards on the left and the source PDF on the right.
 * When absent, renders the original table layout for backward compatibility.
 *
 * @param state    The run summary state, typically after applyFinalResultsToSummary.
 * @param options  Optional rendering options (e.g. sourcePdfUrl for split-view).
 * @returns        UTF-8 HTML string suitable for writing to a .html file and opening
 *                 in a browser for manual or automated review.
 */
function renderSummaryHtml(state, options) {
    if (options?.sourcePdfUrl) {
        return renderSplitViewHtml(state, options.sourcePdfUrl);
    }
    return renderTableHtml(state);
}
function renderSplitViewHtml(state, sourcePdfUrl) {
    const cards = state.targets.map((entry) => renderTargetCard(entry, state)).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Run Summary — ${esc(state.run_id)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; }
    .top-bar {
      padding: 0.5rem 1rem;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .top-bar h1 { font-size: 1rem; font-weight: 600; }
    .top-bar a { color: #0066cc; }
    .split-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: calc(100vh - 2.5rem);
    }
    .left-panel {
      overflow-y: auto;
      padding: 1rem;
      border-right: 2px solid #ddd;
      background: #fafafa;
    }
    .left-panel h2 { font-size: 0.95rem; margin-bottom: 0.75rem; color: #333; }
    .right-panel { height: 100%; }
    .right-panel embed { width: 100%; height: 100%; border: none; }
    .target-card {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      background: #fff;
      cursor: default;
      transition: box-shadow 0.15s;
    }
    .target-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .card-id { font-weight: 600; font-size: 0.9rem; }
    .card-type { color: #666; font-size: 0.8rem; }
    .card-badge {
      font-size: 0.75rem;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      font-weight: 500;
      margin-left: auto;
    }
    .status-ok { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-pending { background: #fff3cd; color: #856404; }
    .card-preview { margin-bottom: 0.5rem; }
    .card-preview img { max-width: 100%; display: block; border: 1px solid #eee; border-radius: 3px; }
    .no-preview { color: #999; font-size: 0.8rem; }
    .card-meta { font-size: 0.8rem; color: #555; }
    .card-meta > * { display: block; margin-bottom: 0.2rem; }
    .card-pages { color: #0066cc; font-weight: 500; }
    .card-field { font-size: 0.8rem; }
    .card-comments { font-style: italic; color: #666; margin-top: 0.3rem; }
    .card-failure { font-size: 0.8rem; color: #721c24; margin-top: 0.4rem; padding: 0.3rem; background: #f8d7da; border-radius: 3px; }
    .card-hidden { display: none; }
    .comment-compat { display: none; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="top-bar">
    <h1>Run Summary: <code>${esc(state.run_id)}</code></h1>
    <a href="/run" data-testid="summary-run-link">Run PDF Pipeline</a> |
    <a href="/prompt-edit" data-testid="summary-prompt-edit-link">Edit Prompts</a>
  </div>
  <div class="split-container" data-testid="run-summary">
    <div class="left-panel" data-testid="left-panel">
      <h2>Cropped Questions (${state.targets.length})</h2>
      ${cards}
    </div>
    <div class="right-panel" data-testid="right-panel">
      <embed type="application/pdf" src="${esc(sourcePdfUrl)}" data-testid="source-pdf-embed">
    </div>
  </div>
</body>
</html>`;
}
function renderTableHtml(state) {
    const rows = state.targets.map((entry) => renderTargetRow(entry, state)).join('');
    const customHeaders = (state.extraction_fields ?? [])
        .map((field) => `<th data-testid="summary-field-header-${esc(field.key)}">${esc(field.label)}</th>`)
        .join('');
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
    img[data-testid^="summary-row-preview-"] { max-width: 360px; max-height: 180px; display: block; background: #fff; }
    a { color: #0066cc; }
    .nav { margin-bottom: 1.2rem; font-size: 0.875rem; }
    .comment-compat { display: none; }
  </style>
</head>
<body>
  <h1>Run Summary: <code>${esc(state.run_id)}</code></h1>
  <div class="nav">
    <a href="/run" data-testid="summary-run-link">Run PDF Pipeline</a> |
    <a href="/prompt-edit" data-testid="summary-prompt-edit-link">Edit Prompts</a>
  </div>
  <table data-testid="run-summary">
    <thead>
      <tr>
        <th>Target ID</th>
        <th>Type</th>
        <th>Pages</th>
        <th>Finish Page</th>
        <th>Status</th>
        <th>Preview</th>
        <th>Drive URL</th>
        ${customHeaders}
        <th>AI Comments</th>
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
//# sourceMappingURL=summary-renderer.js.map