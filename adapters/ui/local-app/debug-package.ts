/**
 * adapters/ui/local-app/debug-package.ts
 *
 * Markdown debug package generation for one in-memory local run.
 */

import type { LocalConfig } from '../../config/local-config/types';
import { DEFAULT_GEMINI_SEGMENTER_MODEL } from '../../segmentation/gemini-segmenter/segmenter';
import { DEFAULT_GEMINI_LOCALIZER_MODEL } from '../../localization/gemini-localizer/localizer';
import type { LocalRunRecord } from './run-state';

function redactConfig(config?: LocalConfig): Record<string, unknown> {
  if (!config) {
    return { status: 'unavailable' };
  }

  return {
    GEMINI_API_KEY: config.GEMINI_API_KEY ? '[REDACTED]' : '',
    DRIVE_FOLDER_ID: config.DRIVE_FOLDER_ID,
    OAUTH_TOKEN_PATH: config.OAUTH_TOKEN_PATH,
    OUTPUT_DIR: config.OUTPUT_DIR,
  };
}

function fencedJson(value: unknown): string {
  return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
}

export function renderRunDebugMarkdown(input: {
  record: LocalRunRecord;
  config?: LocalConfig;
  configError?: string;
}): string {
  const { record } = input;
  const lines: string[] = [];

  lines.push(`# Question Cropper Debug Package`);
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');

  lines.push(`## Run`);
  lines.push(fencedJson({
    id: record.id,
    status: record.status,
    runLabel: record.runLabel,
    pdfFileName: record.pdfFileName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    error: record.error,
  }));
  lines.push('');

  lines.push(`## Gemini Models`);
  lines.push(fencedJson({
    agent1Segmenter: DEFAULT_GEMINI_SEGMENTER_MODEL,
    agent2Localizer: DEFAULT_GEMINI_LOCALIZER_MODEL,
  }));
  lines.push('');

  lines.push(`## Config`);
  lines.push(fencedJson({
    config: redactConfig(input.config),
    configError: input.configError,
  }));
  lines.push('');

  lines.push(`## Logs`);
  if (record.logs.length === 0) {
    lines.push('No logs captured.');
  } else {
    for (const entry of record.logs) {
      lines.push(`- ${entry.timestamp} [${entry.stage}] ${entry.message}`);
    }
  }
  lines.push('');

  lines.push(`## Summary`);
  lines.push(record.summary ? fencedJson(record.summary) : 'No summary captured.');
  lines.push('');

  lines.push(`## Notes`);
  lines.push('- Provider request/response payloads are not captured by the current app.');
  lines.push('- Gemini API keys are redacted.');
  lines.push('- OAuth access token contents are not read into this package.');
  lines.push('');

  return lines.join('\n');
}
