import { renderRunFormHtml, renderRunStatusHtml } from '../run-renderer';
import type { LocalRunRecord } from '../run-state';

function makeRecord(overrides: Partial<LocalRunRecord> = {}): LocalRunRecord {
  return {
    id: 'local_run_test',
    status: 'running',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:01.000Z',
    logs: [{ timestamp: '2024-01-01T00:00:01.000Z', stage: 'render', message: 'Rendered pages' }],
    ...overrides,
  };
}

describe('renderRunFormHtml', () => {
  it('renders PDF file picker, run button, and prompt editor link', () => {
    const html = renderRunFormHtml({ configReady: true, maxUploadMb: 50 });
    expect(html).toContain('data-testid="run-upload-form"');
    expect(html).toContain('type="file"');
    expect(html).toContain('name="pdfFile"');
    expect(html).toContain('data-testid="run-start-button"');
    expect(html).toContain('href="/prompt-edit"');
  });

  it('shows missing config and disables upload controls', () => {
    const html = renderRunFormHtml({
      configReady: false,
      missingKeys: ['GEMINI_API_KEY'],
      maxUploadMb: 50,
    });
    expect(html).toContain('data-testid="run-config-missing"');
    expect(html).toContain('GEMINI_API_KEY');
    expect(html).toContain('data-testid="run-start-button" disabled');
  });
});

describe('renderRunStatusHtml', () => {
  it('renders running status and logs', () => {
    const html = renderRunStatusHtml(makeRecord());
    expect(html).toContain('data-testid="run-status">running');
    expect(html).toContain('Rendered pages');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('data-testid="run-debug-download-link"');
    expect(html).toContain('/runs/local_run_test/debug.md');
  });

  it('renders summary link on success', () => {
    const html = renderRunStatusHtml(makeRecord({ status: 'succeeded' }));
    expect(html).toContain('data-testid="run-succeeded"');
    expect(html).toContain('/runs/local_run_test/summary');
  });

  it('renders failure message on failure', () => {
    const html = renderRunStatusHtml(makeRecord({ status: 'failed', error: 'Gemini failed' }));
    expect(html).toContain('data-testid="run-failed"');
    expect(html).toContain('Gemini failed');
  });
});
