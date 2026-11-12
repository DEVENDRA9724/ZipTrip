import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ImageSourcePropType } from 'react-native';

const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  if (extraUrl) return extraUrl.replace(/\/+$/, '');

  return 'https://safarselfdrive.com/api';
};

export const API_BASE_URL = getApiBaseUrl();
export const SITE_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// Local studio car assets (identical to safarselfdrive.com/cars/*.jpg)
const LOCAL_CAR_IMAGES: Record<string, ImageSourcePropType> = {
  thar: require('../../assets/cars/thar.jpg'),
  creta: require('../../assets/cars/creta.jpg'),
  fortuner: require('../../assets/cars/fortuner.jpg'),
  innova: require('../../assets/cars/innova.jpg'),
  swift: require('../../assets/cars/swift.jpg'),
  fronx: require('../../assets/cars/swift.jpg'),
  baleno: require('../../assets/cars/swift.jpg'),
  bmw: require('../../assets/cars/bmw.jpg'),
  city: require('../../assets/cars/city.jpg'),
  scorpio: require('../../assets/cars/scorpio.jpg'),
  dzire: require('../../assets/cars/dzire.jpg'),
  i20: require('../../assets/cars/i20.jpg'),
  venue: require('../../assets/cars/venue.jpg'),
  mercedes: require('../../assets/cars/mercedes.jpg'),
  carens: require('../../assets/cars/carens.jpg'),
};

export function getVehicleImageSource(car: any): ImageSourcePropType {
  const text = `${car?.make || ''} ${car?.model || ''} ${car?.category || ''}`.toLowerCase();
  for (const [key, asset] of Object.entries(LOCAL_CAR_IMAGES)) {
    if (text.includes(key)) return asset;
  }
  if (text.includes('suv')) return LOCAL_CAR_IMAGES.scorpio;
  if (text.includes('sedan')) return LOCAL_CAR_IMAGES.city;
  if (text.includes('luxury')) return LOCAL_CAR_IMAGES.bmw;
  if (text.includes('hatchback')) return LOCAL_CAR_IMAGES.swift;
  return LOCAL_CAR_IMAGES.creta;
}

export function getCarDistance(car: any): number {
  const hash = String(car?.id || car?.model || '1')
    .split('')
    .reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return Number(((hash % 65) / 10 + 1.2).toFixed(1));
}

export function getVehicleTerms(car: any) {
  const km = Number(car?.includedKilometresPerDay);
  const excess = Number(car?.extraKmCharge);
  const deposit = Number(car?.securityDeposit);
  return {
    kmPerDay: Number.isFinite(km) && km > 0 ? km : 300,
    excessKmRate: Number.isFinite(excess) && excess > 0 ? excess : 12,
    securityDeposit: Number.isFinite(deposit) && deposit >= 0 ? deposit : 2000,
  };
}

export function toApiUrl(value: string) {
  if (!value) return `${SITE_ORIGIN}/cars/creta.jpg`;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/api/')) return `${SITE_ORIGIN}${value}`;
  if (value.startsWith('/')) return `${SITE_ORIGIN}${value}`;
  return `${SITE_ORIGIN}/${value}`;
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
  return value
    .split(',')
    .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .map(toApiUrl);
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

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

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
      const message = typeof payload === 'string'
        ? payload
        : Array.isArray(payload?.message)
          ? payload.message.join(', ')
          : payload?.message;
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.status === 204 ? null : payload;
  } catch (error: any) {
    if (!cleanEndpoint.includes('/auth/profile') && !cleanEndpoint.includes('/favorites')) {
      console.log(`API note on ${cleanEndpoint}:`, error?.message || error);
    }
    throw error;
  }
}
