/**
 * adapters/ui/local-app/diagram-upload-handler.ts
 *
 * Multipart PNG upload parsing for the diagram-only cropper.
 *
 * Mirrors the structure of `upload-handler.ts` (which handles PDFs for the
 * question pipeline). Differences: accepts ONE PNG, validates the magic bytes
 * to reject non-PNGs even if the extension/mime is correct, and writes into
 * `OUTPUT_DIR/diagram-uploads/`.
 */

import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';
import busboy from 'busboy';

const MAX_DIAGRAM_UPLOAD_BYTES = 25 * 1024 * 1024;

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ParsedDiagramUpload {
  imageFilePath: string;
  originalFileName: string;
  /** Gemini model name selected by the user (from the form dropdown). */
  model?: string;
}

export class DiagramUploadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(`${code}: ${message}`);
    this.name = 'DiagramUploadError';
  }
}

function safeFileName(raw: string): string {
  const base = path.basename(raw || 'upload.png');
  const parsed = path.parse(base);
  const name = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'upload';
  return `${name}.png`;
}

function isPng(filename: string, mimeType: string): boolean {
  const hasPngExt = filename.toLowerCase().endsWith('.png');
  return hasPngExt && (mimeType === 'image/png' || mimeType === 'application/octet-stream');
}

/**
 * Parses one PNG out of a multipart/form-data request.
 *
 * On success: writes the PNG to `<outputDir>/diagram-uploads/<timestamp>_<safe>.png`
 * and resolves with the path + original file name.
 */
export function parseDiagramUpload(
  req: http.IncomingMessage,
  outputDir: string,
): Promise<ParsedDiagramUpload> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return Promise.reject(new DiagramUploadError(
      'UPLOAD_INVALID_CONTENT_TYPE',
      'Expected multipart/form-data with one PNG file.',
    ));
  }

  const uploadDir = path.join(outputDir, 'diagram-uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_DIAGRAM_UPLOAD_BYTES,
      },
    });

    let fileSeen = false;
    let uploadPath: string | undefined;
    let originalFileName = '';
    let selectedModel: string | undefined;
    let writeDone: Promise<void> | undefined;
    let settled = false;

    const cleanup = (): void => {
      if (uploadPath && fs.existsSync(uploadPath)) {
        fs.rmSync(uploadPath, { force: true });
      }
    };

    const fail = (err: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(err);
    };

    bb.on('field', (fieldName, value) => {
      if (fieldName === 'model' && typeof value === 'string' && value.trim()) {
        selectedModel = value.trim();
      }
    });

    bb.on('file', (fieldName, file, info) => {
      if (fieldName !== 'imageFile') {
        file.resume();
        return;
      }

      if (fileSeen) {
        file.resume();
        fail(new DiagramUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PNG file.'));
        return;
      }

      fileSeen = true;
      originalFileName = info.filename || 'upload.png';
      if (!isPng(originalFileName, info.mimeType)) {
        file.resume();
        fail(new DiagramUploadError(
          'UPLOAD_NOT_PNG',
          'Choose a PNG file with a .png filename and image/png content type.',
        ));
        return;
      }

      const fileName = `${Date.now()}_${safeFileName(originalFileName)}`;
      uploadPath = path.join(uploadDir, fileName);
      const out = fs.createWriteStream(uploadPath);

      writeDone = new Promise<void>((resolveWrite, rejectWrite) => {
        out.on('finish', resolveWrite);
        out.on('error', rejectWrite);
        file.on('error', rejectWrite);
        file.on('limit', () => {
          rejectWrite(new DiagramUploadError(
            'UPLOAD_TOO_LARGE',
            `Image upload exceeds ${MAX_DIAGRAM_UPLOAD_BYTES / (1024 * 1024)} MB.`,
            413,
          ));
        });
      });

      file.pipe(out);
    });

    bb.on('filesLimit', () => {
      fail(new DiagramUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PNG file.'));
    });

    bb.on('error', fail);

    bb.on('close', () => {
      if (settled) {
        return;
      }

      if (!fileSeen || !uploadPath) {
        fail(new DiagramUploadError('UPLOAD_MISSING_FILE', 'Choose one PNG file before starting.'));
        return;
      }

      (writeDone ?? Promise.resolve())
        .then(() => {
          if (settled) {
            return;
          }
          // Magic-byte sanity check — rejects renamed non-PNGs early.
          try {
            const fd = fs.openSync(uploadPath!, 'r');
            const header = Buffer.alloc(8);
            fs.readSync(fd, header, 0, 8, 0);
            fs.closeSync(fd);
            if (!header.equals(PNG_MAGIC)) {
              throw new DiagramUploadError(
                'UPLOAD_NOT_PNG',
                'File is not a valid PNG (bad magic bytes).',
              );
            }
          } catch (err) {
            if (err instanceof DiagramUploadError) {
              fail(err);
              return;
            }
            fail(err as Error);
            return;
          }
          settled = true;
          resolve({
            imageFilePath: uploadPath!,
            originalFileName,
            model: selectedModel,
          });
        })
        .catch(fail);
    });

    req.pipe(bb);
  });
}

export { MAX_DIAGRAM_UPLOAD_BYTES };
