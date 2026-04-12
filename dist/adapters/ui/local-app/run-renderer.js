"use strict";
/**
 * adapters/ui/local-app/run-renderer.ts
 *
 * HTML renderers for the real local run UI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderRunFormHtml = renderRunFormHtml;
exports.renderRunStatusHtml = renderRunStatusHtml;
exports.renderRunErrorHtml = renderRunErrorHtml;
function esc(raw) {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function baseStyles() {
    return `
    body { font-family: monospace; padding: 1.5rem; max-width: 980px; }
    h1 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    a { color: #0066cc; }
    .nav { margin-bottom: 1rem; font-size: 0.875rem; }
    .notice { border: 1px solid #ccc; padding: 0.7rem 1rem; margin: 1rem 0; line-height: 1.5; }
    .ok { background: #e8f5e9; border-color: #81c784; }
    .warn { background: #fff3cd; border-color: #ffc107; }
    .error { background: #ffebee; border-color: #ef9a9a; }
    label { display: block; margin: 1rem 0 0.35rem; font-weight: bold; }
    input { font-family: monospace; font-size: 0.9rem; }
    input[type="text"] { width: 100%; box-sizing: border-box; padding: 0.45rem; border: 1px solid #bbb; }
    textarea { width: 100%; box-sizing: border-box; min-height: 4rem; padding: 0.45rem; border: 1px solid #bbb; font-family: monospace; font-size: 0.9rem; }
    button { margin-top: 1rem; padding: 0.5rem 1.25rem; cursor: pointer; }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    fieldset { border: 1px solid #ccc; margin: 1rem 0; padding: 0.9rem; }
    .field-row { border-top: 1px solid #ddd; margin-top: 0.8rem; padding-top: 0.8rem; }
    .hint { color: #555; font-size: 0.82rem; line-height: 1.4; }
    .logs { border: 1px solid #ccc; padding: 0.75rem; background: #fafafa; white-space: pre-wrap; }
  `;
}
function renderRunFormHtml(input) {
    const configBlock = input.configReady
        ? `<div class="notice ok" data-testid="run-config-ready">Config ready. Drive upload is required for this run.</div>`
        : `<div class="notice error" data-testid="run-config-missing">Missing config: ${esc((input.missingKeys ?? []).join(', '))}</div>`;
    const disabled = input.configReady ? '' : ' disabled';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Run PDF Pipeline</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Run PDF Pipeline</h1>
  <div class="nav">
    <a href="/summary-preview">Preview Summary</a> |
    <a href="/prompt-edit">Edit Prompts</a>
  </div>
  ${configBlock}
  <form method="POST" action="/run" enctype="multipart/form-data" data-testid="run-upload-form">
    <label for="runLabel">Run label</label>
    <input id="runLabel" name="runLabel" type="text" placeholder="Optional label">

    <label for="pdfFile">PDF file</label>
    <input id="pdfFile" name="pdfFile" type="file" accept="application/pdf,.pdf" data-testid="run-pdf-file"${disabled}>
    <div class="notice warn">Maximum upload size: ${input.maxUploadMb} MB.</div>

    <fieldset data-testid="extraction-fields">
      <legend>Custom boolean fields</legend>
      <p class="hint">Optional per-question labels for Agent 1, such as "Has Diagram" or "Long Passage". Each value is returned as Yes/No in the summary.</p>
      <div id="extractionFieldRows"></div>
      <button type="button" id="addExtractionField" data-testid="add-extraction-field-button"${disabled}>Add Field</button>
    </fieldset>

    <button type="submit" data-testid="run-start-button"${disabled}>Start Run</button>
  </form>
  <script>
    (function () {
      var rows = document.getElementById('extractionFieldRows');
      var add = document.getElementById('addExtractionField');
      var nextIndex = 0;
      function addRow() {
        var index = nextIndex++;
        var row = document.createElement('div');
        row.className = 'field-row';
        row.setAttribute('data-testid', 'extraction-field-row');
        row.innerHTML =
          '<label for="extractionFieldName_' + index + '">Field name</label>' +
          '<input id="extractionFieldName_' + index + '" name="extractionFieldName_' + index + '" type="text" placeholder="Has Diagram">' +
          '<label for="extractionFieldDescription_' + index + '">Description</label>' +
          '<textarea id="extractionFieldDescription_' + index + '" name="extractionFieldDescription_' + index + '" placeholder="true if the question includes a diagram, graph, chart, geometric figure, or other visual material"></textarea>';
        rows.appendChild(row);
      }
      add.addEventListener('click', addRow);
    })();
  </script>
</body>
</html>`;
}
function renderRunStatusHtml(record) {
    const shouldRefresh = record.status === 'queued' || record.status === 'running';
    const meta = shouldRefresh ? '<meta http-equiv="refresh" content="2">' : '';
    const logs = record.logs.length === 0
        ? 'No logs yet.'
        : record.logs
            .map((entry) => `[${entry.timestamp}] ${entry.stage}: ${entry.message}`)
            .join('\n');
    const resultBlock = record.status === 'succeeded'
        ? `<div class="notice ok" data-testid="run-succeeded">Run complete. <a href="/runs/${esc(record.id)}/summary">Open Summary</a></div>`
        : record.status === 'failed'
            ? `<div class="notice error" data-testid="run-failed">Run failed: ${esc(record.error ?? 'Unknown error')}</div>`
            : `<div class="notice warn" data-testid="run-in-progress">Run is ${esc(record.status)}. This page refreshes every 2 seconds.</div>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${meta}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Run Logs — ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Run Logs</h1>
  <div class="nav">
    <a href="/run">Start Another Run</a> |
    <a href="/prompt-edit">Edit Prompts</a> |
    <a href="/runs/${esc(record.id)}/debug.md" data-testid="run-debug-download-link" download>Download Debug Package (.md)</a>
  </div>
  <p><strong>Status:</strong> <span data-testid="run-status">${esc(record.status)}</span></p>
  ${record.runLabel ? `<p><strong>Label:</strong> ${esc(record.runLabel)}</p>` : ''}
  ${record.pdfFileName ? `<p><strong>PDF:</strong> ${esc(record.pdfFileName)}</p>` : ''}
  ${resultBlock}
  <pre class="logs" data-testid="run-logs">${esc(logs)}</pre>
</body>
</html>`;
}
function renderRunErrorHtml(title, message) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <div class="notice error" data-testid="run-error">${esc(message)}</div>
  <div class="nav"><a href="/run">Back to Run</a></div>
</body>
</html>`;
}
//# sourceMappingURL=run-renderer.js.map