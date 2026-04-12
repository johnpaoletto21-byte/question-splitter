"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSegmentationPageWindows = buildSegmentationPageWindows;
exports.selectLocalizationContextPages = selectLocalizationContextPages;
exports.getAllowedSegmentationRegionPageNumbers = getAllowedSegmentationRegionPageNumbers;
exports.mergeWindowedSegmentationResults = mergeWindowedSegmentationResults;
function byPageNumber(a, b) {
    return a.page_number - b.page_number;
}
function makeTargetId(index) {
    return `q_${String(index + 1).padStart(4, '0')}`;
}
function buildSegmentationPageWindows(pages) {
    const sorted = [...pages].sort(byPageNumber);
    return sorted.map((focusPage, index) => ({
        focusPageNumber: focusPage.page_number,
        pages: [
            ...(index > 0 ? [sorted[index - 1]] : []),
            focusPage,
            ...(index < sorted.length - 1 ? [sorted[index + 1]] : []),
        ],
    }));
}
function selectLocalizationContextPages(target, pages) {
    const sorted = [...pages].sort(byPageNumber);
    const finishPage = target.finish_page_number ??
        Math.max(...target.regions.map((region) => region.page_number));
    const wanted = new Set([finishPage - 1, finishPage]);
    return sorted.filter((page) => wanted.has(page.page_number));
}
function getAllowedSegmentationRegionPageNumbers(focusPageNumber) {
    return focusPageNumber === 1
        ? [1]
        : [focusPageNumber - 1, focusPageNumber];
}
function mergeWindowedSegmentationResults(runId, results) {
    const targets = [];
    for (const result of results) {
        for (const target of result.targets) {
            targets.push({
                ...target,
                target_id: makeTargetId(targets.length),
            });
        }
    }
    return { run_id: runId, targets };
}
//# sourceMappingURL=page-windows.js.map