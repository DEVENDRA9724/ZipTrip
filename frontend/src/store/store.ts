import { create } from 'zustand';

const API_BASE_URL = 'http://localhost:5000/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'ADMIN' | 'CUSTOMER';
  kyc_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNKNOWN';
  aadhaar_number?: string;
  pan_number?: string;
  dl_number?: string;
  selfie_url?: string;
}

export interface VehicleType {
  id: string;
  category_name: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  seating_capacity: number;
  transmission: string;
}

export interface Location {
  id: string;
  hub_name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
}

export interface PricingResult {
  baseFare: number;
  durationHours: number;
  durationDays: number;
  weekendSurge: boolean;
  airportSurge: boolean;
  weekendSurgeAmount: number;
  airportSurgeAmount: number;
  totalPrice: number;
}

export interface Vehicle {
  id: string;
  type_id: string;
  location_id: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  features: string | string[]; // Can be stringified JSON or parsed array
  images: string[];
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE';
  type: VehicleType;
  location: Location;
  pricing?: PricingResult;
}

export interface Booking {
  id: string;
  user_id: string;
  vehicle_id: string;
  pickup_time: string;
  dropoff_time: string;
  total_price: number;
  status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  agreement_pdf_url?: string;
  esign_completed?: boolean;
}

interface AppState {
  token: string | null;
  user: User | null;
  locations: Location[];
  availableVehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  searchParams: {
    locationId: string;
    pickupTime: string;
    dropoffTime: string;
  } | null;
  selectedVehicle: Vehicle | null;
  currentBooking: Booking | null;

  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;

  // Actions
  setSearchParams: (params: { locationId: string; pickupTime: string; dropoffTime: string }) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  clearError: () => void;
  logout: () => void;

  // API Thunks
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, fullName: string, phone: string) => Promise<boolean>;
  fetchLocations: () => Promise<void>;
  searchVehicles: (locationId: string, pickupTime: string, dropoffTime: string) => Promise<void>;
  verifyKYC: (formData: FormData) => Promise<boolean>;
  createBooking: (vehicleId: string, pickupTime: string, dropoffTime: string, esignCompleted?: boolean) => Promise<boolean>;
  extendBooking: (bookingId: string, additionalHours: number) => Promise<{ success: boolean; fare?: number; error?: string }>;
  completeHandover: (bookingId: string, fuelLevel: number, scratches: string[]) => Promise<boolean>;
  esignBooking: (bookingId: string, aadhaarNumber: string, otp: string) => Promise<boolean>;
  dispatchTelemetryCommand: (vehicleId: string, command: string, speedLimit?: number) => Promise<boolean>;
  fetchHostDashboard: () => Promise<any>;
  uploadAdminUserDocument: (userId: string, docName: string, file: File) => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  locations: [],
  availableVehicles: [],
  loading: false,
  error: null,
  searchParams: null,
  selectedVehicle: null,
  currentBooking: null,

  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  setSearchParams: (params) => set({ searchParams: params }),
  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
  clearError: () => set({ error: null }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, selectedVehicle: null, currentBooking: null, authModalOpen: false });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  register: async (email, password, fullName, phone) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  fetchLocations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/locations`);
      if (!res.ok) throw new Error('Failed to fetch locations');
      const data = await res.json();
      set({ locations: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  searchVehicles: async (locationId, pickupTime, dropoffTime) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams({
        location_id: locationId,
        pickup_time: pickupTime,
        dropoff_time: dropoffTime
      }).toString();

      const res = await fetch(`${API_BASE_URL}/vehicles/available?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      set({ availableVehicles: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  verifyKYC: async (formData) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/kyc/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'KYC verification failed');

      const updatedUser = {
        ...get().user!,
        kyc_status: data.kyc_status,
        selfie_url: data.user?.selfie_url
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  createBooking: async (vehicleId, pickupTime, dropoffTime, esignCompleted) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          pickup_time: pickupTime,
          dropoff_time: dropoffTime,
          esign_completed: esignCompleted
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking creation failed');

      set({ currentBooking: data.booking, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  extendBooking: async (bookingId, additionalHours) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId, additionalHours })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extension failed');
      set({ loading: false });
      return { success: true, fare: data.extensionFare };
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return { success: false, error: err.message };
    }
  },

  completeHandover: async (bookingId, fuelLevel, scratches) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/handover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId, fuelLevel, scratches })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Handover checklist submission failed');
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  esignBooking: async (bookingId, aadhaarNumber, otp) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/esign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId, aadhaarNumber, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aadhaar signing failed');
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  dispatchTelemetryCommand: async (vehicleId, command, speedLimit) => {
    set({ error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vehicles/telemetry/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vehicleId, command, speedLimit })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Command dispatch failed');
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  fetchHostDashboard: async () => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/host/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch host stats');
      set({ loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  uploadAdminUserDocument: async (userId, docName, file) => {
    set({ loading: true, error: null });
    const { token } = get();
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('docName', docName);
      formData.append('document_file', file);

      const res = await fetch(`${API_BASE_URL}/admin/users/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  }
}));
