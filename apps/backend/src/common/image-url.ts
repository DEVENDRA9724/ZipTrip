import { BadRequestException } from '@nestjs/common';

// Vehicle image URLs typed by administrators end up in public pages. Only absolute https URLs without credentials are
// accepted; javascript:, data:, file:, http: and anything that could break out of an HTML attribute is rejected.
// Uploaded photos are referenced through /api/media and never need this field.
export function externalImageUrl(value: unknown): string | null {
  if (value == null || (typeof value === 'string' && !value.trim()))
    return null;
  const raw = typeof value === 'string' ? value.trim() : '';
  const invalid = new BadRequestException(
    'Image URL must be a single https:// address (max 2048 characters)',
  );
  const hasControlCharacter = [...raw].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  if (
    !raw ||
    raw.length > 2048 ||
    hasControlCharacter ||
    /[\s"'<>`\\]/.test(raw)
  )
    throw invalid;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid;
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw invalid;
  return url.href;
}
