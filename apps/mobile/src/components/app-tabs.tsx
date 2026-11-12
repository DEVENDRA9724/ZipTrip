import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Search,
  Calendar,
  Car,
  User,
} from 'lucide-react-native';

const TABS = [
  { name: 'Home', route: '/', Icon: Home },
  { name: 'Explore', route: '/cars', Icon: Search },
  { name: 'Trips', route: '/trips', Icon: Calendar },
  { name: 'Host', route: '/host', Icon: Car },
  { name: 'Account', route: '/wallet', Icon: User },
];

export default function AppTabs() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(route);
  };

  return (
    <View
      style={[
        styles.barContainer,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 10,
        },
      ]}
    >
      <View style={styles.barInner}>
        {TABS.map(({ name, route, Icon }) => {
          const active = isActive(route);
          return (
            <TouchableOpacity
              key={route}
              onPress={() => router.push(route as any)}
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
