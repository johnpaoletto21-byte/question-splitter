/**
 * adapters/ui/local-app/run-renderer.ts
 *
 * HTML renderers for the real local run UI.
 */

import type { LocalRunRecord } from './run-state';

function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseStyles(): string {
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
    button { margin-top: 1rem; padding: 0.5rem 1.25rem; cursor: pointer; }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    .logs { border: 1px solid #ccc; padding: 0.75rem; background: #fafafa; white-space: pre-wrap; }
  `;
}

export function renderRunFormHtml(input: {
  configReady: boolean;
  missingKeys?: ReadonlyArray<string>;
  maxUploadMb: number;
}): string {
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

    <button type="submit" data-testid="run-start-button"${disabled}>Start Run</button>
  </form>
</body>
</html>`;
}

export function renderRunStatusHtml(record: LocalRunRecord): string {
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

export function renderRunErrorHtml(title: string, message: string): string {
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
