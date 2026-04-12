import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import type * as http from 'http';
import { parsePdfUpload, PdfUploadError } from '../upload-handler';

function makeReq(contentType: string): http.IncomingMessage & PassThrough {
  const req = new PassThrough() as http.IncomingMessage & PassThrough;
  req.headers = { 'content-type': contentType };
  return req;
}

describe('parsePdfUpload', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-upload-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects non-multipart requests', async () => {
    const req = makeReq('text/plain');
    await expect(parsePdfUpload(req, tmpDir)).rejects.toMatchObject({
      code: 'UPLOAD_INVALID_CONTENT_TYPE',
    });
  });

  it('rejects missing PDF file', async () => {
    const req = makeReq('multipart/form-data; boundary=test-boundary');
    const promise = parsePdfUpload(req, tmpDir);
    req.end('--test-boundary--\r\n');
    await expect(promise).rejects.toMatchObject({ code: 'UPLOAD_MISSING_FILE' });
  });

  it('rejects non-PDF upload', async () => {
    const req = makeReq('multipart/form-data; boundary=test-boundary');
    const promise = parsePdfUpload(req, tmpDir);
    req.end([
      '--test-boundary',
      'Content-Disposition: form-data; name="pdfFile"; filename="notes.txt"',
      'Content-Type: text/plain',
      '',
      'not a pdf',
      '--test-boundary--',
      '',
    ].join('\r\n'));
    await expect(promise).rejects.toBeInstanceOf(PdfUploadError);
    await expect(promise).rejects.toMatchObject({ code: 'UPLOAD_NOT_PDF' });
  });

  it('accepts one PDF upload and run label', async () => {
    const req = makeReq('multipart/form-data; boundary=test-boundary');
    const promise = parsePdfUpload(req, tmpDir);
    req.end([
      '--test-boundary',
      'Content-Disposition: form-data; name="runLabel"',
      '',
      'Exam label',
      '--test-boundary',
      'Content-Disposition: form-data; name="pdfFile"; filename="exam.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.7',
      '--test-boundary--',
      '',
    ].join('\r\n'));

    const parsed = await promise;
    expect(parsed.originalFileName).toBe('exam.pdf');
    expect(parsed.runLabel).toBe('Exam label');
    expect(fs.existsSync(parsed.pdfFilePath)).toBe(true);
  });
});
