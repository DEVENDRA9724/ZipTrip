import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../services/api';

export type SafarUserRole = 'CUSTOMER' | 'HOST' | 'ADMIN';
export type SafarAppMode = 'customer' | 'host';

interface AuthContextType {
  user: any;
  token: string | null;
  loading: boolean;
  userRole: SafarUserRole;
  isVerifiedHost: boolean;
  isAdmin: boolean;
  appMode: SafarAppMode;
  switchAppMode: (mode: SafarAppMode) => Promise<void>;
  setUserRole: (role: SafarUserRole) => Promise<void>;
  activateHostPartner: (details?: { businessName?: string; city?: string; fleetCount?: string }) => Promise<void>;
  loginAsRole: (role: SafarUserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  requestLoginOtp: (phone: string) => Promise<{ maskedPhone?: string; devOtp?: string }>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(rawRole?: string | null): SafarUserRole {
  const upper = String(rawRole || '').toUpperCase();
  if (upper === 'ADMIN' || upper === 'SUPERADMIN') return 'ADMIN';
  if (upper === 'HOST' || upper === 'PARTNER' || upper === 'DEALER') return 'HOST';
  return 'CUSTOMER';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleOverride, setRoleOverride] = useState<SafarUserRole | null>(null);
  const [appMode, setAppMode] = useState<SafarAppMode>('customer');

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedRole, storedMode] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('safar_user_role'),
        AsyncStorage.getItem('safar_app_mode'),
      ]);

      if (storedRole === 'CUSTOMER' || storedRole === 'HOST' || storedRole === 'ADMIN') {
        setRoleOverride(storedRole);
      }
      if (storedMode === 'customer' || storedMode === 'host') {
        setAppMode(storedMode);
      }

      if (storedToken) {
        setToken(storedToken);
        if (storedToken.startsWith('local-role-')) {
          const savedProfile = await AsyncStorage.getItem('safar_local_user');
          if (savedProfile) {
            setUser(JSON.parse(savedProfile));
          }
        } else {
          const profile = await apiRequest('/auth/profile');
          setUser(profile);
          const apiRole = normalizeRole(profile?.role);
          if (!storedRole && (apiRole === 'HOST' || apiRole === 'ADMIN')) {
            setRoleOverride(apiRole);
          }
        }
      } else {
        setAppMode('customer');
      }
    } catch (e) {
      console.log('Error loading auth from storage:', e);
      await AsyncStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setAppMode('customer');
    } finally {
      setLoading(false);
    }
  };

  const userRole: SafarUserRole = roleOverride || normalizeRole(user?.role);
  const isVerifiedHost = Boolean(user) && (userRole === 'HOST' || userRole === 'ADMIN');
  const isAdmin = Boolean(user) && userRole === 'ADMIN';

  const switchAppMode = async (mode: SafarAppMode) => {
    setAppMode(mode);
    await AsyncStorage.setItem('safar_app_mode', mode);
  };

  const setUserRole = async (role: SafarUserRole) => {
    setRoleOverride(role);
    await AsyncStorage.setItem('safar_user_role', role);
    if (user) {
      setUser({ ...user, role });
    }
    if (role === 'CUSTOMER') {
      await switchAppMode('customer');
    }
  };

  const activateHostPartner = async (details?: { businessName?: string; city?: string; fleetCount?: string }) => {
    const nextRole: SafarUserRole = userRole === 'ADMIN' ? 'ADMIN' : 'HOST';
    setRoleOverride(nextRole);
    await AsyncStorage.setItem('safar_user_role', nextRole);
    if (details) {
      await AsyncStorage.setItem('safar_host_partner_details', JSON.stringify(details));
    }
    if (user) {
      setUser({ ...user, role: nextRole, hostDetails: details });
    }
    await switchAppMode('host');
  };

  const loginAsRole = async (role: SafarUserRole) => {
    const mockUser = {
      id: role === 'HOST' ? 'host-partner-1' : role === 'ADMIN' ? 'admin-1' : 'customer-1',
      firstName: role === 'HOST' ? 'Safar Host' : role === 'ADMIN' ? 'Safar Admin' : 'Devendra',
      lastName: role === 'HOST' ? 'Partner' : '',
      email: role === 'HOST' ? 'host@safarselfdrive.com' : role === 'ADMIN' ? 'admin@safarselfdrive.com' : 'member@safarselfdrive.com',
      phone: '+91 98765 43210',
      role,
    };
    const localToken = `local-role-${role.toLowerCase()}`;
    await AsyncStorage.setItem('token', localToken);
    await AsyncStorage.setItem('safar_local_user', JSON.stringify(mockUser));
    await AsyncStorage.setItem('safar_user_role', role);
    setToken(localToken);
    setUser(mockUser);
    setRoleOverride(role);
    await switchAppMode(role === 'HOST' || role === 'ADMIN' ? 'host' : 'customer');
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await AsyncStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      const apiRole = normalizeRole(res.user?.role);
      setRoleOverride(apiRole);
      await AsyncStorage.setItem('safar_user_role', apiRole);
      if (apiRole === 'HOST' || apiRole === 'ADMIN') {
        await switchAppMode('host');
      } else {
        await switchAppMode('customer');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const requestLoginOtp = async (phone: string) => {
    return apiRequest('/auth/login/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  };

  const loginWithOtp = async (phone: string, otp: string) => {
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });
      await AsyncStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      const apiRole = normalizeRole(res.user?.role);
      setRoleOverride(apiRole);
      await AsyncStorage.setItem('safar_user_role', apiRole);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await AsyncStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      const chosenRole = normalizeRole(data?.role || res.user?.role);
      setRoleOverride(chosenRole);
      await AsyncStorage.setItem('safar_user_role', chosenRole);
      if (chosenRole === 'HOST' || chosenRole === 'ADMIN') {
        await switchAppMode('host');
      } else {
        await switchAppMode('customer');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await AsyncStorage.multiRemove(['token', 'safar_local_user', 'safar_user_role', 'safar_app_mode']);
      setToken(null);
      setUser(null);
      setRoleOverride(null);
      setAppMode('customer');
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!token || token.startsWith('local-role-')) return;
    try {
      const profile = await apiRequest('/auth/profile');
      setUser(profile);
    } catch (e) {
      console.log('Error refreshing profile:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        userRole,
        isVerifiedHost,
        isAdmin,
        appMode,
        switchAppMode,
        setUserRole,
        activateHostPartner,
        loginAsRole,
        login,
        requestLoginOtp,
        loginWithOtp,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
