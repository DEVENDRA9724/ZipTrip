import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, CalendarDays, ShieldCheck, KeyRound, User } from 'lucide-react-native';

const TABS = [
  { label: 'Home', href: '/', match: (p: string) => p === '/' || p === '/index', Icon: Home },
  { label: 'Trips', href: '/trips', match: (p: string) => p.startsWith('/trips'), Icon: CalendarDays },
  { label: 'Verify', href: '/verification', match: (p: string) => p.startsWith('/verification'), Icon: ShieldCheck },
  { label: 'Host', href: '/host', match: (p: string) => p.startsWith('/host'), Icon: KeyRound },
  { label: 'Account', href: '/wallet', match: (p: string) => p.startsWith('/wallet') || p.startsWith('/guides'), Icon: User },
];

function SafarTabBar() {
  const pathname = usePathname();
  if (pathname.startsWith('/details') || pathname.startsWith('/booking') || pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <View style={styles.bar}>
      {TABS.map(({ label, href, match, Icon }) => {
        const active = match(pathname);
        return (
          <TouchableOpacity
            key={label}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => router.navigate(href as any)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={20} color={active ? '#2D114D' : '#8A8F98'} strokeWidth={active ? 2.4 : 1.9} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs tabBar={() => <SafarTabBar />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="verification" />
      <Tabs.Screen name="host" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="guides" />
      <Tabs.Screen name="details/[id]" />
      <Tabs.Screen name="booking/confirm" />
      <Tabs.Screen name="booking/agreement" />
      <Tabs.Screen name="auth/login" />
      <Tabs.Screen name="auth/register" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D9DCE1',
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#EFE9F6',
  },
  label: {
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 2,
    fontWeight: '500',
  },
  labelActive: {
    color: '#2D114D',
    fontWeight: '700',
  },
});
