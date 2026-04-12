import {
  buildSegmentationPageWindows,
  getAllowedSegmentationRegionPageNumbers,
  mergeWindowedSegmentationResults,
  selectLocalizationContextPages,
} from '../page-windows';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';

function page(pageNumber: number): PreparedPageImage {
  return {
    source_id: 'src',
    page_number: pageNumber,
    image_path: `/tmp/page_${pageNumber}.png`,
    image_width: 100,
    image_height: 100,
  };
}

describe('page window helpers', () => {
  it('builds first, middle, and last segmentation windows', () => {
    const windows = buildSegmentationPageWindows([page(1), page(2), page(3)]);
    expect(windows.map((window) => ({
      focus: window.focusPageNumber,
      pages: window.pages.map((p) => p.page_number),
    }))).toEqual([
      { focus: 1, pages: [1, 2] },
      { focus: 2, pages: [1, 2, 3] },
      { focus: 3, pages: [2, 3] },
    ]);
  });

  it('handles one-page PDFs', () => {
    const windows = buildSegmentationPageWindows([page(1)]);
    expect(windows).toHaveLength(1);
    expect(windows[0].focusPageNumber).toBe(1);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1]);
  });

  it('builds allowed output region pages for focus windows', () => {
    expect(getAllowedSegmentationRegionPageNumbers(1)).toEqual([1]);
    expect(getAllowedSegmentationRegionPageNumbers(5)).toEqual([4, 5]);
  });

  it('selects only previous and finish page for localization context', () => {
    const target: SegmentationTarget = {
      target_id: 'q_0001',
      target_type: 'question',
      finish_page_number: 2,
      regions: [{ page_number: 2 }],
    };

    expect(selectLocalizationContextPages(target, [page(1), page(2), page(3)])
      .map((p) => p.page_number)).toEqual([1, 2]);
  });

  it('selects only page 1 for first-page targets', () => {
    const target: SegmentationTarget = {
      target_id: 'q_0001',
      target_type: 'question',
      finish_page_number: 1,
      regions: [{ page_number: 1 }],
    };

    expect(selectLocalizationContextPages(target, [page(1), page(2)])
      .map((p) => p.page_number)).toEqual([1]);
  });

  it('merges window results and reassigns global target ids', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 1 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 2 }] }],
      },
    ]);

    expect(result.targets.map((target) => target.target_id)).toEqual(['q_0001', 'q_0002']);
  });
});
