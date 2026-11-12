import React from 'react';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppTabs from '@/components/app-tabs';
import SafarSplashOverlay from '@/components/safar-splash';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={DefaultTheme}>
          <StatusBar style="dark" />
          <AppTabs />
          <SafarSplashOverlay />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
