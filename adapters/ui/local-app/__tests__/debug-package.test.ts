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
      error: 'Gemini failed',
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
    expect(markdown).toContain('model error');
    expect(markdown).toContain('[REDACTED]');
    expect(markdown).not.toContain('secret-key');
  });
});
