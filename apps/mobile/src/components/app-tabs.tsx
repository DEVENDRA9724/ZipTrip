import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, CalendarDays, ShieldCheck, KeyRound, User, Sparkles } from 'lucide-react-native';

const MAIN_TABS = [
  { label: 'Home', href: '/', match: (p: string) => p === '/' || p === '/index', Icon: Home },
  { label: 'My Trips', href: '/trips', match: (p: string) => p.startsWith('/trips'), Icon: CalendarDays },
  { label: 'Verify', href: '/verification', match: (p: string) => p.startsWith('/verification'), Icon: ShieldCheck },
  { label: 'Profile', href: '/wallet', match: (p: string) => p.startsWith('/wallet') || p.startsWith('/guides'), Icon: User },
];

function SafarTabBar() {
  const pathname = usePathname();
  if (pathname.startsWith('/details') || pathname.startsWith('/booking') || pathname.startsWith('/auth')) {
    return null;
  }

  const isHostActive = pathname.startsWith('/host');

  return (
    <View style={styles.bar}>
      {MAIN_TABS.map(({ label, href, match, Icon }) => {
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

      {/* Prominent Host & Earn Badge (Matching & Beating Snippet) */}
      <TouchableOpacity
        style={styles.hostItem}
        activeOpacity={0.8}
        onPress={() => router.navigate('/host' as any)}
      >
        <View style={[styles.hostCircle, isHostActive && styles.hostCircleActive]}>
          <Sparkles size={14} color={isHostActive ? '#FFFFFF' : '#FF6000'} />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#F3EEFA',
  },
  label: {
    fontSize: 10,
    color: '#8A8F98',
    marginTop: 2,
    fontWeight: '600',
  },
  labelActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
  hostItem: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCircle: {
    width: 58,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FF7A00',
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  hostCircleActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
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
