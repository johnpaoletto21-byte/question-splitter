/**
 * adapters/ui/local-app/hint-upload-handler.ts
 *
 * Multipart upload parsing for the hint annotator mode.
 * Captures a PNG file, optional hint text, and annotation method selection.
 */

import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';
import busboy from 'busboy';
import type { HintAnnotationMethod } from '../../run-pipeline/hint-pipeline-runner';

const MAX_HINT_UPLOAD_BYTES = 25 * 1024 * 1024;

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const VALID_METHODS: ReadonlySet<string> = new Set(['image-gen', 'overlay', 'blend', 'all']);

export interface ParsedHintUpload {
  imageFilePath: string;
  originalFileName: string;
  hintText?: string;
  method: HintAnnotationMethod;
  /** Raw textarea value for the blend step-1 (overlay) prompt override. */
  blendOverlayPrompt?: string;
  /** Raw textarea value for the blend step-1 response schema (JSON text). */
  blendOverlaySchema?: string;
  /** Raw textarea value for the blend step-2 (render) prompt override. */
  blendRenderPrompt?: string;
}

export class HintUploadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(`${code}: ${message}`);
    this.name = 'HintUploadError';
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
 * Parses a PNG file, optional hint text, and method selection from a multipart request.
 */
export function parseHintUpload(
  req: http.IncomingMessage,
  outputDir: string,
): Promise<ParsedHintUpload> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return Promise.reject(new HintUploadError(
      'UPLOAD_INVALID_CONTENT_TYPE',
      'Expected multipart/form-data.',
    ));
  }

  const uploadDir = path.join(outputDir, 'hint-uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_HINT_UPLOAD_BYTES,
      },
    });

    let fileSeen = false;
    let uploadPath: string | undefined;
    let originalFileName = '';
    let hintText: string | undefined;
    let method: HintAnnotationMethod = 'overlay'; // default
    let blendOverlayPrompt: string | undefined;
    let blendOverlaySchema: string | undefined;
    let blendRenderPrompt: string | undefined;
    let writeDone: Promise<void> | undefined;
    let settled = false;

    const cleanup = (): void => {
      if (uploadPath && fs.existsSync(uploadPath)) {
        fs.rmSync(uploadPath, { force: true });
      }
    };

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    bb.on('field', (fieldName, value) => {
      if (fieldName === 'hintText') {
        hintText = value.trim() || undefined;
      } else if (fieldName === 'method' && VALID_METHODS.has(value)) {
        method = value as HintAnnotationMethod;
      } else if (fieldName === 'blendOverlayPrompt') {
        blendOverlayPrompt = value.trim() || undefined;
      } else if (fieldName === 'blendOverlaySchema') {
        blendOverlaySchema = value.trim() || undefined;
      } else if (fieldName === 'blendRenderPrompt') {
        blendRenderPrompt = value.trim() || undefined;
      }
    });

    bb.on('file', (fieldName, file, info) => {
      if (fieldName !== 'imageFile') {
        file.resume();
        return;
      }

      if (fileSeen) {
        file.resume();
        fail(new HintUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PNG file.'));
        return;
      }

      fileSeen = true;
      originalFileName = info.filename || 'upload.png';
      if (!isPng(originalFileName, info.mimeType)) {
        file.resume();
        fail(new HintUploadError(
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
          rejectWrite(new HintUploadError(
            'UPLOAD_TOO_LARGE',
            `Image upload exceeds ${MAX_HINT_UPLOAD_BYTES / (1024 * 1024)} MB.`,
            413,
          ));
        });
      });

      file.pipe(out);
    });

    bb.on('filesLimit', () => {
      fail(new HintUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PNG file.'));
    });

    bb.on('error', fail);

    bb.on('close', () => {
      if (settled) return;

      if (!fileSeen || !uploadPath) {
        fail(new HintUploadError('UPLOAD_MISSING_FILE', 'Choose one PNG file before starting.'));
        return;
      }

      (writeDone ?? Promise.resolve())
        .then(() => {
          if (settled) return;
          // Magic-byte sanity check
          try {
            const fd = fs.openSync(uploadPath!, 'r');
            const header = Buffer.alloc(8);
            fs.readSync(fd, header, 0, 8, 0);
            fs.closeSync(fd);
            if (!header.equals(PNG_MAGIC)) {
              throw new HintUploadError(
                'UPLOAD_NOT_PNG',
                'File is not a valid PNG (bad magic bytes).',
              );
            }
          } catch (err) {
            if (err instanceof HintUploadError) {
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
            hintText,
            method,
            blendOverlayPrompt,
            blendOverlaySchema,
            blendRenderPrompt,
          });
        })
        .catch(fail);
    });

    req.pipe(bb);
  });
}

export { MAX_HINT_UPLOAD_BYTES };
