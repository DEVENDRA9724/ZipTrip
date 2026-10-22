// Parses TRUST_PROXY into an Express "trust proxy" value. Unset keeps Express's default (no proxy trusted).
// Accepts: true/false, a hop count ("1"), or a comma list of addresses/subnets/presets ("loopback, 10.0.0.0/8").
// "true" trusts every hop and lets clients spoof X-Forwarded-For; prefer a hop count or explicit subnets.
export function trustProxySetting(
  raw: string | undefined,
): boolean | number | string[] | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^\d+$/.test(value)) return Number(value);
  const entries = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (
    !entries.length ||
    entries.some(
      (item) =>
        !/^[0-9a-fA-F:./]+$|^(loopback|linklocal|uniquelocal)$/.test(item),
    )
  )
    throw new Error(
      'TRUST_PROXY must be true, false, a hop count, or a comma list of addresses, subnets, loopback, linklocal or uniquelocal',
    );
  return entries;
}
