import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { request, type APIRequestContext } from '@playwright/test';

export type Role = 'admin' | 'admin2' | 'customer' | 'customer2' | 'hostA' | 'hostB' | 'dealer' | 'blockme';
type State = {
  baseURL: string;
  password: string;
  users: Record<Role, { id: string; email: string; role: string; firstName: string }>;
  vehicles: { id: string; hostId: string; make: string; model: string; city: string; status: string }[];
};

const dir = () => {
  const value = process.env.SAFAR_PW_DIR;
  if (!value) throw new Error('SAFAR_PW_DIR is not set; run through playwright.config.ts');
  return value;
};
export const state = (): State => JSON.parse(readFileSync(join(dir(), 'state.json'), 'utf8'));
export const storageFile = (role: Role) => join(dir(), `storage-${role}.json`);

// API client carrying a role's saved session cookie (created once in auth.setup.ts).
export function apiAs(role?: Role): Promise<APIRequestContext> {
  return request.newContext({ baseURL: state().baseURL, ...(role ? { storageState: storageFile(role) } : {}) });
}

// Distinct, valid PNGs (the API rejects repeated photos and corrupt images), rendered with the backend's sharp.
const sharp = createRequire(join(process.cwd(), 'apps', 'backend', 'package.json'))('sharp');
export const pngImage = (seed: number): Promise<Buffer> => sharp({ create: { width: 24, height: 16, channels: 3, background: { r: (seed * 47) % 256, g: (seed * 91) % 256, b: 120 } } }).png().toBuffer();

// Minimal valid images generated in memory: a 1x1 PNG.
export const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export async function uploadMedia(api: APIRequestContext, kind: string, buffer = PNG_1PX, mimeType = 'image/png', name = 'doc.png') {
  return api.post('/api/media?kind=' + kind, { multipart: { file: { name, mimeType, buffer } } });
}

// datetime-local value for a date N days from now at the given hour (local time).
export function localInput(daysFromNow: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}
export const isoFromLocal = (value: string) => new Date(value).toISOString();
