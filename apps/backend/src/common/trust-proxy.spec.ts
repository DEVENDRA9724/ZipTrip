import { trustProxySetting } from './trust-proxy';

describe('TRUST_PROXY parsing', () => {
  it('keeps the Express default when unset', () => {
    expect(trustProxySetting(undefined)).toBeUndefined();
    expect(trustProxySetting('  ')).toBeUndefined();
  });
  it('accepts booleans, hop counts and address lists', () => {
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('TRUE')).toBe(true);
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('loopback, 10.0.0.0/8, ::1')).toEqual([
      'loopback',
      '10.0.0.0/8',
      '::1',
    ]);
  });
  it('rejects values that are not addresses or presets', () => {
    expect(() => trustProxySetting('everyone')).toThrow('TRUST_PROXY');
    expect(() => trustProxySetting('10.0.0.1; rm -rf')).toThrow('TRUST_PROXY');
  });
});
