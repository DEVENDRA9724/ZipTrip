import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  if (extraUrl) return extraUrl.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  // This fallback is useful for web and simulator development. Physical
  // devices must set EXPO_PUBLIC_API_URL to a reachable HTTPS API host.
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

export function toApiUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${API_BASE_URL}${value}` : value;
}

export function parseImageList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map(toApiUrl);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseImageList(parsed);
  } catch {
    // Older records may contain a comma-separated list rather than JSON.
  }
  return value.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).map(toApiUrl);
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : payload.message;
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.status === 204 ? null : payload;
  } catch (error: any) {
    console.error(`API request error on ${url}:`, error);
    throw error;
  }
}
