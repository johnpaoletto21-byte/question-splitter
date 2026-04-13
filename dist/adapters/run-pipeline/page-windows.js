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
function getPageSet(target) {
    return new Set(target.regions.map((r) => r.page_number));
}
function isStrictSubset(a, b) {
    if (a.size >= b.size)
        return false;
    for (const page of a) {
        if (!b.has(page))
            return false;
    }
    return true;
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
    const wanted = new Set(target.regions.map((region) => region.page_number));
    return sorted.filter((page) => wanted.has(page.page_number));
}
function getAllowedSegmentationRegionPageNumbers(focusPageNumber) {
    return focusPageNumber === 1
        ? [1]
        : [focusPageNumber - 1, focusPageNumber];
}
function mergeWindowedSegmentationResults(runId, results) {
    const collected = [];
    for (const result of results) {
        for (const target of result.targets) {
            collected.push(target);
        }
    }
    // Remove ghost targets: if target A's pages are a strict subset of target B's
    // pages, A is likely a truncated duplicate produced by a window that couldn't
    // see the full page span. Keep the wider target, discard the subset.
    const pageSets = collected.map(getPageSet);
    const deduped = collected.filter((_, i) => {
        for (let j = 0; j < collected.length; j++) {
            if (i !== j && isStrictSubset(pageSets[i], pageSets[j])) {
                return false;
            }
        }
        return true;
    });
    // Reassign sequential target_ids after dedup.
    const targets = deduped.map((target, index) => ({
        ...target,
        target_id: makeTargetId(index),
    }));
    return { run_id: runId, targets };
}
//# sourceMappingURL=page-windows.js.map