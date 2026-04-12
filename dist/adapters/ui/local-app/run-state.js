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
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: [],
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
function markRunFailed(id, error) {
    const record = runs.get(id);
    if (!record) {
        return;
    }
    record.status = 'failed';
    record.error = error;
    record.updatedAt = nowIso();
}
function resetRunRecordsForTests() {
    runs.clear();
}
//# sourceMappingURL=run-state.js.map