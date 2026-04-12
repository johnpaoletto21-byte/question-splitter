import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runFullPipeline } from '../full-pipeline-runner';
import type { LocalConfig } from '../../config/local-config/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { LocalizationResult } from '../../../core/localization-contract/types';

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
    expect(events.join('\n')).toContain('segmentation:Running Agent 1 segmentation');
    expect(events.join('\n')).toContain('upload:Drive upload step finished');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
