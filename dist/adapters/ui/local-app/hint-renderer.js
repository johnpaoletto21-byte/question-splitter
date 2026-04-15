"use strict";
/**
 * adapters/ui/local-app/hint-renderer.ts
 *
 * HTML rendering for the hint annotator UI.
 *
 * Three views:
 *   - renderHintFormHtml      → upload form on GET /run-hints
 *   - renderHintStatusHtml    → running / failed status on GET /hint-runs/:id
 *   - renderHintResultsHtml   → source + annotated image when complete
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderHintFormHtml = renderHintFormHtml;
exports.renderHintStatusHtml = renderHintStatusHtml;
exports.renderHintResultsHtml = renderHintResultsHtml;
exports.renderHintAllResultsHtml = renderHintAllResultsHtml;
exports.renderHintErrorHtml = renderHintErrorHtml;
function esc(raw) {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function baseStyles() {
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
    .info { background: #e3f2fd; border-color: #64b5f6; }
    label { display: block; margin: 1rem 0 0.35rem; font-weight: bold; }
    input[type="file"], input[type="text"] { font-family: monospace; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
    textarea { font-family: monospace; font-size: 0.85rem; width: 100%; box-sizing: border-box; padding: 0.5rem; border: 1px solid #ccc; }
    button { margin-top: 1rem; padding: 0.5rem 1.25rem; cursor: pointer; }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    details.blend-config { margin: 1rem 0; border: 1px solid #ccc; padding: 0.5rem 0.8rem; background: #fafafa; }
    details.blend-config > summary { cursor: pointer; font-weight: bold; }
    details.blend-config .label-hint { font-weight: normal; color: #555; margin-left: 0.5rem; }
    .logs { border: 1px solid #ccc; padding: 0.75rem; background: #fafafa; white-space: pre-wrap; }
    .method-group { margin: 1rem 0; }
    .method-group label { display: inline; font-weight: normal; margin-left: 0.5rem; }
    .method-group .method-option { margin: 0.4rem 0; }
    .method-desc { font-size: 0.8rem; color: #555; margin-left: 1.8rem; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
    .comparison .panel { border: 1px solid #ddd; padding: 0.5rem; background: #fafafa; }
    .comparison .panel img { max-width: 100%; height: auto; display: block; }
    .comparison .panel-title { font-weight: bold; font-size: 0.9rem; margin-bottom: 0.4rem; }
    .comparison-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-top: 1rem; }
    .comparison-4 .panel { border: 1px solid #ddd; padding: 0.5rem; background: #fafafa; }
    .comparison-4 .panel img { max-width: 100%; height: auto; display: block; }
    .comparison-4 .panel-title { font-weight: bold; font-size: 0.85rem; margin-bottom: 0.4rem; }
    .comparison-4 .panel.failed { border-color: #ef9a9a; background: #ffebee; }
    .comparison-4 .panel .error-msg { font-size: 0.8rem; color: #c62828; }
    @media (max-width: 900px) {
      .comparison-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 700px) {
      .comparison { grid-template-columns: 1fr; }
      .comparison-4 { grid-template-columns: 1fr; }
    }
  `;
}
/**
 * Renders the collapsed "Blend mode configuration" textarea block used on both
 * the upload form and the blend results page (where it's paired with a retry
 * button).
 *
 * The container intentionally has no <form> wrapper — the caller decides whether
 * the inputs are submitted as part of an existing form (upload page) or wrapped
 * in their own retry form (results page).
 */
function renderBlendConfigInputs(defaults, options = {}) {
    const openAttr = options.open ? ' open' : '';
    const disabledAttr = options.disabled ? ' disabled' : '';
    return `<details class="blend-config" data-testid="blend-config-details"${openAttr}>
    <summary>Blend mode configuration <span class="label-hint">(only used when method = Blend)</span></summary>

    <label for="blendOverlayPrompt">Step 1 — Overlay prompt <span class="label-hint">(JSON annotation request)</span></label>
    <textarea
      id="blendOverlayPrompt"
      name="blendOverlayPrompt"
      rows="8"
      data-testid="blend-config-overlay-prompt"${disabledAttr}>${esc(defaults.overlayPrompt)}</textarea>

    <label for="blendOverlaySchema">Step 1 — Response schema <span class="label-hint">(JSON; passed as Gemini responseSchema)</span></label>
    <textarea
      id="blendOverlaySchema"
      name="blendOverlaySchema"
      rows="12"
      data-testid="blend-config-overlay-schema"${disabledAttr}>${esc(defaults.overlaySchema)}</textarea>

    <label for="blendRenderPrompt">Step 2 — Render prompt <span class="label-hint">(use {annotations_json} placeholder)</span></label>
    <textarea
      id="blendRenderPrompt"
      name="blendRenderPrompt"
      rows="8"
      data-testid="blend-config-render-prompt"${disabledAttr}>${esc(defaults.renderPrompt)}</textarea>
  </details>`;
}
function renderHintFormHtml(input) {
    const configBlock = input.configReady
        ? `<div class="notice ok" data-testid="hint-config-ready">Config ready. GEMINI_API_KEY is set.</div>`
        : `<div class="notice error" data-testid="hint-config-missing">Missing config: ${esc((input.missingKeys ?? []).join(', '))}</div>`;
    const disabled = input.configReady ? '' : ' disabled';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hint Annotator</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Hint Annotator</h1>
  <div class="nav">
    <a href="/run">\u2190 Question Pipeline</a> |
    <a href="/run-diagrams">Diagram Cropper</a> |
    <a href="/prompt-edit">Edit Prompts</a>
  </div>
  <p>Upload a cropped diagram PNG. Gemini will annotate it with red marker lines showing the first step to solving the problem.</p>
  ${configBlock}
  <form method="POST" action="/run-hints" enctype="multipart/form-data" data-testid="hint-upload-form">
    <label for="imageFile">Diagram PNG</label>
    <input id="imageFile" name="imageFile" type="file" accept="image/png,.png" data-testid="hint-image-file"${disabled}>

    <label for="hintText">Hint (optional)</label>
    <input id="hintText" name="hintText" type="text" placeholder="e.g. Draw a line from A to J to show the cross-section" data-testid="hint-text-input"${disabled}>

    <div class="method-group">
      <strong>Annotation method:</strong>
      <div class="method-option">
        <input type="radio" id="method-overlay" name="method" value="overlay" checked${disabled}>
        <label for="method-overlay">Canvas Overlay (safest)</label>
        <div class="method-desc">JSON annotations drawn on the original PNG with Canvas. Pixel-perfect diagram fidelity.</div>
      </div>
      <div class="method-option">
        <input type="radio" id="method-image-gen" name="method" value="image-gen"${disabled}>
        <label for="method-image-gen">Image Generation</label>
        <div class="method-desc">Single Gemini call generates the annotated image. Natural hand-drawn look, but diagram is regenerated.</div>
      </div>
      <div class="method-option">
        <input type="radio" id="method-blend" name="method" value="blend"${disabled}>
        <label for="method-blend">Blend</label>
        <div class="method-desc">Two-step: JSON reasoning + image generation with specific instructions. Best-looking but slowest.</div>
      </div>
    </div>

    ${renderBlendConfigInputs(input.blendDefaults, { disabled: !input.configReady })}

    <div class="notice warn">Maximum upload size: ${input.maxUploadMb} MB.</div>

    <button type="submit" data-testid="hint-start-button"${disabled}>Annotate Diagram</button>
    <button type="submit" name="method" value="all" data-testid="hint-run-all-button"${disabled} style="margin-left: 0.75rem;">Run All Three Methods</button>
  </form>
</body>
</html>`;
}
function renderLogsBlock(record) {
    if (record.logs.length === 0) {
        return 'No logs yet.';
    }
    return record.logs
        .map((entry) => `[${entry.timestamp}] ${entry.stage}: ${entry.message}`)
        .join('\n');
}
function renderHintStatusHtml(record) {
    const shouldRefresh = record.status === 'queued' || record.status === 'running';
    const meta = shouldRefresh ? '<meta http-equiv="refresh" content="2">' : '';
    let resultBlock;
    if (record.status === 'succeeded') {
        resultBlock = `<div class="notice ok" data-testid="hint-run-succeeded">Annotation complete.</div>`;
    }
    else if (record.status === 'failed') {
        resultBlock = `<div class="notice error" data-testid="hint-run-failed">Run failed: ${esc(record.error ?? 'Unknown error')}</div>`;
    }
    else {
        resultBlock = `<div class="notice warn" data-testid="hint-run-in-progress">Run is ${esc(record.status)}. This page refreshes every 2 seconds.</div>`;
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${meta}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hint Run \u2014 ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Hint Run</h1>
  <div class="nav">
    <a href="/run-hints">Annotate Another</a> |
    <a href="/run">Question Pipeline</a>
  </div>
  <p><strong>Status:</strong> <span data-testid="hint-run-status">${esc(record.status)}</span></p>
  ${record.imageFileName ? `<p><strong>Source:</strong> ${esc(record.imageFileName)}</p>` : ''}
  ${record.method ? `<p><strong>Method:</strong> ${esc(record.method)}</p>` : ''}
  ${record.hintText ? `<p><strong>Hint:</strong> ${esc(record.hintText)}</p>` : ''}
  ${resultBlock}
  <h2>Logs</h2>
  <pre class="logs" data-testid="hint-run-logs">${esc(renderLogsBlock(record))}</pre>
</body>
</html>`;
}
function renderHintResultsHtml(record, blendDefaults) {
    const result = record.result;
    if (!result) {
        return renderHintStatusHtml(record);
    }
    const methodLabel = result.method === 'overlay' ? 'Canvas Overlay' :
        result.method === 'image-gen' ? 'Image Generation' :
            result.method === 'blend' ? 'Blend' : result.method;
    const blendRetryBlock = result.method === 'blend' && blendDefaults
        ? `
  <h2>Retry with edited blend config</h2>
  <p>Edit the prompts or response schema and re-run blend on the same source image. The schema must be valid JSON.</p>
  <form method="POST" action="/hint-runs/${esc(record.id)}/retry" data-testid="hint-blend-retry-form">
    ${renderBlendConfigInputs({
            overlayPrompt: record.blendOverlayPrompt ?? blendDefaults.overlayPrompt,
            overlaySchema: record.blendOverlaySchema ?? blendDefaults.overlaySchema,
            renderPrompt: record.blendRenderPrompt ?? blendDefaults.renderPrompt,
        }, { open: true })}
    <button type="submit" data-testid="hint-blend-retry-button">Retry blend with these settings</button>
  </form>`
        : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hint Results \u2014 ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Hint Results</h1>
  <div class="nav">
    <a href="/run-hints">Annotate Another</a> |
    <a href="/run">Question Pipeline</a> |
    <a href="/run-diagrams">Diagram Cropper</a>
  </div>
  ${record.imageFileName ? `<p><strong>Source:</strong> ${esc(record.imageFileName)}</p>` : ''}
  <p><strong>Method:</strong> ${esc(methodLabel)}</p>
  ${record.hintText ? `<p><strong>Hint:</strong> ${esc(record.hintText)}</p>` : ''}

  <div class="notice ok" data-testid="hint-run-succeeded">Annotation complete.</div>

  <div class="notice info">Review annotations for accuracy before sharing with students.</div>

  <h2>Comparison</h2>
  <div class="comparison">
    <div class="panel">
      <div class="panel-title">Original</div>
      <img src="/hint-runs/${esc(record.id)}/source" alt="Original diagram" data-testid="hint-source-image">
    </div>
    <div class="panel">
      <div class="panel-title">Annotated</div>
      <img src="/hint-runs/${esc(record.id)}/result" alt="Annotated diagram" data-testid="hint-result-image">
    </div>
  </div>

  <p style="margin-top: 1rem;"><a href="/hint-runs/${esc(record.id)}/result" download="annotated.png" data-testid="hint-download-link">Download annotated image</a></p>
${blendRetryBlock}

  <h2>Logs</h2>
  <pre class="logs" data-testid="hint-run-logs">${esc(renderLogsBlock(record))}</pre>
</body>
</html>`;
}
function renderHintAllResultsHtml(record) {
    const allResults = record.allResults;
    if (!allResults) {
        return renderHintStatusHtml(record);
    }
    const methods = [
        { key: 'overlay', label: 'Canvas Overlay' },
        { key: 'image-gen', label: 'Image Generation' },
        { key: 'blend', label: 'Blend' },
    ];
    const successCount = methods.filter((m) => allResults[m.key]).length;
    const failCount = methods.length - successCount;
    const summary = `<div class="notice ok" data-testid="hint-all-summary">${successCount} of 3 methods succeeded${failCount > 0 ? `, ${failCount} failed` : ''}.</div>`;
    const panels = [];
    // Original panel
    panels.push(`
    <div class="panel">
      <div class="panel-title">Original</div>
      <img src="/hint-runs/${esc(record.id)}/source" alt="Original diagram" data-testid="hint-all-source">
    </div>
  `);
    // One panel per method
    for (const m of methods) {
        const result = allResults[m.key];
        if (result) {
            panels.push(`
        <div class="panel">
          <div class="panel-title">${esc(m.label)}</div>
          <img src="/hint-runs/${esc(record.id)}/result/${esc(m.key)}" alt="${esc(m.label)}" data-testid="hint-all-result-${esc(m.key)}">
          <div style="margin-top: 0.4rem; font-size: 0.8rem;"><a href="/hint-runs/${esc(record.id)}/result/${esc(m.key)}" download="${esc(m.key)}-annotated.png">Download</a></div>
        </div>
      `);
        }
        else {
            panels.push(`
        <div class="panel failed">
          <div class="panel-title">${esc(m.label)}</div>
          <div class="error-msg">This method failed.</div>
        </div>
      `);
        }
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hint Results (All Three) \u2014 ${esc(record.id)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <h1>Hint Results \u2014 All Three Methods</h1>
  <div class="nav">
    <a href="/run-hints">Annotate Another</a> |
    <a href="/run">Question Pipeline</a> |
    <a href="/run-diagrams">Diagram Cropper</a>
  </div>
  ${record.imageFileName ? `<p><strong>Source:</strong> ${esc(record.imageFileName)}</p>` : ''}
  ${record.hintText ? `<p><strong>Hint:</strong> ${esc(record.hintText)}</p>` : ''}

  ${summary}

  <div class="notice info">Review annotations for accuracy before sharing with students.</div>

  <h2>Comparison</h2>
  <div class="comparison-4">${panels.join('')}</div>

  <h2>Logs</h2>
  <pre class="logs" data-testid="hint-run-logs">${esc(renderLogsBlock(record))}</pre>
</body>
</html>`;
}
function renderHintErrorHtml(title, message) {
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
  <div class="notice error" data-testid="hint-error">${esc(message)}</div>
  <div class="nav"><a href="/run-hints">Back to Hint Annotator</a></div>
</body>
</html>`;
}
//# sourceMappingURL=hint-renderer.js.map