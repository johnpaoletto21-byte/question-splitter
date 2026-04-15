/**
 * adapters/ui/local-app/diagram-renderer.ts
 *
 * HTML rendering for the diagram-only cropper UI.
 *
 * Three views (mirrors run-renderer.ts):
 *   - renderDiagramFormHtml      → upload form on GET /run-diagrams
 *   - renderDiagramStatusHtml    → running / failed status on GET /diagram-runs/:id
 *   - renderDiagramResultsHtml   → sanity overlay + crop grid when complete
 */

import type { LocalDiagramRunRecord } from './run-state';

function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseStyles(): string {
  return `
    body { font-family: monospace; padding: 1.5rem; max-width: 1100px; }
    h1 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; }
    a { color: #0066cc; }
    .nav { margin-bottom: 1rem; font-size: 0.875rem; }
    .notice { border: 1px solid #ccc; padding: 0.7rem 1rem; margin: 1rem 0; line-height: 1.5; }
    .ok { background: #e8f5e9; border-color: #81c784; }
    .warn { background: #fff3cd; border-color: #ffc107; }
    .error { background: #ffebee; border-color: #ef9a9a; }
    label { display: block; margin: 1rem 0 0.35rem; font-weight: bold; }
    input { font-family: monospace; font-size: 0.9rem; }
    button { margin-top: 1rem; padding: 0.5rem 1.25rem; cursor: pointer; }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    .logs { border: 1px solid #ccc; padding: 0.75rem; background: #fafafa; white-space: pre-wrap; }
    .overlay-wrap { border: 1px solid #ddd; padding: 0.5rem; background: #fafafa; }
    .overlay-wrap img { max-width: 100%; height: auto; display: block; }
    .crops { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .crop-card { border: 1px solid #ddd; padding: 0.5rem; background: #fff; }
    .crop-card img { max-width: 100%; height: auto; display: block; }
    .crop-card .caption { font-size: 0.8rem; margin-top: 0.4rem; color: #333; }
    .crop-card.failed { border-color: #ef9a9a; background: #ffebee; }
  `;
}

export function renderDiagramFormHtml(input: {
  configReady: boolean;
  missingKeys?: ReadonlyArray<string>;
  maxUploadMb: number;
}): string {
  const configBlock = input.configReady
    ? `<div class="notice ok" data-testid="diagram-config-ready">Config ready. GEMINI_API_KEY is set.</div>`
    : `<div class="notice error" data-testid="diagram-config-missing">Missing config: ${esc((input.missingKeys ?? []).join(', '))}</div>`;
  const disabled = input.configReady ? '' : ' disabled';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crop Diagrams</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Crop Diagrams</h1>
  <div class="nav">
    <a href="/run">← Back to Question Pipeline</a> |
    <a href="/prompt-edit">Edit Prompts</a> |
    <a href="/run-hints">Hint Annotator</a>
  </div>
  <p>Upload a single PNG of a previously cropped exam question. Each diagram inside it will be cropped into its own PNG.</p>
  ${configBlock}
  <form method="POST" action="/run-diagrams" enctype="multipart/form-data" data-testid="diagram-upload-form">
    <label for="imageFile">Question PNG</label>
    <input id="imageFile" name="imageFile" type="file" accept="image/png,.png" data-testid="diagram-image-file"${disabled}>
    <div class="notice warn">Maximum upload size: ${input.maxUploadMb} MB.</div>

    <button type="submit" data-testid="diagram-start-button"${disabled}>Crop Diagrams</button>
  </form>
</body>
</html>`;
}

function renderLogsBlock(record: LocalDiagramRunRecord): string {
  if (record.logs.length === 0) {
    return 'No logs yet.';
  }
  return record.logs
    .map((entry) => `[${entry.timestamp}] ${entry.stage}: ${entry.message}`)
    .join('\n');
}

export function renderDiagramStatusHtml(record: LocalDiagramRunRecord): string {
  const shouldRefresh = record.status === 'queued' || record.status === 'running';
  const meta = shouldRefresh ? '<meta http-equiv="refresh" content="2">' : '';

  let resultBlock: string;
  if (record.status === 'succeeded') {
    resultBlock = `<div class="notice ok" data-testid="diagram-run-succeeded">Cropping complete.</div>`;
  } else if (record.status === 'failed') {
    resultBlock = `<div class="notice error" data-testid="diagram-run-failed">Run failed: ${esc(record.error ?? 'Unknown error')}</div>`;
  } else {
    resultBlock = `<div class="notice warn" data-testid="diagram-run-in-progress">Run is ${esc(record.status)}. This page refreshes every 2 seconds.</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${meta}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagram Run — ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Diagram Run</h1>
  <div class="nav">
    <a href="/run-diagrams">Crop Another</a> |
    <a href="/run">Question Pipeline</a>
  </div>
  <p><strong>Status:</strong> <span data-testid="diagram-run-status">${esc(record.status)}</span></p>
  ${record.imageFileName ? `<p><strong>Source:</strong> ${esc(record.imageFileName)}</p>` : ''}
  ${resultBlock}
  <h2>Logs</h2>
  <pre class="logs" data-testid="diagram-run-logs">${esc(renderLogsBlock(record))}</pre>
</body>
</html>`;
}

export function renderDiagramResultsHtml(record: LocalDiagramRunRecord): string {
  const result = record.result;
  if (!result) {
    return renderDiagramStatusHtml(record);
  }

  const okDiagrams = result.diagrams.filter((d) => d.status === 'ok');
  const failedDiagrams = result.diagrams.filter((d) => d.status === 'failed');

  const summary = okDiagrams.length === 0 && failedDiagrams.length === 0
    ? `<div class="notice warn" data-testid="diagram-no-diagrams">No diagrams found in this image. (If you expected some, check the overlay below — and confirm the source isn't an answer-box-only crop.)</div>`
    : `<div class="notice ok" data-testid="diagram-summary">Found ${okDiagrams.length} diagram${okDiagrams.length === 1 ? '' : 's'}${failedDiagrams.length > 0 ? `, ${failedDiagrams.length} failed` : ''}.</div>`;

  const overlayBlock = `
    <h2>Sanity overlay</h2>
    <p>Original PNG with red rectangles around each detected diagram. If a rectangle clips through a diagram, the crop is bad — re-run with a different prompt or re-crop the source question.</p>
    <div class="overlay-wrap"><img src="/diagram-runs/${esc(record.id)}/overlay" alt="Detection overlay" data-testid="diagram-overlay-image"></div>
  `;

  const cropCards: string[] = [];
  for (const diagram of result.diagrams) {
    if (diagram.status === 'ok') {
      const labelText = diagram.label ? ` — ${esc(diagram.label)}` : '';
      const previewUrl = `/diagram-runs/${esc(record.id)}/crops/${diagram.diagram_index}`;
      cropCards.push(`
        <div class="crop-card" data-testid="diagram-crop-card">
          <img src="${previewUrl}" alt="Diagram ${diagram.diagram_index}">
          <div class="caption">#${diagram.diagram_index}${labelText}</div>
          <div class="caption"><a href="${previewUrl}" download>Download</a></div>
        </div>
      `);
    } else {
      cropCards.push(`
        <div class="crop-card failed" data-testid="diagram-crop-card-failed">
          <div class="caption">#${diagram.diagram_index} — failed</div>
          <div class="caption">${esc(diagram.failure_code)}: ${esc(diagram.failure_message)}</div>
        </div>
      `);
    }
  }

  const cropsBlock = result.diagrams.length === 0
    ? ''
    : `
        <h2>Cropped diagrams (${result.diagrams.length})</h2>
        <div class="crops">${cropCards.join('')}</div>
      `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagram Results — ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Diagram Results</h1>
  <div class="nav">
    <a href="/run-diagrams">Crop Another</a> |
    <a href="/run">Question Pipeline</a>
  </div>
  ${record.imageFileName ? `<p><strong>Source:</strong> ${esc(record.imageFileName)} (${result.source_width} × ${result.source_height} px)</p>` : ''}
  ${summary}
  ${overlayBlock}
  ${cropsBlock}
  <h2>Logs</h2>
  <pre class="logs" data-testid="diagram-run-logs">${esc(renderLogsBlock(record))}</pre>
</body>
</html>`;
}

export function renderDiagramErrorHtml(title: string, message: string): string {
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
  <div class="notice error" data-testid="diagram-error">${esc(message)}</div>
  <div class="nav"><a href="/run-diagrams">Back to Diagram Cropper</a></div>
</body>
</html>`;
}
