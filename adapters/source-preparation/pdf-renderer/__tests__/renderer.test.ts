/**
 * Integration test for the PDF renderer adapter.
 *
 * Creates real PDF fixtures using pdf-lib (devDependency), then calls
 * renderPdfSource and verifies that PreparedPageImage entries are
 * produced with correct structural properties.
 *
 * This is the targeted integration test required by TASK-102 proof obligations.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { renderPdfSource } from '../renderer';
import { PdfRenderError } from '../types';
import type { PdfSource } from '../../../../core/source-model/types';

// ── Fixture helpers ────────────────────────────────────────────────────────

/**
 * Create a real (blank) PDF file with `pageCount` pages of 612×792 pt (US Letter).
 * Returns the absolute path to the written file.
 */
async function createTestPdf(
  dir: string,
  name: string,
  pageCount: number,
  pageSize: [number, number] = [612, 792],
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage(pageSize);
  }
  const bytes = await pdfDoc.save();
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

function makeSource(
  sourceId: string,
  filePath: string,
  inputOrder = 0,
): PdfSource {
  return {
    source_id: sourceId,
    file_path: filePath,
    file_name: path.basename(filePath),
    input_order: inputOrder,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('renderPdfSource — integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-render-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── page count ────────────────────────────────────────────────────────

  it('renders a 1-page PDF into exactly 1 PreparedPageImage', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'one-page.pdf', 1);
    const source = makeSource('src_0000_one_page', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    expect(pages).toHaveLength(1);
  });

  it('renders a 3-page PDF into exactly 3 PreparedPageImages', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'three-page.pdf', 3);
    const source = makeSource('src_0001_three_page', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    expect(pages).toHaveLength(3);
  });

  // ── page_number is 1-based (DEC-004) ─────────────────────────────────

  it('assigns 1-based page_number to each rendered page', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'numbered.pdf', 3);
    const source = makeSource('src_0002_numbered', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    expect(pages[0].page_number).toBe(1);
    expect(pages[1].page_number).toBe(2);
    expect(pages[2].page_number).toBe(3);
  });

  // ── dimensions ───────────────────────────────────────────────────────

  it('records positive integer image_width and image_height for each page', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'dims.pdf', 2);
    const source = makeSource('src_0003_dims', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    for (const page of pages) {
      expect(Number.isInteger(page.image_width)).toBe(true);
      expect(Number.isInteger(page.image_height)).toBe(true);
      expect(page.image_width).toBeGreaterThan(0);
      expect(page.image_height).toBeGreaterThan(0);
    }
  });

  it('reflects non-square page dimensions correctly (A4 vs Letter)', async () => {
    // Letter 612x792 rendered at 1.5× scale → 918×1188
    const letterPath = await createTestPdf(tmpDir, 'letter.pdf', 1, [612, 792]);
    const letterSource = makeSource('src_0004_letter', letterPath);
    const [letterPage] = await renderPdfSource(letterSource, tmpDir);

    // A4 595x842 rendered at 1.5× → 892×1263
    const a4Path = await createTestPdf(tmpDir, 'a4.pdf', 1, [595, 842]);
    const a4Source = makeSource('src_0005_a4', a4Path);
    const [a4Page] = await renderPdfSource(a4Source, tmpDir);

    // Dimensions must differ between the two page sizes.
    expect(letterPage.image_width).not.toBe(a4Page.image_width);
    expect(letterPage.image_height).not.toBe(a4Page.image_height);
  });

  // ── source linkage ────────────────────────────────────────────────────

  it('stamps every page with the source_id of the input PdfSource', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'linkage.pdf', 2);
    const source = makeSource('src_0006_linkage', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    for (const page of pages) {
      expect(page.source_id).toBe('src_0006_linkage');
    }
  });

  // ── image files ───────────────────────────────────────────────────────

  it('creates PNG files on disk at the reported image_path', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'files.pdf', 2);
    const source = makeSource('src_0007_files', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    for (const page of pages) {
      expect(fs.existsSync(page.image_path)).toBe(true);
      expect(page.image_path.endsWith('.png')).toBe(true);
    }
  });

  it('embeds source_id and page tag in the image file name', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'naming.pdf', 2);
    const source = makeSource('src_0008_naming', pdfPath);
    const pages = await renderPdfSource(source, tmpDir);
    expect(path.basename(pages[0].image_path)).toBe(
      'src_0008_naming_page_0001.png',
    );
    expect(path.basename(pages[1].image_path)).toBe(
      'src_0008_naming_page_0002.png',
    );
  });

  // ── optional traceability fields ──────────────────────────────────────

  it('sets file_name and pdf_path for traceability', async () => {
    const pdfPath = await createTestPdf(tmpDir, 'trace.pdf', 1);
    const source = makeSource('src_0009_trace', pdfPath);
    const [page] = await renderPdfSource(source, tmpDir);
    expect(page.file_name).toBe('trace.pdf');
    expect(page.pdf_path).toBe(pdfPath);
  });

  // ── error handling ────────────────────────────────────────────────────

  it('throws PdfRenderError when the PDF path does not exist', async () => {
    const source = makeSource('src_0010_missing', '/does/not/exist/missing.pdf');
    await expect(renderPdfSource(source, tmpDir)).rejects.toThrow(PdfRenderError);
  });

  it('PdfRenderError carries code = PDF_RENDER_FAILED and source_id', async () => {
    const source = makeSource('src_0011_err', '/does/not/exist.pdf');
    try {
      await renderPdfSource(source, tmpDir);
      fail('Expected PdfRenderError');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfRenderError);
      const e = err as PdfRenderError;
      expect(e.code).toBe('PDF_RENDER_FAILED');
      expect(e.source_id).toBe('src_0011_err');
    }
  });
});
