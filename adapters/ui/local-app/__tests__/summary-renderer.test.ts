/**
 * adapters/ui/local-app/__tests__/summary-renderer.test.ts
 *
 * Unit tests for renderSummaryHtml.
 *
 * Proves:
 *   - Rendered HTML contains the summary container (data-testid="run-summary").
 *   - Each target row is rendered with data-testid="summary-row-{target_id}".
 *   - Per-row status cell uses data-testid="summary-row-status-{target_id}".
 *   - Drive URL anchor uses data-testid="summary-row-drive-url-{target_id}".
 *   - Agent 1 review_comment rendered under data-testid="summary-row-review-comment-{id}".
 *   - Agent 2 review comment rendered under data-testid="summary-row-agent2-review-comment-{id}".
 *   - Failure code rendered under data-testid="summary-row-failure-code-{target_id}".
 *   - Failure message rendered under data-testid="summary-row-failure-message-{target_id}".
 *   - All rows rendered regardless of final_status (INV-8: partial failure visible).
 *   - review_comment appears in rendered HTML (INV-4: visible in UI).
 *   - Special characters in values are HTML-escaped.
 *   - run_id appears in the page title.
 */

import { renderSummaryHtml } from '../summary-renderer';
import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../../../../core/run-summary/summary';
import type { SegmentationResult } from '../../../../core/segmentation-contract/types';
import type { LocalizationResult } from '../../../../core/localization-contract/types';
import type { FinalResultRow } from '../../../../core/result-model/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegResult(): SegmentationResult {
  return {
    run_id: 'run_test_render_501',
    targets: [
      {
        target_id: 'q_0001',
        target_type: 'question',
        regions: [{ page_number: 1 }],
      },
      {
        target_id: 'q_0002',
        target_type: 'question',
        regions: [{ page_number: 2 }, { page_number: 3 }],
        review_comment: 'Agent 1: boundary ambiguous',
      },
    ],
  };
}

function makeLocResult(targetId: string): LocalizationResult {
  return {
    run_id: 'run_test_render_501',
    target_id: targetId,
    regions: [{ page_number: 1, bbox_1000: [100, 50, 800, 950] }],
  };
}

function makeSummaryWithFinalResults() {
  let state = buildRunSummaryFromSegmentation(makeSegResult());
  state = applyLocalizationToSummary(state, makeLocResult('q_0001'));
  state = applyLocalizationToSummary(
    state,
    {
      run_id: 'run_test_render_501',
      target_id: 'q_0002',
      regions: [{ page_number: 2, bbox_1000: [0, 0, 500, 1000] }],
      review_comment: 'Agent 2: low confidence',
    },
  );
  const rows: FinalResultRow[] = [
    {
      target_id: 'q_0001',
      source_pages: [1],
      output_file_name: 'q_0001.png',
      status: 'ok',
      local_output_path: '/tmp/q_0001.png',
      drive_url: 'https://drive.google.com/file/d/abc123/view',
    },
    {
      target_id: 'q_0002',
      source_pages: [2, 3],
      output_file_name: '',
      status: 'failed',
      failure_code: 'COMPOSITION_FAILED',
      failure_message: 'stacker threw unexpected error',
    },
  ];
  state = applyFinalResultsToSummary(state, rows);
  return state;
}

function makeReviewSummary() {
  return {
    run_id: 'run_review_table',
    extraction_fields: [{
      key: 'has_diagram',
      label: 'Has Diagram',
      description: 'true if the question includes a diagram',
      type: 'boolean' as const,
    }],
    targets: [{
      target_id: 'q_0001',
      target_type: 'question',
      page_numbers: [1],
      finish_page_number: 1,
      extraction_fields: { has_diagram: true },
      agent1_status: 'needs_review' as const,
      review_comment: 'Agent 1: diagram boundary uncertain',
      agent2_status: 'needs_review' as const,
      agent2_review_comment: 'Agent 2: crop touches lower edge',
      final_status: 'ok' as const,
      drive_url: 'https://drive.google.com/file/d/abc123/view',
      local_output_path: '/tmp/q_0001.png',
      preview_url: '/runs/local_run_test/preview/q_0001',
    }],
  };
}

// ---------------------------------------------------------------------------
// Tests — structure
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — structure', () => {
  it('returns a non-empty HTML string', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('includes <!DOCTYPE html>', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    expect(renderSummaryHtml(state)).toContain('<!DOCTYPE html>');
  });

  it('includes run_id in the page title', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    expect(renderSummaryHtml(state)).toContain('run_test_render_501');
  });
});

// ---------------------------------------------------------------------------
// Tests — summary container selector
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — summary container selector', () => {
  it('renders summary container with data-testid="run-summary"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    expect(renderSummaryHtml(state)).toContain('data-testid="run-summary"');
  });

  it('links to the prompt editor from the summary page', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('href="/prompt-edit"');
    expect(html).toContain('data-testid="summary-prompt-edit-link"');
  });

  it('links to the real run page from the summary page', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('href="/run"');
    expect(html).toContain('data-testid="summary-run-link"');
  });
});

// ---------------------------------------------------------------------------
// Tests — per-row selectors
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — per-row selectors', () => {
  it('renders a row for each target with data-testid="summary-row-{target_id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-q_0001"');
    expect(html).toContain('data-testid="summary-row-q_0002"');
  });

  it('renders per-row status cell with data-testid="summary-row-status-{target_id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-status-q_0001"');
    expect(html).toContain('data-testid="summary-row-status-q_0002"');
  });

  it('renders per-row drive URL cell with data-testid="summary-row-drive-url-{target_id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-drive-url-q_0001"');
    expect(html).toContain('data-testid="summary-row-drive-url-q_0002"');
  });

  it('renders per-row local preview cell with data-testid="summary-row-preview-{target_id}"', () => {
    const html = renderSummaryHtml(makeReviewSummary());
    expect(html).toContain('data-testid="summary-row-preview-q_0001"');
    expect(html).toContain('src="/runs/local_run_test/preview/q_0001"');
  });

  it('renders per-row AI comments cell with data-testid="summary-row-ai-comments-{target_id}"', () => {
    const html = renderSummaryHtml(makeReviewSummary());
    expect(html).toContain('data-testid="summary-row-ai-comments-q_0001"');
    expect(html).toContain('Agent 1: diagram boundary uncertain');
    expect(html).toContain('Agent 2: crop touches lower edge');
  });

  it('renders per-row Agent 1 review comment with data-testid="summary-row-review-comment-{id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-review-comment-q_0001"');
    expect(html).toContain('data-testid="summary-row-review-comment-q_0002"');
  });

  it('renders per-row Agent 2 review comment with data-testid="summary-row-agent2-review-comment-{id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-agent2-review-comment-q_0001"');
    expect(html).toContain('data-testid="summary-row-agent2-review-comment-q_0002"');
  });

  it('renders failure code cell with data-testid="summary-row-failure-code-{target_id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-failure-code-q_0001"');
  });

  it('renders failure message cell with data-testid="summary-row-failure-message-{target_id}"', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('data-testid="summary-row-failure-message-q_0001"');
  });
});

// ---------------------------------------------------------------------------
// Tests — content visibility (INV-4 + INV-8)
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — content visibility', () => {
  it('renders final_status = "ok" in the status cell', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    // q_0001 is ok
    expect(html).toContain(
      `data-testid="summary-row-status-q_0001">ok`,
    );
  });

  it('renders final_status = "failed" in the status cell', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    // q_0002 is failed
    expect(html).toContain(
      `data-testid="summary-row-status-q_0002">failed`,
    );
  });

  it('renders drive URL as an anchor when present', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    expect(html).toContain('href="https://drive.google.com/file/d/abc123/view"');
    expect(html).toContain('data-testid="summary-row-drive-url-q_0001"');
  });

  it('renders dash for drive URL when absent (upload failed)', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    // q_0002 failed — no drive URL
    expect(html).toContain(`data-testid="summary-row-drive-url-q_0002">—</span>`);
  });

  it('renders Agent 1 review_comment in the UI (INV-4: visible in summary)', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    expect(html).toContain('Agent 1: boundary ambiguous');
  });

  it('renders Agent 2 review comment in the UI (INV-4: visible in summary)', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    expect(html).toContain('Agent 2: low confidence');
  });

  it('renders failure code in the failure code cell', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    expect(html).toContain('COMPOSITION_FAILED');
  });

  it('renders failure message in the failure message cell', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    expect(html).toContain('stacker threw unexpected error');
  });

  it('renders all rows including failed ones (INV-8: partial failure stays visible)', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state);
    // Both q_0001 (ok) and q_0002 (failed) must appear
    expect(html).toContain('data-testid="summary-row-q_0001"');
    expect(html).toContain('data-testid="summary-row-q_0002"');
  });

  it('renders "pending" when final_status is absent', () => {
    // Before applyFinalResultsToSummary is called
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).toContain('>pending<');
  });

  it('renders dynamic boolean extraction field columns in configured order', () => {
    const html = renderSummaryHtml(makeReviewSummary());
    expect(html).toContain('data-testid="summary-field-header-has_diagram">Has Diagram</th>');
    expect(html).toContain('data-testid="summary-row-field-q_0001-has_diagram">Yes</td>');
  });
});

// ---------------------------------------------------------------------------
// Tests — HTML escaping
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — HTML escaping', () => {
  it('escapes special characters in target_id to prevent XSS', () => {
    const segResult: SegmentationResult = {
      run_id: 'run_xss',
      targets: [
        {
          target_id: '<script>alert(1)</script>',
          target_type: 'question',
          regions: [{ page_number: 1 }],
        },
      ],
    };
    const state = buildRunSummaryFromSegmentation(segResult);
    const html = renderSummaryHtml(state);
    // Raw script tag must not appear
    expect(html).not.toContain('<script>alert(1)</script>');
    // Escaped version must appear
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes special characters in review_comment to prevent XSS', () => {
    const segResult: SegmentationResult = {
      run_id: 'run_xss2',
      targets: [
        {
          target_id: 'q_0001',
          target_type: 'question',
          regions: [{ page_number: 1 }],
          review_comment: '<b>bold</b> & "quoted"',
        },
      ],
    };
    const state = buildRunSummaryFromSegmentation(segResult);
    const html = renderSummaryHtml(state);
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quoted&quot;');
  });
});

// ---------------------------------------------------------------------------
// Tests — split-view layout
// ---------------------------------------------------------------------------

describe('renderSummaryHtml — split-view layout', () => {
  it('renders split-view when sourcePdfUrl is provided', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="left-panel"');
    expect(html).toContain('data-testid="right-panel"');
    expect(html).toContain('data-testid="source-pdf-embed"');
  });

  it('embeds the source PDF URL in the right panel', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/r123/source-pdf' });
    expect(html).toContain('src="/runs/r123/source-pdf"');
    expect(html).toContain('type="application/pdf"');
  });

  it('renders target cards with data-pages attributes', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-pages="1"');
    expect(html).toContain('data-pages="2,3"');
  });

  it('renders target cards with status badges', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-status-q_0001">ok');
    expect(html).toContain('data-testid="summary-row-status-q_0002">failed');
  });

  it('renders target cards with preview images', () => {
    const html = renderSummaryHtml(makeReviewSummary(), { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-preview-q_0001"');
    expect(html).toContain('src="/runs/local_run_test/preview/q_0001"');
  });

  it('renders AI comments in target cards', () => {
    const html = renderSummaryHtml(makeReviewSummary(), { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-ai-comments-q_0001"');
    expect(html).toContain('Agent 1: diagram boundary uncertain');
    expect(html).toContain('Agent 2: crop touches lower edge');
  });

  it('renders failure info in failed target cards', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-failure-code-q_0002"');
    expect(html).toContain('COMPOSITION_FAILED');
    expect(html).toContain('stacker threw unexpected error');
  });

  it('renders all target rows including failed ones (INV-8)', () => {
    const state = makeSummaryWithFinalResults();
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-q_0001"');
    expect(html).toContain('data-testid="summary-row-q_0002"');
  });

  it('falls back to table layout when sourcePdfUrl is absent', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state);
    expect(html).not.toContain('data-testid="left-panel"');
    expect(html).not.toContain('data-testid="right-panel"');
    expect(html).toContain('<table data-testid="run-summary">');
  });

  it('falls back to table layout when sourcePdfUrl is undefined in options', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, {});
    expect(html).not.toContain('data-testid="left-panel"');
    expect(html).toContain('<table data-testid="run-summary">');
  });

  it('includes run_id in the split-view page title', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('run_test_render_501');
  });

  it('includes navigation links in split-view', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-run-link"');
    expect(html).toContain('data-testid="summary-prompt-edit-link"');
  });

  it('renders dynamic extraction field values in target cards', () => {
    const html = renderSummaryHtml(makeReviewSummary(), { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-field-q_0001-has_diagram"');
    expect(html).toContain('Yes');
  });

  it('renders compat comment spans in split-view', () => {
    const state = buildRunSummaryFromSegmentation(makeSegResult());
    const html = renderSummaryHtml(state, { sourcePdfUrl: '/runs/test/source-pdf' });
    expect(html).toContain('data-testid="summary-row-review-comment-q_0001"');
    expect(html).toContain('data-testid="summary-row-agent2-review-comment-q_0001"');
  });
});
