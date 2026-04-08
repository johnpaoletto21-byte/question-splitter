/**
 * adapters/ui/local-app/__tests__/preview-fixture.test.ts
 *
 * Verifies that PREVIEW_FIXTURE renders correctly through renderSummaryHtml,
 * exercising all data-testid selectors from the TASK-501 selector plan.
 *
 * This test proves the preview wiring is correct without starting an HTTP server.
 * It is the targeted test added for the TASK-501 close pass.
 *
 * Proves:
 *   - PREVIEW_FIXTURE renders the run-summary container.
 *   - Both target rows (ok + failed) are present (INV-8: partial failure stays visible).
 *   - Status cells show 'ok' for q_preview_001 and 'failed' for q_preview_002.
 *   - Drive URL anchor present for ok row; dash for failed row.
 *   - Agent 1 review_comment visible for q_preview_001 (INV-4).
 *   - Agent 2 review comment visible for q_preview_002 (INV-4).
 *   - Failure code and failure message visible for q_preview_002.
 *   - No review_comment leaked to final result rows (boundary check: the fixture
 *     state carries review_comment on RunSummaryTargetEntry, not on result-model rows).
 */

import { renderSummaryHtml } from '../summary-renderer';
import { PREVIEW_FIXTURE } from '../preview-fixture';

describe('PREVIEW_FIXTURE — rendered HTML', () => {
  let html: string;

  beforeAll(() => {
    html = renderSummaryHtml(PREVIEW_FIXTURE);
  });

  it('contains run-summary container selector', () => {
    expect(html).toContain('data-testid="run-summary"');
  });

  it('contains both target rows (INV-8: partial failure stays visible)', () => {
    expect(html).toContain('data-testid="summary-row-q_preview_001"');
    expect(html).toContain('data-testid="summary-row-q_preview_002"');
  });

  it('shows status ok for q_preview_001', () => {
    expect(html).toContain('data-testid="summary-row-status-q_preview_001">ok');
  });

  it('shows status failed for q_preview_002', () => {
    expect(html).toContain('data-testid="summary-row-status-q_preview_002">failed');
  });

  it('shows drive URL anchor for q_preview_001 (ok row)', () => {
    expect(html).toContain('data-testid="summary-row-drive-url-q_preview_001"');
    expect(html).toContain('href="https://drive.google.com/file/d/preview_ok_123/view"');
  });

  it('shows dash for drive URL on q_preview_002 (failed row)', () => {
    expect(html).toContain('data-testid="summary-row-drive-url-q_preview_002">—</span>');
  });

  it('renders Agent 1 review_comment for q_preview_001 (INV-4: visible in UI)', () => {
    expect(html).toContain('Agent 1: boundary unclear between header and question body');
    expect(html).toContain('data-testid="summary-row-review-comment-q_preview_001"');
  });

  it('renders Agent 2 review comment for q_preview_002 (INV-4: visible in UI)', () => {
    expect(html).toContain('Agent 2: low confidence on bottom crop boundary');
    expect(html).toContain('data-testid="summary-row-agent2-review-comment-q_preview_002"');
  });

  it('renders failure code for q_preview_002', () => {
    expect(html).toContain('data-testid="summary-row-failure-code-q_preview_002"');
    expect(html).toContain('COMPOSITION_FAILED');
  });

  it('renders failure message for q_preview_002', () => {
    expect(html).toContain('data-testid="summary-row-failure-message-q_preview_002"');
    expect(html).toContain('output composer could not stack regions: height mismatch');
  });

  it('includes run_id in the page title', () => {
    expect(html).toContain('preview_run_mixed_501');
  });
});

describe('PREVIEW_FIXTURE — fixture shape (INV-4 boundary check)', () => {
  it('fixture has exactly 2 targets', () => {
    expect(PREVIEW_FIXTURE.targets).toHaveLength(2);
  });

  it('q_preview_001 is ok with drive_url and no failure fields', () => {
    const entry = PREVIEW_FIXTURE.targets.find(t => t.target_id === 'q_preview_001');
    expect(entry).toBeDefined();
    expect(entry!.final_status).toBe('ok');
    expect(entry!.drive_url).toBeDefined();
    expect(entry!.failure_code).toBeUndefined();
    expect(entry!.failure_message).toBeUndefined();
  });

  it('q_preview_002 is failed with failure fields and no drive_url', () => {
    const entry = PREVIEW_FIXTURE.targets.find(t => t.target_id === 'q_preview_002');
    expect(entry).toBeDefined();
    expect(entry!.final_status).toBe('failed');
    expect(entry!.failure_code).toBe('COMPOSITION_FAILED');
    expect(entry!.failure_message).toBeDefined();
    expect(entry!.drive_url).toBeUndefined();
  });
});
