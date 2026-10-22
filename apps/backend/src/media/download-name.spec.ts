import { downloadName } from './media.controller';

describe('downloadName', () => {
  it('names downloads by document kind with a real file extension', () => {
    expect(downloadName('RC', 'image/jpeg')).toBe('safar-rc-document.jpg');
    expect(downloadName('INSURANCE', 'image/png')).toBe(
      'safar-insurance-document.png',
    );
    expect(downloadName('PUC', 'image/webp')).toBe('safar-puc-document.webp');
    expect(downloadName('DL', 'application/pdf')).toBe('safar-dl-document.pdf');
  });

  it('falls back safely for unknown kinds and types, and never lets quotes or separators into the header', () => {
    expect(downloadName(null, 'image/jpeg')).toBe('safar-document.jpg');
    expect(downloadName('FRONT', 'application/octet-stream')).toBe(
      'safar-front-document',
    );
    expect(downloadName('a"b/..\\c', 'image/png')).toBe(
      'safar-a-b-c-document.png',
    );
  });
});
