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

  it('selects only target region pages for localization context', () => {
    const target: SegmentationTarget = {
      target_id: 'q_0001',
      target_type: 'question',
      finish_page_number: 2,
      regions: [{ page_number: 2 }],
    };

    expect(selectLocalizationContextPages(target, [page(1), page(2), page(3)])
      .map((p) => p.page_number)).toEqual([2]);
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

  it('selects both region pages for a two-page target', () => {
    const target: SegmentationTarget = {
      target_id: 'q_0001',
      target_type: 'question',
      finish_page_number: 3,
      regions: [{ page_number: 2 }, { page_number: 3 }],
    };

    expect(selectLocalizationContextPages(target, [page(1), page(2), page(3), page(4)])
      .map((p) => p.page_number)).toEqual([2, 3]);
  });

  it('excludes non-region pages from localization context', () => {
    const target: SegmentationTarget = {
      target_id: 'q_0001',
      target_type: 'question',
      finish_page_number: 6,
      regions: [{ page_number: 6 }],
    };

    // Page 5 is NOT in the target's regions, should not be included
    expect(selectLocalizationContextPages(target, [page(4), page(5), page(6), page(7)])
      .map((p) => p.page_number)).toEqual([6]);
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

  it('removes ghost single-page target when multi-page target covers same page', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }, { page_number: 6 }] }],
      },
    ]);

    expect(result.targets).toHaveLength(1);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[0].regions.map((r) => r.page_number)).toEqual([5, 6]);
  });

  it('keeps both multi-page targets that share one page but are not subsets', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }, { page_number: 6 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 6 }, { page_number: 7 }] }],
      },
    ]);

    expect(result.targets).toHaveLength(2);
    expect(result.targets[0].regions.map((r) => r.page_number)).toEqual([5, 6]);
    expect(result.targets[1].regions.map((r) => r.page_number)).toEqual([6, 7]);
  });

  it('removes multiple ghosts in one pass', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }, { page_number: 6 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 8 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 8 }, { page_number: 9 }] }],
      },
    ]);

    expect(result.targets).toHaveLength(2);
    expect(result.targets[0].regions.map((r) => r.page_number)).toEqual([5, 6]);
    expect(result.targets[1].regions.map((r) => r.page_number)).toEqual([8, 9]);
  });

  it('keeps non-overlapping single-page targets', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 3 }] }],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 4 }] }],
      },
    ]);

    expect(result.targets).toHaveLength(2);
  });

  it('reassigns target_ids sequentially after dedup', () => {
    const result = mergeWindowedSegmentationResults('run_test', [
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 3 }] }],
      },
      {
        run_id: 'run_test',
        targets: [
          { target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 3 }] },
          { target_id: 'q_0002', target_type: 'question', regions: [{ page_number: 3 }, { page_number: 4 }] },
        ],
      },
      {
        run_id: 'run_test',
        targets: [{ target_id: 'q_0001', target_type: 'question', regions: [{ page_number: 5 }] }],
      },
    ]);

    // First page-3-only ghost removed (subset of [3,4]), second page-3-only kept (duplicate pages, same size set — not a strict subset)
    // Actually both page-3-only targets are strict subsets of [3,4], so both removed
    expect(result.targets).toHaveLength(2);
    expect(result.targets.map((t) => t.target_id)).toEqual(['q_0001', 'q_0002']);
  });
});
