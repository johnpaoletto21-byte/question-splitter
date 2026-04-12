import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runFullPipeline } from '../full-pipeline-runner';
import type { LocalConfig } from '../../config/local-config/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { LocalizationResult } from '../../../core/localization-contract/types';
import type { SegmentationCallOptions } from '../../../core/run-orchestrator/segmentation-step';
import type { PromptSnapshot } from '../../../core/prompt-config-store/types';

describe('runFullPipeline', () => {
  it('runs all stages in order with injected adapters and returns final summary', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runner-test-'));
    const events: string[] = [];
    const config: LocalConfig = {
      GEMINI_API_KEY: 'test-key',
      DRIVE_FOLDER_ID: 'folder-id',
      OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
      OUTPUT_DIR: tmpDir,
    };

    const page: PreparedPageImage = {
      source_id: 'src_0000_exam',
      page_number: 1,
      image_path: path.join(tmpDir, 'page.png'),
      image_width: 100,
      image_height: 100,
    };

    const segmentation: SegmentationResult = {
      run_id: 'will-be-overwritten-by-bootstrap-run-id',
      targets: [{
        target_id: 'q_0001',
        target_type: 'question',
        finish_page_number: 1,
        regions: [{ page_number: 1 }],
      }],
    };

    const localization: LocalizationResult = {
      run_id: 'run_test',
      target_id: 'q_0001',
      regions: [{ page_number: 1, bbox_1000: [0, 0, 1000, 1000] }],
    };

    const summary = await runFullPipeline(
      {
        pdfFilePaths: [path.join(tmpDir, 'exam.pdf')],
        config,
        onLog: (event) => events.push(`${event.stage}:${event.message}`),
      },
      {
        renderer: async () => [page],
        segmenter: async (runId) => ({ ...segmentation, run_id: runId }),
        localizer: async (runId) => ({ ...localization, run_id: runId }),
        cropExecutor: async () => path.join(tmpDir, 'q_0001.png'),
        imageStacker: async () => path.join(tmpDir, 'stacked.png'),
        driveUploader: async () => ({
          drive_file_id: 'drive-id',
          drive_url: 'https://drive.google.com/file/d/drive-id/view',
        }),
      },
    );

    expect(summary.targets).toHaveLength(1);
    expect(summary.targets[0].final_status).toBe('ok');
    expect(summary.targets[0].drive_url).toBe('https://drive.google.com/file/d/drive-id/view');
    expect(events.join('\n')).toContain('render:Rendering PDF pages');
    expect(events.join('\n')).toContain('segmentation:Running Agent 1 segmentation in page windows');
    expect(events.join('\n')).toContain('upload:Drive upload step finished');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('continues when one target fails localization and marks only that target failed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runner-test-'));
    const events: string[] = [];
    const config: LocalConfig = {
      GEMINI_API_KEY: 'test-key',
      DRIVE_FOLDER_ID: 'folder-id',
      OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
      OUTPUT_DIR: tmpDir,
    };

    const pages: PreparedPageImage[] = [
      {
        source_id: 'src_0000_exam',
        page_number: 1,
        image_path: path.join(tmpDir, 'page1.png'),
        image_width: 100,
        image_height: 100,
      },
      {
        source_id: 'src_0000_exam',
        page_number: 2,
        image_path: path.join(tmpDir, 'page2.png'),
        image_width: 100,
        image_height: 100,
      },
    ];

    const driveUploader = jest.fn(async () => ({
      drive_file_id: 'drive-id',
      drive_url: 'https://drive.google.com/file/d/drive-id/view',
    }));

    const summary = await runFullPipeline(
      {
        pdfFilePaths: [path.join(tmpDir, 'exam.pdf')],
        config,
        onLog: (event) => events.push(`${event.stage}:${event.message}`),
      },
      {
        renderer: async () => pages,
        segmenter: async (runId, _pages, _profile, _prompt, options?: SegmentationCallOptions) => ({
          run_id: runId,
          targets: [{
            target_id: 'q_0001',
            target_type: 'question',
            finish_page_number: options?.focusPageNumber ?? 1,
            regions: [{ page_number: options?.focusPageNumber ?? 1 }],
          }],
        }),
        localizer: async (runId, target) => {
          if (target.target_id === 'q_0001') {
            throw {
              code: 'LOCALIZATION_SCHEMA_INVALID',
              message: 'bbox_1000 has zero height after 2 retries',
            };
          }
          const result: LocalizationResult = {
            run_id: runId,
            target_id: target.target_id,
            regions: [{ page_number: 2, bbox_1000: [0, 0, 1000, 1000] }],
          };
          return result;
        },
        cropExecutor: async (_runId, targetId) => path.join(tmpDir, `${targetId}.png`),
        imageStacker: async () => path.join(tmpDir, 'stacked.png'),
        driveUploader,
      },
    );

    expect(summary.targets).toHaveLength(2);
    expect(summary.targets[0].target_id).toBe('q_0001');
    expect(summary.targets[0].final_status).toBe('failed');
    expect(summary.targets[0].failure_code).toBe('LOCALIZATION_SCHEMA_INVALID');
    expect(summary.targets[0].failure_message).toContain('zero height');
    expect(summary.targets[1].target_id).toBe('q_0002');
    expect(summary.targets[1].final_status).toBe('ok');
    expect(summary.targets[1].drive_url).toBe('https://drive.google.com/file/d/drive-id/view');
    expect(summary.targets[1].agent2_status).toBe('ok');
    expect(driveUploader).toHaveBeenCalledTimes(1);
    expect(events.join('\n')).toContain('localization:Localization failed for q_0001');
    expect(events.join('\n')).toContain('localization:Localized q_0002');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses an explicit prompt snapshot when the local app supplies one', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runner-test-'));
    const config: LocalConfig = {
      GEMINI_API_KEY: 'test-key',
      DRIVE_FOLDER_ID: 'folder-id',
      OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
      OUTPUT_DIR: tmpDir,
    };
    const promptSnapshot: PromptSnapshot = {
      agent1Prompt: 'queued segmenter prompt',
      agent2Prompt: 'queued localizer prompt',
      capturedAt: '2024-01-01T00:00:00.000Z',
    };
    const page: PreparedPageImage = {
      source_id: 'src_0000_exam',
      page_number: 1,
      image_path: path.join(tmpDir, 'page.png'),
      image_width: 100,
      image_height: 100,
    };
    const seenPrompts: string[] = [];

    await runFullPipeline(
      {
        pdfFilePaths: [path.join(tmpDir, 'exam.pdf')],
        config,
        promptSnapshot,
      },
      {
        renderer: async () => [page],
        segmenter: async (runId, _pages, _profile, prompt) => {
          seenPrompts.push(prompt);
          return {
            run_id: runId,
            targets: [{
              target_id: 'q_0001',
              target_type: 'question',
              regions: [{ page_number: 1 }],
            }],
          };
        },
        localizer: async (runId, target, _pages, _profile, prompt) => {
          seenPrompts.push(prompt);
          return {
            run_id: runId,
            target_id: target.target_id,
            regions: [{ page_number: 1, bbox_1000: [0, 0, 1000, 1000] }],
          };
        },
        cropExecutor: async () => path.join(tmpDir, 'q_0001.png'),
        imageStacker: async () => path.join(tmpDir, 'stacked.png'),
        driveUploader: async () => ({
          drive_file_id: 'drive-id',
          drive_url: 'https://drive.google.com/file/d/drive-id/view',
        }),
      },
    );

    expect(seenPrompts).toEqual(['queued segmenter prompt', 'queued localizer prompt']);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('processes focus page windows and carries custom extraction fields into summary', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runner-test-'));
    const config: LocalConfig = {
      GEMINI_API_KEY: 'test-key',
      DRIVE_FOLDER_ID: 'folder-id',
      OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
      OUTPUT_DIR: tmpDir,
    };
    const pages = [1, 2, 3].map((pageNumber) => ({
      source_id: 'src_0000_exam',
      page_number: pageNumber,
      image_path: path.join(tmpDir, `page${pageNumber}.png`),
      image_width: 100,
      image_height: 100,
    }));
    const segmentCalls: number[][] = [];
    const allowedCalls: Array<ReadonlyArray<number> | undefined> = [];
    const localizerPages: number[][] = [];

    const summary = await runFullPipeline(
      {
        pdfFilePaths: [path.join(tmpDir, 'exam.pdf')],
        config,
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if diagram appears',
          type: 'boolean',
        }],
      },
      {
        renderer: async () => pages,
        segmenter: async (runId, windowPages, _profile, _prompt, options?: SegmentationCallOptions) => {
          segmentCalls.push(windowPages.map((page) => page.page_number));
          allowedCalls.push(options?.allowedRegionPageNumbers);
          const focus = options?.focusPageNumber ?? 1;
          return {
            run_id: runId,
            targets: [{
              target_id: 'q_0001',
              target_type: 'question',
              finish_page_number: focus,
              regions: [{ page_number: focus }],
              extraction_fields: { has_diagram: focus === 2 },
            }],
          };
        },
        localizer: async (runId, target, contextPages) => {
          localizerPages.push(contextPages.map((page) => page.page_number));
          return {
            run_id: runId,
            target_id: target.target_id,
            regions: target.regions.map((region) => ({
              page_number: region.page_number,
              bbox_1000: [0, 0, 1000, 1000],
            })),
          };
        },
        cropExecutor: async (_runId, targetId) => path.join(tmpDir, `${targetId}.png`),
        imageStacker: async () => path.join(tmpDir, 'stacked.png'),
        driveUploader: async () => ({
          drive_file_id: 'drive-id',
          drive_url: 'https://drive.google.com/file/d/drive-id/view',
        }),
      },
    );

    expect(segmentCalls).toEqual([[1, 2], [1, 2, 3], [2, 3]]);
    expect(allowedCalls).toEqual([[1], [1, 2], [2, 3]]);
    expect(localizerPages).toEqual([[1], [1, 2], [2, 3]]);
    expect(summary.extraction_fields?.[0].key).toBe('has_diagram');
    expect(summary.targets.map((target) => target.target_id)).toEqual(['q_0001', 'q_0002', 'q_0003']);
    expect(summary.targets[1].extraction_fields).toEqual({ has_diagram: true });

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logs and rethrows focus-window metadata when Agent 1 segmentation fails', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runner-test-'));
    const events: string[] = [];
    const config: LocalConfig = {
      GEMINI_API_KEY: 'test-key',
      DRIVE_FOLDER_ID: 'folder-id',
      OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
      OUTPUT_DIR: tmpDir,
    };
    const pages = [4, 5, 6].map((pageNumber) => ({
      source_id: 'src_0000_exam',
      page_number: pageNumber,
      image_path: path.join(tmpDir, `page${pageNumber}.png`),
      image_width: 100,
      image_height: 100,
    }));

    await expect(runFullPipeline(
      {
        pdfFilePaths: [path.join(tmpDir, 'exam.pdf')],
        config,
        onLog: (event) => events.push(`${event.stage}:${event.message}`),
      },
      {
        renderer: async () => pages,
        segmenter: async () => {
          throw {
            code: 'SEGMENTATION_SCHEMA_INVALID',
            message: 'targets[0] max region page 1 must equal finish_page_number 5',
          };
        },
      },
    )).rejects.toMatchObject({
      code: 'SEGMENTATION_SCHEMA_INVALID',
      segmentationWindow: {
        focusPageNumber: 4,
        pageNumbers: [4, 5],
        allowedRegionPageNumbers: [3, 4],
      },
    });

    expect(events.join('\n')).toContain(
      'segmentation:Agent 1 failed for focus page 4; allowed output region pages 3, 4',
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
