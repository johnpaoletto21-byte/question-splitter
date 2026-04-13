/**
 * core/run-orchestrator/__tests__/localization-step.test.ts
 *
 * Unit tests for assembleLocalizationResults.
 *
 * Proves:
 *   - Basic assembly: window regions are grouped by question_number and
 *     matched to segmentation targets to produce LocalizationResult[].
 *   - Centrality-based dedup: when the same page appears in overlapping
 *     windows, the bbox from the more central window is kept.
 *   - Questions not found in any window are omitted from results.
 *   - Regions are sorted by page_number ascending.
 *   - target_id comes from the matched SegmentationTarget.
 */

import { assembleLocalizationResults, padBbox } from '../localization-step';
import type { WindowLocalizationResult } from '../localization-step';
import type { SegmentationTarget } from '../../segmentation-contract/types';
import type { PreparedPageImage } from '../../source-model/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(qn: string, targetId?: string): SegmentationTarget {
  return {
    target_id: targetId ?? `q_${qn.padStart(4, '0')}`,
    target_type: 'question',
    question_number: qn,
  };
}

function makePage(pageNumber: number): PreparedPageImage {
  return {
    source_id: 'src_0001_test',
    page_number: pageNumber,
    image_path: `/tmp/page_${pageNumber}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

function makeWindowResult(
  regions: Array<{ question_number: string; page_number: number; bbox_1000: [number, number, number, number] }>,
): WindowLocalizationResult {
  return {
    run_id: 'run_test',
    regions,
  };
}

// ---------------------------------------------------------------------------
// Basic assembly
// ---------------------------------------------------------------------------

describe('assembleLocalizationResults — basic assembly', () => {
  it('groups regions by question_number and produces one LocalizationResult per target', () => {
    const questions = [makeQuestion('1'), makeQuestion('2')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 1000] },
        { question_number: '2', page_number: 1, bbox_1000: [500, 0, 1000, 1000] },
      ]),
    ];
    const windows = [{ pages: [makePage(1), makePage(2), makePage(3)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results).toHaveLength(2);
    expect(results[0].target_id).toBe('q_0001');
    expect(results[0].regions).toHaveLength(1);
    expect(results[0].regions[0].page_number).toBe(1);
    expect(results[1].target_id).toBe('q_0002');
  });

  it('collects regions from multiple windows for the same question', () => {
    const questions = [makeQuestion('1')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 1000, 1000] },
      ]),
      makeWindowResult([
        { question_number: '1', page_number: 2, bbox_1000: [0, 0, 500, 1000] },
      ]),
    ];
    const windows = [
      { pages: [makePage(1), makePage(2), makePage(3)] },
      { pages: [makePage(2), makePage(3), makePage(4)] },
    ];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results).toHaveLength(1);
    expect(results[0].regions).toHaveLength(2);
    expect(results[0].regions[0].page_number).toBe(1);
    expect(results[0].regions[1].page_number).toBe(2);
  });

  it('sorts regions by page_number ascending', () => {
    const questions = [makeQuestion('1')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 3, bbox_1000: [0, 0, 500, 500] },
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1), makePage(2), makePage(3)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results[0].regions[0].page_number).toBe(1);
    expect(results[0].regions[1].page_number).toBe(3);
  });

  it('uses target_id from the matched SegmentationTarget', () => {
    const questions = [makeQuestion('1', 'custom_target_id')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results[0].target_id).toBe('custom_target_id');
  });

  it('uses the provided run_id', () => {
    const questions = [makeQuestion('1')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1)] }];

    const results = assembleLocalizationResults('run_custom', questions, windowResults, windows);

    expect(results[0].run_id).toBe('run_custom');
  });
});

// ---------------------------------------------------------------------------
// Centrality-based dedup
// ---------------------------------------------------------------------------

describe('assembleLocalizationResults — centrality-based dedup', () => {
  it('keeps the bbox from the window where the page is most central', () => {
    const questions = [makeQuestion('1')];
    // Page 2 appears in both windows:
    //   Window 0: pages [1,2,3] → page 2 is at index 1 (middle), centrality = 1
    //   Window 1: pages [2,3,4] → page 2 is at index 0 (edge), centrality = 0
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 2, bbox_1000: [100, 100, 900, 900] }, // from central position
      ]),
      makeWindowResult([
        { question_number: '1', page_number: 2, bbox_1000: [200, 200, 800, 800] }, // from edge position
      ]),
    ];
    const windows = [
      { pages: [makePage(1), makePage(2), makePage(3)] },
      { pages: [makePage(2), makePage(3), makePage(4)] },
    ];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results[0].regions).toHaveLength(1);
    // Should keep bbox from window 0 (centrality 1 > centrality 0), padded by 30
    expect(results[0].regions[0].bbox_1000).toEqual([70, 70, 930, 930]);
  });

  it('keeps edge bbox when no more central window exists', () => {
    const questions = [makeQuestion('1')];
    // Page 1 only appears in window 0 at position 0 (edge)
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [50, 50, 950, 950] },
      ]),
    ];
    const windows = [
      { pages: [makePage(1), makePage(2), makePage(3)] },
    ];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results[0].regions[0].bbox_1000).toEqual([20, 20, 980, 980]);
  });

  it('deduplicates across three overlapping windows correctly', () => {
    const questions = [makeQuestion('1')];
    // Page 3 appears in all three windows:
    //   Window 0: pages [1,2,3] → index 2 (edge), centrality = 0
    //   Window 1: pages [2,3,4] → index 1 (middle), centrality = 1
    //   Window 2: pages [3,4,5] → index 0 (edge), centrality = 0
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 3, bbox_1000: [0, 0, 300, 300] },
      ]),
      makeWindowResult([
        { question_number: '1', page_number: 3, bbox_1000: [0, 0, 500, 500] }, // most central
      ]),
      makeWindowResult([
        { question_number: '1', page_number: 3, bbox_1000: [0, 0, 700, 700] },
      ]),
    ];
    const windows = [
      { pages: [makePage(1), makePage(2), makePage(3)] },
      { pages: [makePage(2), makePage(3), makePage(4)] },
      { pages: [makePage(3), makePage(4), makePage(5)] },
    ];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results[0].regions).toHaveLength(1);
    expect(results[0].regions[0].bbox_1000).toEqual([0, 0, 530, 530]); // from window 1, padded
  });
});

// ---------------------------------------------------------------------------
// Questions not found
// ---------------------------------------------------------------------------

describe('assembleLocalizationResults — questions not found', () => {
  it('omits targets not found in any window', () => {
    const questions = [makeQuestion('1'), makeQuestion('2'), makeQuestion('3')];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
        // question 2 not found
        { question_number: '3', page_number: 2, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1), makePage(2), makePage(3)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results).toHaveLength(2);
    expect(results[0].target_id).toBe('q_0001');
    expect(results[1].target_id).toBe('q_0003');
  });

  it('returns empty array when no questions are found', () => {
    const questions = [makeQuestion('1'), makeQuestion('2')];
    const windowResults = [makeWindowResult([])];
    const windows = [{ pages: [makePage(1), makePage(2), makePage(3)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results).toEqual([]);
  });

  it('returns empty array when question list is empty', () => {
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1)] }];

    const results = assembleLocalizationResults('run_test', [], windowResults, windows);

    expect(results).toEqual([]);
  });

  it('skips targets with no question_number', () => {
    const questions: SegmentationTarget[] = [
      { target_id: 'q_0001', target_type: 'question' }, // no question_number
    ];
    const windowResults = [
      makeWindowResult([
        { question_number: '1', page_number: 1, bbox_1000: [0, 0, 500, 500] },
      ]),
    ];
    const windows = [{ pages: [makePage(1)] }];

    const results = assembleLocalizationResults('run_test', questions, windowResults, windows);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// padBbox
// ---------------------------------------------------------------------------

describe('padBbox', () => {
  it('expands bbox by default 30 units on each side', () => {
    expect(padBbox([100, 100, 900, 900])).toEqual([70, 70, 930, 930]);
  });

  it('clamps to [0, 1000] bounds', () => {
    expect(padBbox([10, 10, 990, 990])).toEqual([0, 0, 1000, 1000]);
  });

  it('handles bbox already at edges', () => {
    expect(padBbox([0, 0, 1000, 1000])).toEqual([0, 0, 1000, 1000]);
  });

  it('accepts custom padding value', () => {
    expect(padBbox([100, 100, 900, 900], 50)).toEqual([50, 50, 950, 950]);
  });

  it('handles small bbox', () => {
    expect(padBbox([500, 500, 510, 510])).toEqual([470, 470, 540, 540]);
  });
});
