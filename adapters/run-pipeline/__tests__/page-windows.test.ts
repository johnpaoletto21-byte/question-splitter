import {
  buildChunkedPageWindows,
  getOverlapZones,
  buildLocalizationWindows,
} from '../page-windows';
import type { PreparedPageImage } from '../../../core/source-model/types';

function page(pageNumber: number): PreparedPageImage {
  return {
    source_id: 'src',
    page_number: pageNumber,
    image_path: `/tmp/page_${pageNumber}.png`,
    image_width: 100,
    image_height: 100,
  };
}

// ---------------------------------------------------------------------------
// buildChunkedPageWindows
// ---------------------------------------------------------------------------

describe('buildChunkedPageWindows', () => {
  it('builds a single chunk for pages fitting within chunkSize', () => {
    const chunks = buildChunkedPageWindows([page(1), page(2), page(3)], 10, 3);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3]);
    expect(chunks[0].startPage).toBe(1);
    expect(chunks[0].endPage).toBe(3);
  });

  it('builds overlapping chunks for pages exceeding chunkSize', () => {
    const pages = Array.from({ length: 15 }, (_, i) => page(i + 1));
    const chunks = buildChunkedPageWindows(pages, 10, 3);

    expect(chunks.length).toBeGreaterThan(1);
    // First chunk: pages 1-10, second starts at stride = 10-3 = 7 → pages 8-15
    expect(chunks[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(chunks[1].startPage).toBe(8);
  });

  it('returns empty array for no pages', () => {
    expect(buildChunkedPageWindows([])).toEqual([]);
  });

  it('sorts pages by page_number', () => {
    const chunks = buildChunkedPageWindows([page(3), page(1), page(2)], 10, 3);
    expect(chunks[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// getOverlapZones
// ---------------------------------------------------------------------------

describe('getOverlapZones', () => {
  it('identifies overlap pages between consecutive chunks', () => {
    const pages = Array.from({ length: 15 }, (_, i) => page(i + 1));
    const chunks = buildChunkedPageWindows(pages, 10, 3);
    const zones = getOverlapZones(chunks);

    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0].chunkAIndex).toBe(0);
    expect(zones[0].chunkBIndex).toBe(1);
    expect(zones[0].overlapPages.length).toBeGreaterThan(0);
  });

  it('returns empty for a single chunk', () => {
    const chunks = buildChunkedPageWindows([page(1), page(2)], 10, 3);
    const zones = getOverlapZones(chunks);
    expect(zones).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildLocalizationWindows
// ---------------------------------------------------------------------------

describe('buildLocalizationWindows', () => {
  it('builds sliding windows with stride 1 and default windowSize 3', () => {
    const pages = [page(1), page(2), page(3), page(4)];
    const windows = buildLocalizationWindows(pages);

    expect(windows).toHaveLength(2);
    expect(windows[0].windowIndex).toBe(0);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3]);
    expect(windows[1].windowIndex).toBe(1);
    expect(windows[1].pages.map((p) => p.page_number)).toEqual([2, 3, 4]);
  });

  it('builds correct windows for 6 pages', () => {
    const pages = [page(1), page(2), page(3), page(4), page(5), page(6)];
    const windows = buildLocalizationWindows(pages);

    expect(windows).toHaveLength(4);
    expect(windows.map((w) => w.pages.map((p) => p.page_number))).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [4, 5, 6],
    ]);
  });

  it('returns a single window when pages fit within windowSize', () => {
    const pages = [page(1), page(2)];
    const windows = buildLocalizationWindows(pages);

    expect(windows).toHaveLength(1);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1, 2]);
  });

  it('returns a single window for exactly windowSize pages', () => {
    const pages = [page(1), page(2), page(3)];
    const windows = buildLocalizationWindows(pages);

    expect(windows).toHaveLength(1);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3]);
  });

  it('returns a single window for one page', () => {
    const windows = buildLocalizationWindows([page(1)]);

    expect(windows).toHaveLength(1);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1]);
  });

  it('returns empty array for no pages', () => {
    const windows = buildLocalizationWindows([]);
    expect(windows).toEqual([]);
  });

  it('sorts pages by page_number regardless of input order', () => {
    const pages = [page(3), page(1), page(2)];
    const windows = buildLocalizationWindows(pages);

    expect(windows).toHaveLength(1);
    expect(windows[0].pages.map((p) => p.page_number)).toEqual([1, 2, 3]);
  });

  it('supports custom windowSize', () => {
    const pages = [page(1), page(2), page(3), page(4), page(5)];
    const windows = buildLocalizationWindows(pages, 2);

    expect(windows).toHaveLength(4);
    expect(windows.map((w) => w.pages.map((p) => p.page_number))).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
  });

  it('assigns sequential windowIndex values', () => {
    const pages = [page(1), page(2), page(3), page(4), page(5)];
    const windows = buildLocalizationWindows(pages);

    expect(windows.map((w) => w.windowIndex)).toEqual([0, 1, 2]);
  });
});
