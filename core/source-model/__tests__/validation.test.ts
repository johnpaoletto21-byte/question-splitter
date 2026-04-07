import { PreparedPageImage } from '../types';
import { PreparedPageValidationError } from '../types';
import { validatePreparedPageImage, validatePreparedPageImages } from '../validation';

function makePage(overrides: Partial<PreparedPageImage> = {}): PreparedPageImage {
  return {
    source_id: 'src_0001_exam_pdf',
    page_number: 1,
    image_path: '/tmp/output/src_0001_exam_pdf_p1.png',
    image_width: 1240,
    image_height: 1754,
    ...overrides,
  };
}

describe('validatePreparedPageImage', () => {
  it('accepts a fully valid PreparedPageImage', () => {
    expect(() => validatePreparedPageImage(makePage())).not.toThrow();
  });

  it('throws when source_id is empty', () => {
    expect(() => validatePreparedPageImage(makePage({ source_id: '' }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when source_id is whitespace', () => {
    expect(() => validatePreparedPageImage(makePage({ source_id: '   ' }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when page_number is 0', () => {
    expect(() => validatePreparedPageImage(makePage({ page_number: 0 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when page_number is negative', () => {
    expect(() => validatePreparedPageImage(makePage({ page_number: -1 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when page_number is a float', () => {
    expect(() => validatePreparedPageImage(makePage({ page_number: 1.5 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when image_path is empty', () => {
    expect(() => validatePreparedPageImage(makePage({ image_path: '' }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when image_width is 0', () => {
    expect(() => validatePreparedPageImage(makePage({ image_width: 0 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when image_width is negative', () => {
    expect(() => validatePreparedPageImage(makePage({ image_width: -100 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when image_height is 0', () => {
    expect(() => validatePreparedPageImage(makePage({ image_height: 0 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('throws when image_height is negative', () => {
    expect(() => validatePreparedPageImage(makePage({ image_height: -1 }))).toThrow(
      PreparedPageValidationError
    );
  });

  it('error code is PREPARED_PAGE_INVALID', () => {
    try {
      validatePreparedPageImage(makePage({ source_id: '' }));
    } catch (err) {
      expect(err).toBeInstanceOf(PreparedPageValidationError);
      expect((err as PreparedPageValidationError).code).toBe('PREPARED_PAGE_INVALID');
    }
  });

  it('allows optional fields to be absent', () => {
    const page = makePage();
    expect(page.file_name).toBeUndefined();
    expect(page.pdf_path).toBeUndefined();
    expect(() => validatePreparedPageImage(page)).not.toThrow();
  });
});

describe('validatePreparedPageImages', () => {
  it('accepts a list of valid pages', () => {
    const pages = [
      makePage({ page_number: 1 }),
      makePage({ source_id: 'src_0002_other', page_number: 2 }),
    ];
    expect(() => validatePreparedPageImages(pages)).not.toThrow();
  });

  it('throws for an empty list', () => {
    expect(() => validatePreparedPageImages([])).toThrow(PreparedPageValidationError);
  });

  it('throws on first invalid page in a list', () => {
    const pages = [
      makePage({ page_number: 1 }),
      makePage({ page_number: 0 }), // invalid
    ];
    expect(() => validatePreparedPageImages(pages)).toThrow(PreparedPageValidationError);
  });
});
