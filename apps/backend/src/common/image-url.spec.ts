import { externalImageUrl } from './image-url';

describe('Admin vehicle image URL validation', () => {
  it('accepts absolute https URLs and normalises them', () => {
    expect(externalImageUrl('https://cdn.example.com/cars/creta.jpg')).toBe(
      'https://cdn.example.com/cars/creta.jpg',
    );
    expect(
      externalImageUrl('  https://cdn.example.com/a.png?w=800&q=80  '),
    ).toBe('https://cdn.example.com/a.png?w=800&q=80');
  });

  it('treats a blank value as no image', () => {
    for (const value of [undefined, null, '', '   '])
      expect(externalImageUrl(value)).toBeNull();
  });

  it.each([
    ['http (plain text transport)', 'http://cdn.example.com/a.jpg'],
    ['javascript scheme', 'javascript:alert(document.cookie)'],
    ['mixed-case javascript scheme', 'JaVaScRiPt:alert(1)'],
    ['data URL', 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+'],
    ['file URL', 'file:///etc/passwd'],
    ['attribute break-out', 'https://x.example/a.jpg" onerror="alert(1)'],
    ['markup injection', 'https://x.example/<img src=x onerror=alert(1)>'],
    ['single-quote break-out', "https://x.example/a.jpg' onload='alert(1)"],
    ['embedded whitespace', 'https://x.example/a.jpg onerror=alert(1)'],
    ['credentials in URL', 'https://user:pass@x.example/a.jpg'],
    ['protocol-relative', '//x.example/a.jpg'],
    ['relative path', '/api/media/abc'],
    ['malformed', 'https://'],
    ['control character', 'https://x.example/a\u0000.jpg'],
    ['non-string', 42],
    ['too long', 'https://x.example/' + 'a'.repeat(2048)],
  ])('rejects %s', (_label, value) => {
    expect(() => externalImageUrl(value)).toThrow('https://');
  });
});
