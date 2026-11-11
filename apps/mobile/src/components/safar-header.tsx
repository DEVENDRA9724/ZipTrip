import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { MapPin, User, LogIn } from 'lucide-react-native';

interface SafarHeaderProps {
  selectedCity?: string;
  onPressCity?: () => void;
  subtitle?: string;
}

export function SafarHeader({ selectedCity, onPressCity }: SafarHeaderProps) {
  const { user } = require('@/context/AuthContext').useAuth();

  return (
    <View style={styles.navbar}>
      <TouchableOpacity
        style={styles.brandRow}
        activeOpacity={0.85}
        onPress={() => router.push('/')}
      >
        <View style={styles.logoCircle}>
          <Image
            source={require('../../assets/safar-logo.png')}
            style={styles.logoImg}
          />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandMain}>safar</Text>
          <Text style={styles.brandSub}>- SELF DRIVE -</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rightActions}>
        {onPressCity && (
          <TouchableOpacity
            style={styles.cityPill}
            activeOpacity={0.8}
            onPress={onPressCity}
          >
            <MapPin size={13} color="#FF6000" strokeWidth={2.4} />
            <Text style={styles.cityPillText} numberOfLines={1}>
              {selectedCity === 'All' || !selectedCity ? 'All Cities' : selectedCity}
            </Text>
          </TouchableOpacity>
        )}

        {user ? (
          <TouchableOpacity
            style={styles.userBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/wallet')}
          >
            <User size={16} color="#2D114D" strokeWidth={2.4} />
            <Text style={styles.userBtnText} numberOfLines={1}>
              {user.firstName || 'Account'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.signUpBtn}
            activeOpacity={0.88}
            onPress={() => router.push('/auth/login')}
          >
            <LogIn size={14} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.signUpBtnText}>Log In</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoImg: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandMain: {
    fontSize: 23,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#2D114D',
    letterSpacing: -0.5,
    lineHeight: 24,
    textTransform: 'lowercase',
  },
  brandSub: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.8,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 120,
  },
  cityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E1B2E',
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF6000',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  userBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 115,
  },
  userBtnText: {
    color: '#2D114D',
    fontSize: 12,
    fontWeight: '800',
  },
});
