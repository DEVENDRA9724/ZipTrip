import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Car, CalendarDays, User, Sparkles } from 'lucide-react-native';

const MAIN_TABS = [
  {
    label: 'Home',
    href: '/',
    match: (p: string) => p === '/' || p === '/index',
    Icon: Home,
  },
  {
    label: 'Explore',
    href: '/cars',
    match: (p: string) => p.startsWith('/cars'),
    Icon: Car,
  },
  {
    label: 'My Trips',
    href: '/trips',
    match: (p: string) => p.startsWith('/trips'),
    Icon: CalendarDays,
  },
  {
    label: 'Account',
    href: '/wallet',
    match: (p: string) =>
      p.startsWith('/wallet') || p.startsWith('/verification') || p.startsWith('/guides'),
    Icon: User,
  },
];

function SafarTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  if (
    pathname.startsWith('/details') ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/auth')
  ) {
    return null;
  }

  const isHostActive = pathname.startsWith('/host');
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 22 : 10);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding }]}>
      {MAIN_TABS.map(({ label, href, match, Icon }) => {
        const active = match(pathname);
        return (
          <TouchableOpacity
            key={label}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => router.navigate(href as any)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon
                size={20}
                color={active ? '#FF6000' : '#64748B'}
                strokeWidth={active ? 2.4 : 1.9}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            {active && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}

      {/* Host & Earn Action Pill */}
      <TouchableOpacity
        style={styles.hostItem}
        activeOpacity={0.85}
        onPress={() => router.navigate('/host' as any)}
      >
        <View style={[styles.hostCircle, isHostActive && styles.hostCircleActive]}>
          <Sparkles size={13} color={isHostActive ? '#FFFFFF' : '#FF6000'} />
          <Text style={[styles.hostText, isHostActive && styles.hostTextActive]}>
            Host{'\n'}& Earn
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs tabBar={() => <SafarTabBar />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cars" />
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    paddingHorizontal: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrap: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#FFF7ED',
  },
  label: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  labelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6000',
    marginTop: 2,
  },
  hostItem: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCircle: {
    width: 60,
    height: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FF6000',
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  hostCircleActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  hostText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6000',
    textAlign: 'center',
    lineHeight: 11,
    marginTop: 1,
  },
  hostTextActive: {
    color: '#FFFFFF',
  },
});
