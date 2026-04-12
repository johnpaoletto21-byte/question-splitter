/**
 * adapters/ui/local-app/upload-handler.ts
 *
 * Multipart PDF upload parsing for the local app.
 */

import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';
import busboy from 'busboy';
import {
  parseExtractionFieldDefinitions,
  ExtractionFieldDefinitionError,
} from '../../../core/extraction-fields';
import type {
  ExtractionFieldDefinition,
  RawExtractionFieldInput,
} from '../../../core/extraction-fields';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface ParsedPdfUpload {
  pdfFilePath: string;
  originalFileName: string;
  runLabel?: string;
  extractionFields: ExtractionFieldDefinition[];
}

export class PdfUploadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(`${code}: ${message}`);
    this.name = 'PdfUploadError';
  }
}

function safeFileName(raw: string): string {
  const base = path.basename(raw || 'upload.pdf');
  const parsed = path.parse(base);
  const name = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'upload';
  return `${name}.pdf`;
}

function isPdf(filename: string, mimeType: string): boolean {
  const hasPdfExt = filename.toLowerCase().endsWith('.pdf');
  return hasPdfExt && (mimeType === 'application/pdf' || mimeType === 'application/octet-stream');
}

function setFieldRowValue(
  rows: RawExtractionFieldInput[],
  index: number,
  key: keyof RawExtractionFieldInput,
  value: string,
): void {
  if (!rows[index]) {
    rows[index] = {};
  }
  rows[index][key] = value;
}

export function parsePdfUpload(
  req: http.IncomingMessage,
  outputDir: string,
): Promise<ParsedPdfUpload> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return Promise.reject(new PdfUploadError(
      'UPLOAD_INVALID_CONTENT_TYPE',
      'Expected multipart/form-data with one PDF file.',
    ));
  }

  const uploadDir = path.join(outputDir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_UPLOAD_BYTES,
      },
    });

    let runLabel: string | undefined;
    const rawExtractionFieldRows: RawExtractionFieldInput[] = [];
    let fileSeen = false;
    let uploadPath: string | undefined;
    let originalFileName = '';
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

    bb.on('field', (name, value) => {
      if (name === 'runLabel') {
        const trimmed = value.trim();
        runLabel = trimmed === '' ? undefined : trimmed.slice(0, 120);
        return;
      }

      const fieldNameMatch = name.match(/^extractionFieldName_(\d+)$/);
      if (fieldNameMatch) {
        setFieldRowValue(rawExtractionFieldRows, Number(fieldNameMatch[1]), 'name', value);
        return;
      }

      const fieldDescriptionMatch = name.match(/^extractionFieldDescription_(\d+)$/);
      if (fieldDescriptionMatch) {
        setFieldRowValue(
          rawExtractionFieldRows,
          Number(fieldDescriptionMatch[1]),
          'description',
          value,
        );
      }
    });

    bb.on('file', (fieldName, file, info) => {
      if (fieldName !== 'pdfFile') {
        file.resume();
        return;
      }

      if (fileSeen) {
        file.resume();
        fail(new PdfUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PDF file.'));
        return;
      }

      fileSeen = true;
      originalFileName = info.filename || 'upload.pdf';
      if (!isPdf(originalFileName, info.mimeType)) {
        file.resume();
        fail(new PdfUploadError(
          'UPLOAD_NOT_PDF',
          'Choose a PDF file with a .pdf filename and application/pdf content type.',
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
          rejectWrite(new PdfUploadError(
            'UPLOAD_TOO_LARGE',
            `PDF upload exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
            413,
          ));
        });
      });

      file.pipe(out);
    });

    bb.on('filesLimit', () => {
      fail(new PdfUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PDF file.'));
    });

    bb.on('error', fail);

    bb.on('close', () => {
      if (settled) {
        return;
      }

      if (!fileSeen || !uploadPath) {
        fail(new PdfUploadError('UPLOAD_MISSING_FILE', 'Choose one PDF file before starting a run.'));
        return;
      }

      (writeDone ?? Promise.resolve())
        .then(() => {
          if (settled) {
            return;
          }
          let extractionFields: ExtractionFieldDefinition[];
          try {
            extractionFields = parseExtractionFieldDefinitions(rawExtractionFieldRows);
          } catch (err) {
            if (err instanceof ExtractionFieldDefinitionError) {
              throw new PdfUploadError(err.code, err.message);
            }
            throw err;
          }
          settled = true;
          resolve({
            pdfFilePath: uploadPath!,
            originalFileName,
            runLabel,
            extractionFields,
          });
        })
        .catch(fail);
    });

    req.pipe(bb);
  });
}

export { MAX_UPLOAD_BYTES };
