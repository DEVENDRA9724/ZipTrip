import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Car, Calendar, ShieldCheck, KeyRound, User } from 'lucide-react-native';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6000',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: Platform.OS === 'ios' ? 84 : 66,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Car size={22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color }) => <Calendar size={21} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: 'e-KYC',
          tabBarIcon: ({ color }) => <ShieldCheck size={22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: 'Host Hub',
          tabBarIcon: ({ color }) => <KeyRound size={21} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <User size={21} color={color} strokeWidth={2.2} />,
        }}
      />

      {/* Hidden Stack Routes */}
      <Tabs.Screen name="details/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="booking/confirm" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="booking/agreement" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="auth/login" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="auth/register" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
