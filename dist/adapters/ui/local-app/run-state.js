"use strict";
/**
 * adapters/ui/local-app/run-state.ts
 *
 * In-memory run state for the single-user local app.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRunRecord = createRunRecord;
exports.getRunRecord = getRunRecord;
exports.appendRunLog = appendRunLog;
exports.markRunStatus = markRunStatus;
exports.markRunSucceeded = markRunSucceeded;
exports.markRunFailed = markRunFailed;
exports.resetRunRecordsForTests = resetRunRecordsForTests;
exports.createDiagramRunRecord = createDiagramRunRecord;
exports.getDiagramRunRecord = getDiagramRunRecord;
exports.appendDiagramRunLog = appendDiagramRunLog;
exports.markDiagramRunStatus = markDiagramRunStatus;
exports.markDiagramRunSucceeded = markDiagramRunSucceeded;
exports.markDiagramRunFailed = markDiagramRunFailed;
exports.createHintRunRecord = createHintRunRecord;
exports.getHintRunRecord = getHintRunRecord;
exports.appendHintRunLog = appendHintRunLog;
exports.markHintRunStatus = markHintRunStatus;
exports.markHintRunSucceeded = markHintRunSucceeded;
exports.markHintRunAllSucceeded = markHintRunAllSucceeded;
exports.markHintRunFailed = markHintRunFailed;
const runs = new Map();
function nowIso() {
    return new Date().toISOString();
}
function makeRunId() {
    const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return `local_run_${Date.now()}_${random}`;
}
function createRunRecord(input) {
    const timestamp = nowIso();
    const record = {
        id: makeRunId(),
        status: 'queued',
        runLabel: input.runLabel,
        pdfFileName: input.pdfFileName,
        pdfFilePath: input.pdfFilePath,
        outputDir: input.outputDir,
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: [],
        extractionFields: input.extractionFields ?? [],
        promptSnapshot: input.promptSnapshot,
    };
    runs.set(record.id, record);
    return record;
}
function getRunRecord(id) {
    return runs.get(id);
}
function appendRunLog(id, stage, message, timestamp = nowIso()) {
    const record = runs.get(id);
    if (!record) {
        return;
    }
    record.logs.push({ stage, message, timestamp });
    record.updatedAt = timestamp;
}
function markRunStatus(id, status) {
    const record = runs.get(id);
    if (!record) {
        return;
    }
    record.status = status;
    record.updatedAt = nowIso();
}
function markRunSucceeded(id, summary) {
    const record = runs.get(id);
    if (!record) {
        return;
    }
    record.status = 'succeeded';
    record.summary = summary;
    record.updatedAt = nowIso();
}
function markRunFailed(id, error, failureContext) {
    const record = runs.get(id);
    if (!record) {
        return;
    }
    record.status = 'failed';
    record.error = error;
    record.failureContext = failureContext;
    record.updatedAt = nowIso();
}
function resetRunRecordsForTests() {
    runs.clear();
    diagramRuns.clear();
    hintRuns.clear();
}
const diagramRuns = new Map();
function makeDiagramRunId() {
    const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return `local_diagram_run_${Date.now()}_${random}`;
}
function createDiagramRunRecord(input) {
    const timestamp = nowIso();
    const record = {
        id: makeDiagramRunId(),
        status: 'queued',
        imageFileName: input.imageFileName,
        imageFilePath: input.imageFilePath,
        outputDir: input.outputDir,
        runOutputDir: input.runOutputDir,
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: [],
    };
    diagramRuns.set(record.id, record);
    return record;
}
function getDiagramRunRecord(id) {
    return diagramRuns.get(id);
}
function appendDiagramRunLog(id, stage, message, timestamp = nowIso()) {
    const record = diagramRuns.get(id);
    if (!record) {
        return;
    }
    record.logs.push({ stage, message, timestamp });
    record.updatedAt = timestamp;
}
function markDiagramRunStatus(id, status) {
    const record = diagramRuns.get(id);
    if (!record) {
        return;
    }
    record.status = status;
    record.updatedAt = nowIso();
}
function markDiagramRunSucceeded(id, result) {
    const record = diagramRuns.get(id);
    if (!record) {
        return;
    }
    record.status = 'succeeded';
    record.result = result;
    record.updatedAt = nowIso();
}
function markDiagramRunFailed(id, error) {
    const record = diagramRuns.get(id);
    if (!record) {
        return;
    }
    record.status = 'failed';
    record.error = error;
    record.updatedAt = nowIso();
}
const hintRuns = new Map();
function makeHintRunId() {
    const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return `local_hint_run_${Date.now()}_${random}`;
}
function createHintRunRecord(input) {
    const timestamp = nowIso();
    const record = {
        id: makeHintRunId(),
        status: 'queued',
        imageFileName: input.imageFileName,
        imageFilePath: input.imageFilePath,
        hintText: input.hintText,
        method: input.method,
        outputDir: input.outputDir,
        runOutputDir: input.runOutputDir,
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: [],
        blendOverlayPrompt: input.blendOverlayPrompt,
        blendOverlaySchema: input.blendOverlaySchema,
        blendRenderPrompt: input.blendRenderPrompt,
    };
    hintRuns.set(record.id, record);
    return record;
}
function getHintRunRecord(id) {
    return hintRuns.get(id);
}
function appendHintRunLog(id, stage, message, timestamp = nowIso()) {
    const record = hintRuns.get(id);
    if (!record) {
        return;
    }
    record.logs.push({ stage, message, timestamp });
    record.updatedAt = timestamp;
}
function markHintRunStatus(id, status) {
    const record = hintRuns.get(id);
    if (!record) {
        return;
    }
    record.status = status;
    record.updatedAt = nowIso();
}
function markHintRunSucceeded(id, result) {
    const record = hintRuns.get(id);
    if (!record) {
        return;
    }
    record.status = 'succeeded';
    record.result = result;
    record.updatedAt = nowIso();
}
function markHintRunAllSucceeded(id, allResults) {
    const record = hintRuns.get(id);
    if (!record) {
        return;
    }
    record.status = 'succeeded';
    record.allResults = allResults;
    record.updatedAt = nowIso();
}
function markHintRunFailed(id, error) {
    const record = hintRuns.get(id);
    if (!record) {
        return;
    }
    record.status = 'failed';
    record.error = error;
    record.updatedAt = nowIso();
}
//# sourceMappingURL=run-state.js.map