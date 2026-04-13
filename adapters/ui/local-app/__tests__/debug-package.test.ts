import { renderRunDebugMarkdown } from '../debug-package';
import type { LocalRunRecord } from '../run-state';
import type { LocalConfig } from '../../../config/local-config/types';

describe('renderRunDebugMarkdown', () => {
  it('renders run details, logs, models, summary, and redacted config', () => {
    const record: LocalRunRecord = {
      id: 'local_run_debug',
      status: 'failed',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:01.000Z',
      logs: [{ timestamp: '2024-01-01T00:00:01.000Z', stage: 'agent', message: 'model error' }],
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
      promptSnapshot: {
        agent1Prompt: 'Saved segmenter prompt',
        reviewerPrompt: 'Saved reviewer prompt',
        agent2Prompt: 'Saved localizer prompt',
        deduplicatorPrompt: 'Saved deduplicator prompt',
        capturedAt: '2024-01-01T00:00:00.000Z',
      },
      error: 'Gemini failed',
      failureContext: {
        chunk: {
          chunkIndex: 0,
          startPage: 4,
          endPage: 6,
        },
      },
    };
    const config: LocalConfig = {
      GEMINI_API_KEY: 'secret-key',
      DRIVE_FOLDER_ID: 'folder',
      OAUTH_TOKEN_PATH: '/tmp/token.json',
      OUTPUT_DIR: '/tmp/out',
    };

    const markdown = renderRunDebugMarkdown({ record, config });
    expect(markdown).toContain('# Question Cropper Debug Package');
    expect(markdown).toContain('local_run_debug');
    expect(markdown).toContain('gemini-3.1-flash-lite-preview');
    expect(markdown).toContain('## Prompt Snapshot');
    expect(markdown).toContain('Saved segmenter prompt');
    expect(markdown).toContain('Saved localizer prompt');
    expect(markdown).toContain('has_diagram');
    expect(markdown).toContain('chunkIndex');
    expect(markdown).toContain('startPage');
    expect(markdown).toContain('model error');
    expect(markdown).toContain('[REDACTED]');
    expect(markdown).not.toContain('secret-key');
  });
});
