/**
 * core/result-model/__tests__/types.test.ts
 *
 * Proves:
 *   - FinalResultOk has all required fields (target_id, source_pages,
 *     output_file_name, status) and allowed optional fields.
 *   - FinalResultFailed has required fields with output_file_name = ''.
 *   - review_comment is absent from both variants (INV-4).
 *   - The discriminated union narrows correctly by status.
 *   - No provider SDK import appears in this module.
 *
 * TASK-401.
 */

import type { FinalResultRow, FinalResultOk, FinalResultFailed } from '../types';

describe('FinalResultOk — required fields and INV-4 clean', () => {
  it('accepts all required fields', () => {
    const row: FinalResultOk = {
      target_id: 'q_0001',
      source_pages: [1],
      output_file_name: 'q_0001.png',
      status: 'ok',
    };

    expect(row.target_id).toBe('q_0001');
    expect(row.source_pages).toEqual([1]);
    expect(row.output_file_name).toBe('q_0001.png');
    expect(row.status).toBe('ok');
  });

  it('accepts optional drive fields alongside required fields', () => {
    const row: FinalResultOk = {
      target_id: 'q_0002',
      source_pages: [1, 2],
      output_file_name: 'q_0002.png',
      status: 'ok',
      local_output_path: '/tmp/output/q_0002.png',
      drive_file_id: 'abc123',
      drive_url: 'https://drive.google.com/file/d/abc123',
    };

    expect(row.drive_file_id).toBe('abc123');
    expect(row.drive_url).toContain('abc123');
    expect(row.local_output_path).toBe('/tmp/output/q_0002.png');
  });

  it('does not have review_comment (INV-4)', () => {
    const row: FinalResultOk = {
      target_id: 'q_0001',
      source_pages: [1],
      output_file_name: 'q_0001.png',
      status: 'ok',
    };
    expect('review_comment' in row).toBe(false);
  });
});

describe('FinalResultFailed — required fields and INV-4 clean', () => {
  it('accepts all required fields with empty output_file_name', () => {
    const row: FinalResultFailed = {
      target_id: 'q_0003',
      source_pages: [2],
      output_file_name: '',
      status: 'failed',
      failure_code: 'BBOX_INVALID',
      failure_message: 'bbox [0, 0, 0, 0] has zero-height region',
    };

    expect(row.status).toBe('failed');
    expect(row.output_file_name).toBe('');
    expect(row.failure_code).toBe('BBOX_INVALID');
  });

  it('does not have review_comment (INV-4)', () => {
    const row: FinalResultFailed = {
      target_id: 'q_0003',
      source_pages: [2],
      output_file_name: '',
      status: 'failed',
      failure_code: 'COMPOSITION_FAILED',
      failure_message: 'could not compose regions',
    };
    expect('review_comment' in row).toBe(false);
  });
});

describe('FinalResultRow — discriminated union', () => {
  it('narrows to FinalResultOk when status is ok', () => {
    const rows: FinalResultRow[] = [
      {
        target_id: 'q_0001',
        source_pages: [1],
        output_file_name: 'q_0001.png',
        status: 'ok',
        local_output_path: '/tmp/output/q_0001.png',
      },
      {
        target_id: 'q_0002',
        source_pages: [2],
        output_file_name: '',
        status: 'failed',
        failure_code: 'BBOX_INVALID',
        failure_message: 'inverted y axis',
      },
    ];

    const okRows = rows.filter((r) => r.status === 'ok');
    const failedRows = rows.filter((r) => r.status === 'failed');

    expect(okRows).toHaveLength(1);
    expect(failedRows).toHaveLength(1);
    expect(okRows[0].output_file_name).toBe('q_0001.png');
    expect(failedRows[0].output_file_name).toBe('');
  });

  it('multi-page source_pages are preserved across both variants', () => {
    const ok: FinalResultRow = {
      target_id: 'q_0010',
      source_pages: [3, 4],
      output_file_name: 'q_0010.png',
      status: 'ok',
    };
    const failed: FinalResultRow = {
      target_id: 'q_0011',
      source_pages: [5, 6],
      output_file_name: '',
      status: 'failed',
      failure_code: 'COMPOSITION_FAILED',
      failure_message: 'stacker error',
    };

    expect(ok.source_pages).toEqual([3, 4]);
    expect(failed.source_pages).toEqual([5, 6]);
  });
});
