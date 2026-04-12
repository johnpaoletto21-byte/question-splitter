import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { createPreviewServer } from '../preview-server';
import { resetRunRecordsForTests } from '../run-state';
import type { LocalConfig } from '../../../config/local-config/types';
import type { RunSummaryState } from '../../../../core/run-summary/types';

function request(port: number, method: string, requestPath: string, body = ''): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path: requestPath,
      headers: body === '' ? undefined : {
        'Content-Type': 'multipart/form-data; boundary=test',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({
        statusCode: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf-8'),
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

function listen(serverToListen: http.Server): Promise<number> {
  return new Promise((resolve) => {
    serverToListen.listen(0, '127.0.0.1', () => {
      resolve((serverToListen.address() as { port: number }).port);
    });
  });
}

describe('preview server real run routes', () => {
  let server: http.Server;
  let port: number;
  const tmpDir = os.tmpdir();
  const config: LocalConfig = {
    GEMINI_API_KEY: 'super-secret-test-api-key',
    DRIVE_FOLDER_ID: 'folder',
    OAUTH_TOKEN_PATH: path.join(tmpDir, 'token.json'),
    OUTPUT_DIR: tmpDir,
  };
  const summary: RunSummaryState = {
    run_id: 'run_server_test',
    targets: [{
      target_id: 'q_0001',
      target_type: 'question',
      page_numbers: [1],
      agent1_status: 'ok',
      agent2_status: 'ok',
      final_status: 'ok',
      drive_url: 'https://drive.google.com/file/d/test/view',
    }],
  };

  beforeEach((done) => {
    resetRunRecordsForTests();
    server = createPreviewServer({
      loadConfigFn: () => config,
      parsePdfUploadFn: async () => ({
        pdfFilePath: path.join(tmpDir, 'exam.pdf'),
        originalFileName: 'exam.pdf',
        runLabel: 'Server test',
      }),
      runFullPipelineFn: async (input) => {
        input.onLog?.({
          stage: 'fake',
          message: 'pipeline ran',
          timestamp: '2024-01-01T00:00:00.000Z',
        });
        return summary;
      },
    });
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      done();
    });
  });

  afterEach((done) => {
    server.close(done);
  });

  it('renders the upload form at /run', async () => {
    const res = await request(port, 'GET', '/run');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="run-upload-form"');
  });

  it('POST /run creates a run, redirects to logs, then exposes summary', async () => {
    const post = await request(port, 'POST', '/run', '--test--\r\n');
    expect(post.statusCode).toBe(303);
    expect(post.headers.location).toMatch(/^\/runs\/local_run_/);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const logs = await request(port, 'GET', post.headers.location as string);
    expect(logs.statusCode).toBe(200);
    expect(logs.body).toContain('data-testid="run-status">succeeded');
    expect(logs.body).toContain('pipeline ran');

    const summaryRes = await request(port, 'GET', `${post.headers.location}/summary`);
    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.body).toContain('data-testid="run-summary"');
    expect(summaryRes.body).toContain('data-testid="summary-debug-download-link"');
    expect(summaryRes.body).toContain('https://drive.google.com/file/d/test/view');

    const debugRes = await request(port, 'GET', `${post.headers.location}/debug.md`);
    expect(debugRes.statusCode).toBe(200);
    expect(debugRes.headers['content-type']).toContain('text/markdown');
    expect(debugRes.headers['content-disposition']).toContain('debug.md');
    expect(debugRes.body).toContain('# Question Cropper Debug Package');
    expect(debugRes.body).toContain('gemini-3.1-flash-lite-preview');
    expect(debugRes.body).toContain('pipeline ran');
    expect(debugRes.body).not.toContain(config.GEMINI_API_KEY);
  });

  it('renders structured pipeline failures instead of [object Object]', async () => {
    const failingServer = createPreviewServer({
      loadConfigFn: () => config,
      parsePdfUploadFn: async () => ({
        pdfFilePath: path.join(tmpDir, 'exam.pdf'),
        originalFileName: 'exam.pdf',
        runLabel: 'Failure test',
      }),
      runFullPipelineFn: async () => {
        throw {
          error: {
            code: 404,
            message: 'Structured Gemini failure',
          },
        };
      },
    });
    const failingPort = await listen(failingServer);
    try {
      const post = await request(failingPort, 'POST', '/run', '--test--\r\n');
      expect(post.statusCode).toBe(303);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const logs = await request(failingPort, 'GET', post.headers.location as string);
      expect(logs.statusCode).toBe(200);
      expect(logs.body).toContain('data-testid="run-status">failed');
      expect(logs.body).toContain('Structured Gemini failure');
      expect(logs.body).not.toContain('[object Object]');
    } finally {
      await new Promise<void>((resolve) => failingServer.close(() => resolve()));
    }
  });
});
