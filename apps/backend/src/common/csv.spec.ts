import { csvCell } from './csv';

describe('CSV cell encoding', () => {
  it.each(['=SUM(A1:A2)', '+91 98', '-2+3', '@cmd', '\t=1', '\r=1'])(
    'neutralises formula-like text %p',
    (value) => {
      expect(csvCell(value)).toBe('"\'' + value + '"');
    },
  );
  it('quotes embedded quotes and keeps ordinary text and numbers unchanged', () => {
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell('SF-123')).toBe('"SF-123"');
    expect(csvCell(-2000)).toBe('"-2000"');
    expect(csvCell(null)).toBe('""');
  });
});
