import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function text(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`${field} is required (maximum ${max} characters)`);
  }
  return value.trim();
}
export function number(value: unknown, field: string, min: number, max: number, integer = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') throw new BadRequestException(`Invalid ${field}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new BadRequestException(`Invalid ${field}`);
  return n;
}
export function choice(value: unknown, field: string, values: readonly string[]) {
  if (typeof value !== 'string' || !values.includes(value)) throw new BadRequestException(`Invalid ${field}`);
  return value;
}
export function admin(user: { role: string }) {
  if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
}
export const PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'] as const;
export const DOCUMENT_KINDS = ['DL', 'RC', 'INSURANCE', 'PUC'] as const;
