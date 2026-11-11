import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, Briefcase, ShieldCheck, UserCircle2 } from 'lucide-react-native';

function CustomFloatingTabBar() {
  const pathname = usePathname();

  // Hide floating tab bar on detail, checkout, and auth screens
  if (
    pathname.startsWith('/details') ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/auth')
  ) {
    return null;
  }

  const mainTabs = [
    { name: 'Home', href: '/', active: pathname === '/' || pathname === '/index', icon: Home },
    { name: 'My Trips', href: '/trips', active: pathname.startsWith('/trips'), icon: Briefcase },
    { name: 'e-KYC', href: '/verification', active: pathname.startsWith('/verification'), icon: ShieldCheck },
    { name: 'Profile', href: '/wallet', active: pathname.startsWith('/wallet') || pathname.startsWith('/guides'), icon: UserCircle2 },
  ];

  const isHostActive = pathname.startsWith('/host');

  return (
    <View style={styles.floatingWrap} pointerEvents="box-none">
      <View style={styles.barRow}>
        {/* Left Floating Capsule Pill */}
        <View style={styles.capsulePill}>
          {mainTabs.map((tab) => {
            const IconComp = tab.icon;
            return (
              <TouchableOpacity
                key={tab.name}
                style={[styles.tabItem, tab.active && styles.tabItemActive]}
                activeOpacity={0.85}
                onPress={() => router.push(tab.href as any)}
              >
                <IconComp
                  size={20}
                  color={tab.active ? '#FF6000' : '#1E1B2E'}
                  strokeWidth={tab.active ? 2.5 : 2}
                />
                <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Standalone Circular "Host & Earn" Button */}
        <TouchableOpacity
          style={[styles.hostCircleBtn, isHostActive && styles.hostCircleBtnActive]}
          activeOpacity={0.88}
          onPress={() => router.push('/host')}
        >
          <Text style={[styles.hostTopText, isHostActive && { color: '#FFFFFF' }]}>Host</Text>
          <Text style={[styles.hostBottomText, isHostActive && { color: '#FFD7AA' }]}>& Earn</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={() => <CustomFloatingTabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="guides" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="verification" />
      <Tabs.Screen name="host" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="details/[id]" />
      <Tabs.Screen name="booking/confirm" />
      <Tabs.Screen name="booking/agreement" />
      <Tabs.Screen name="auth/login" />
      <Tabs.Screen name="auth/register" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 22 : 14,
    zIndex: 999,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  capsulePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 999,
    padding: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: '#FFF3EC',
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E1B2E',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#FF6000',
    fontWeight: '900',
  },
  hostCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  hostCircleBtnActive: {
    backgroundColor: '#2D114D',
    borderColor: '#FF6000',
  },
  hostTopText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 14,
  },
  hostBottomText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0D9488',
    lineHeight: 14,
  },
});
