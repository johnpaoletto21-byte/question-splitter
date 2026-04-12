import type { PreparedPageImage } from '../../core/source-model/types';
import type { SegmentationResult } from '../../core/segmentation-contract/types';
import type { SegmentationTarget } from '../../core/segmentation-contract/types';
export interface SegmentationPageWindow {
    focusPageNumber: number;
    pages: PreparedPageImage[];
}
export declare function buildSegmentationPageWindows(pages: ReadonlyArray<PreparedPageImage>): SegmentationPageWindow[];
export declare function selectLocalizationContextPages(target: SegmentationTarget, pages: ReadonlyArray<PreparedPageImage>): PreparedPageImage[];
export declare function getAllowedSegmentationRegionPageNumbers(focusPageNumber: number): number[];
export declare function mergeWindowedSegmentationResults(runId: string, results: ReadonlyArray<SegmentationResult>): SegmentationResult;
//# sourceMappingURL=page-windows.d.ts.map