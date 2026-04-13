/**
 * core/run-orchestrator/__tests__/partial-failure-integration.test.ts
 *
 * Integrated partial-failure scenario — proves INV-8 / PO-7 across real
 * orchestrator stages.
 *
 * Scenario:
 *   - q_0001: BBOX_INVALID (inverted y-axis) — fails in runCropStep.
 *   - q_0002: valid 1-region bbox — succeeds through crop → composition → upload.
 *   - q_0003: valid 1-region bbox — succeeds through crop → composition → upload.
 *
 * What this proves (INV-8 / PO-7):
 *   1. runCropStep continues after q_0001's BBOX_INVALID; q_0002 and q_0003 are
 *      still cropped.
 *   2. runCompositionStep forwards q_0001's failed row and composes q_0002 and
 *      q_0003 normally.
 *   3. runUploadStep forwards q_0001's failed row and uploads q_0002 and q_0003.
 *   4. applyFinalResultsToSummary makes all three targets visible in the summary
 *      with their correct final_status values — one failed target does not hide
 *      the others.
 *
 * TASK-503 — Batch 5 closeout proof for INV-8 / PO-7.
 */

import { runCropStep } from '../crop-step';
import { runCompositionStep } from '../composition-step';
import { runUploadStep } from '../upload-step';
import {
  buildRunSummaryFromSegmentation,
  applyLocalizationToSummary,
  applyFinalResultsToSummary,
} from '../../run-summary/summary';
import type { LocalizationResult } from '../../localization-contract/types';
import type { PreparedPageImage } from '../../source-model/types';
import type { SegmentationResult } from '../../segmentation-contract/types';
import type { CropExecutor } from '../crop-step';
import type { ImageStackerFn } from '../composition-step';
import type { DriveUploaderFn } from '../upload-step';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const RUN_ID = 'run_test_503_integration';

/**
 * PreparedPageImages for pages 1, 2, 3.
 * 1000×1000 pixels makes bbox-to-pixel math trivial (1:1 scale).
 */
const PAGES: PreparedPageImage[] = [
  { source_id: 'src_0', page_number: 1, image_path: '/tmp/page1.png', image_width: 1000, image_height: 1000 },
  { source_id: 'src_0', page_number: 2, image_path: '/tmp/page2.png', image_width: 1000, image_height: 1000 },
  { source_id: 'src_0', page_number: 3, image_path: '/tmp/page3.png', image_width: 1000, image_height: 1000 },
];

/**
 * LocalizationResult array:
 *   q_0001 — inverted y-axis (y_min=900 > y_max=100) → BBOX_INVALID
 *   q_0002 — valid 1-region bbox on page 2
 *   q_0003 — valid 1-region bbox on page 3
 */
const LOCALIZED_TARGETS: LocalizationResult[] = [
  {
    run_id: RUN_ID,
    target_id: 'q_0001',
    regions: [{ page_number: 1, bbox_1000: [900, 100, 100, 800] }], // inverted y → BBOX_INVALID
  },
  {
    run_id: RUN_ID,
    target_id: 'q_0002',
    regions: [{ page_number: 2, bbox_1000: [100, 50, 800, 950] }],
  },
  {
    run_id: RUN_ID,
    target_id: 'q_0003',
    regions: [{ page_number: 3, bbox_1000: [200, 50, 700, 900] }],
  },
];

/** Segmentation result used to build the run summary. */
const SEGMENTATION: SegmentationResult = {
  run_id: RUN_ID,
  targets: [
    { target_id: 'q_0001', target_type: 'question' },
    { target_id: 'q_0002', target_type: 'question' },
    { target_id: 'q_0003', target_type: 'question' },
  ],
};

/** CropExecutor: succeeds for valid targets; never called for q_0001 (BBOX_INVALID). */
const cropExecutor: CropExecutor = jest.fn(
  async (_runId, targetId, _page, _rect) => `/tmp/crops/${targetId}_r0.png`,
);

/** ImageStackerFn: must not be called — all targets have exactly 1 region. */
const imageStacker: ImageStackerFn = jest.fn(async () => {
  throw new Error('imageStacker should not be called in this scenario (all targets are 1-region)');
});

/** DriveUploaderFn: succeeds for q_0002 and q_0003. */
const driveUploader: DriveUploaderFn = jest.fn(
  async (_filePath, targetId) => ({
    drive_file_id: `file_${targetId}`,
    drive_url: `https://drive.google.com/file/d/file_${targetId}/view`,
  }),
);

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('partial-failure integration (INV-8 / PO-7 — TASK-503)', () => {
  it('early BBOX_INVALID does not stop later targets; mixed result is visible in summary', async () => {

    // -------------------------------------------------------------------
    // Stage 1: Crop step
    // -------------------------------------------------------------------
    const cropResults = await runCropStep(RUN_ID, LOCALIZED_TARGETS, PAGES, cropExecutor);

    // One result per target, same order (INV-5)
    expect(cropResults).toHaveLength(3);

    // q_0001 failed in crop step — BBOX_INVALID (inverted y)
    expect(cropResults[0].status).toBe('failed');
    expect(cropResults[0].targetId).toBe('q_0001');
    if (cropResults[0].status === 'failed') {
      expect(cropResults[0].code).toBe('BBOX_INVALID');
    }

    // q_0002 succeeded — processing continued after q_0001 failed (INV-8)
    expect(cropResults[1].status).toBe('ok');
    expect(cropResults[1].targetId).toBe('q_0002');

    // q_0003 succeeded — processing continued after q_0001 failed (INV-8)
    expect(cropResults[2].status).toBe('ok');
    expect(cropResults[2].targetId).toBe('q_0003');

    // cropExecutor was called for q_0002 and q_0003 but NOT for q_0001 (bail before I/O)
    expect(cropExecutor).toHaveBeenCalledTimes(2);

    // -------------------------------------------------------------------
    // Stage 2: Composition step
    // -------------------------------------------------------------------
    const profile = {
      target_type: 'question' as const,
      max_regions_per_target: 2,
      composition_mode: 'top_to_bottom' as const,
    };

    const compositionRows = await runCompositionStep(
      RUN_ID,
      cropResults,
      LOCALIZED_TARGETS,
      profile,
      imageStacker,
    );

    // One row per crop result, same order (INV-5)
    expect(compositionRows).toHaveLength(3);

    // q_0001 still failed — forwarded unchanged (INV-8)
    expect(compositionRows[0].status).toBe('failed');
    expect(compositionRows[0].target_id).toBe('q_0001');
    if (compositionRows[0].status === 'failed') {
      expect(compositionRows[0].failure_code).toBe('BBOX_INVALID');
    }

    // q_0002 ok — composed (1-region passthrough)
    expect(compositionRows[1].status).toBe('ok');
    expect(compositionRows[1].target_id).toBe('q_0002');

    // q_0003 ok — composed (1-region passthrough)
    expect(compositionRows[2].status).toBe('ok');
    expect(compositionRows[2].target_id).toBe('q_0003');

    // imageStacker never called — all targets had only 1 region
    expect(imageStacker).not.toHaveBeenCalled();

    // -------------------------------------------------------------------
    // Stage 3: Upload step
    // -------------------------------------------------------------------
    const uploadRows = await runUploadStep(
      RUN_ID,
      compositionRows,
      'folder_id_test',
      '/tmp/oauth-token.json',
      driveUploader,
    );

    // One row per composition row, same order (INV-5)
    expect(uploadRows).toHaveLength(3);

    // q_0001 still failed — passed through (INV-8)
    expect(uploadRows[0].status).toBe('failed');
    expect(uploadRows[0].target_id).toBe('q_0001');
    if (uploadRows[0].status === 'failed') {
      expect(uploadRows[0].failure_code).toBe('BBOX_INVALID');
    }

    // q_0002 uploaded — drive_url present
    expect(uploadRows[1].status).toBe('ok');
    expect(uploadRows[1].target_id).toBe('q_0002');
    if (uploadRows[1].status === 'ok') {
      expect(uploadRows[1].drive_url).toBe('https://drive.google.com/file/d/file_q_0002/view');
    }

    // q_0003 uploaded — drive_url present
    expect(uploadRows[2].status).toBe('ok');
    expect(uploadRows[2].target_id).toBe('q_0003');
    if (uploadRows[2].status === 'ok') {
      expect(uploadRows[2].drive_url).toBe('https://drive.google.com/file/d/file_q_0003/view');
    }

    // driveUploader called only for q_0002 and q_0003 (q_0001 was already failed)
    expect(driveUploader).toHaveBeenCalledTimes(2);

    // -------------------------------------------------------------------
    // Stage 4: Summary visibility (INV-8 / PO-7 final check)
    // -------------------------------------------------------------------
    let summaryState = buildRunSummaryFromSegmentation(SEGMENTATION);

    // Apply localization status for each target
    summaryState = applyLocalizationToSummary(summaryState, LOCALIZED_TARGETS[0]);
    summaryState = applyLocalizationToSummary(summaryState, LOCALIZED_TARGETS[1]);
    summaryState = applyLocalizationToSummary(summaryState, LOCALIZED_TARGETS[2]);

    // Apply final results
    summaryState = applyFinalResultsToSummary(summaryState, uploadRows);

    // All three targets are visible in the summary — no target was suppressed (INV-8)
    expect(summaryState.targets).toHaveLength(3);

    // q_0001: failed, correct failure code visible in summary
    expect(summaryState.targets[0].target_id).toBe('q_0001');
    expect(summaryState.targets[0].final_status).toBe('failed');
    expect(summaryState.targets[0].failure_code).toBe('BBOX_INVALID');

    // q_0002: ok, drive_url visible in summary
    expect(summaryState.targets[1].target_id).toBe('q_0002');
    expect(summaryState.targets[1].final_status).toBe('ok');
    expect(summaryState.targets[1].drive_url).toBe('https://drive.google.com/file/d/file_q_0002/view');

    // q_0003: ok, drive_url visible in summary
    expect(summaryState.targets[2].target_id).toBe('q_0003');
    expect(summaryState.targets[2].final_status).toBe('ok');
    expect(summaryState.targets[2].drive_url).toBe('https://drive.google.com/file/d/file_q_0003/view');

    // review_comment must not appear on any FinalResultRow (INV-4)
    for (const row of uploadRows) {
      expect(row).not.toHaveProperty('review_comment');
    }
  });
});
