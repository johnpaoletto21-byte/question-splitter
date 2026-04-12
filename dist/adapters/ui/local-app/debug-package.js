"use strict";
/**
 * adapters/ui/local-app/debug-package.ts
 *
 * Markdown debug package generation for one in-memory local run.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderRunDebugMarkdown = renderRunDebugMarkdown;
const segmenter_1 = require("../../segmentation/gemini-segmenter/segmenter");
const localizer_1 = require("../../localization/gemini-localizer/localizer");
function redactConfig(config) {
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
function fencedJson(value) {
    return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
}
function renderRunDebugMarkdown(input) {
    const { record } = input;
    const lines = [];
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
        outputDir: record.outputDir,
        extractionFields: record.extractionFields,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        error: record.error,
        failureContext: record.failureContext,
    }));
    lines.push('');
    lines.push(`## Gemini Models`);
    lines.push(fencedJson({
        agent1Segmenter: segmenter_1.DEFAULT_GEMINI_SEGMENTER_MODEL,
        agent2Localizer: localizer_1.DEFAULT_GEMINI_LOCALIZER_MODEL,
    }));
    lines.push('');
    lines.push(`## Prompt Snapshot`);
    lines.push(record.promptSnapshot ? fencedJson(record.promptSnapshot) : 'No prompt snapshot captured for this run.');
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
    }
    else {
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
//# sourceMappingURL=debug-package.js.map