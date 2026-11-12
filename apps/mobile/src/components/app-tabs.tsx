import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Search,
  Calendar,
  Car,
  User,
} from 'lucide-react-native';

const TABS = [
  {
    name: 'Home',
    route: '/',
    match: (p: string) => p === '/' || p === '/index',
    Icon: Home,
  },
  {
    name: 'Explore',
    route: '/cars',
    match: (p: string) => p.startsWith('/cars'),
    Icon: Search,
  },
  {
    name: 'Trips',
    route: '/trips',
    match: (p: string) => p.startsWith('/trips'),
    Icon: Calendar,
  },
  {
    name: 'Host',
    route: '/host',
    match: (p: string) => p.startsWith('/host'),
    Icon: Car,
  },
  {
    name: 'Account',
    route: '/wallet',
    match: (p: string) =>
      p.startsWith('/wallet') || p.startsWith('/verification') || p.startsWith('/guides'),
    Icon: User,
  },
];

function SafarTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (
    pathname.startsWith('/details') ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/auth')
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.barContainer,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 18) : 10,
        },
      ]}
    >
      <View style={styles.barInner}>
        {TABS.map(({ name, route, match, Icon }) => {
          const active = match(pathname);
          return (
            <TouchableOpacity
              key={route}
              onPress={() => router.navigate(route as any)}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <Icon
                size={21}
                color={active ? '#FF6000' : '#94A3B8'}
                strokeWidth={active ? 2.4 : 1.9}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  barContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
