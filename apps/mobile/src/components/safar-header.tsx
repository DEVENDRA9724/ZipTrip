import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import {
  MapPin,
  User,
  LogIn,
  Menu,
  X,
  Car,
  Compass,
  HelpCircle,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  KeyRound,
  Wallet,
  PhoneCall,
  ChevronDown,
} from 'lucide-react-native';

interface SafarHeaderProps {
  selectedCity?: string;
  onPressCity?: () => void;
  subtitle?: string;
}

export function SafarHeader({ selectedCity, onPressCity }: SafarHeaderProps) {
  const { user, logout } = require('@/context/AuthContext').useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateTo = (href: any) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <View style={styles.headerContainer}>
      {/* Main Brand Row */}
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
            <Text style={styles.brandMain}>SAFAR</Text>
            <Text style={styles.brandSub}>SELF DRIVE • GUJARAT</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          {onPressCity && (
            <TouchableOpacity
              style={styles.cityPill}
              activeOpacity={0.8}
              onPress={onPressCity}
            >
              <MapPin size={12} color="#FF6000" strokeWidth={2.5} />
              <Text style={styles.cityPillText} numberOfLines={1}>
                {selectedCity === 'All' || !selectedCity ? 'All Cities' : selectedCity}
              </Text>
              <ChevronDown size={11} color="#64748B" />
            </TouchableOpacity>
          )}

          {/* 24x7 Quick Support Button */}
          <TouchableOpacity
            style={styles.sosBtn}
            activeOpacity={0.8}
            onPress={() => Linking.openURL('tel:+919909031177')}
          >
            <PhoneCall size={14} color="#059669" />
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity
              style={styles.userBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/wallet')}
            >
              <User size={14} color="#0F172A" strokeWidth={2.4} />
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
              <LogIn size={13} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.signUpBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.8}
            onPress={() => setMenuOpen(true)}
          >
            <Menu size={18} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Full Website Menu Drawer Modal */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerSheet}>
            <View style={styles.drawerHeader}>
              <View style={styles.brandRow}>
                <View style={styles.logoCircle}>
                  <Image
                    source={require('../../assets/safar-logo.png')}
                    style={styles.logoImg}
                  />
                </View>
                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandMain}>SAFAR</Text>
                  <Text style={styles.brandSub}>SELF DRIVE • GUJARAT</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setMenuOpen(false)}
                style={styles.closeBtn}
              >
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionTitle}>DISCOVER & BOOK</Text>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/cars')}>
                <Car size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Explore Verified Fleet</Text>
                  <Text style={styles.drawerRowSub}>Search cars by hub, dates, budget & body style</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'guides' } })}
              >
                <Compass size={18} color="#0F172A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Gujarat Road Trip Guides</Text>
                  <Text style={styles.drawerRowSub}>Statue of Unity, Gir, Rann of Kutch, Saputara</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'how' } })}
              >
                <CheckCircle2 size={18} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>How Safar Works</Text>
                  <Text style={styles.drawerRowSub}>4-step digital rental, 8-angle handover & 80/20 GST</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'support' } })}
              >
                <HelpCircle size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>24×7 Roadside SOS & Support</Text>
                  <Text style={styles.drawerRowSub}>Call +91 99090 31177, WhatsApp & FAQs</Text>
                </View>
              </TouchableOpacity>

              <Text style={[styles.drawerSectionTitle, { marginTop: 16 }]}>ACCOUNT & HOST CENTER</Text>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/trips')}>
                <Calendar size={18} color="#0F172A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>My Trips & 8-Angle Inspection</Text>
                  <Text style={styles.drawerRowSub}>Manage bookings, handover photos & GST invoices</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/verification')}>
                <ShieldCheck size={18} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>DigiLocker Aadhaar & DL e-KYC</Text>
                  <Text style={styles.drawerRowSub}>Instant government verification for ₹0 deposit</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/host')}>
                <KeyRound size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Safar Host & Fleet Hub</Text>
                  <Text style={styles.drawerRowSub}>List your car, upload 8-side photos & earn 80%</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/wallet')}>
                <Wallet size={18} color="#0F172A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Account Profile, KYC & Wallet</Text>
                  <Text style={styles.drawerRowSub}>Manage profile, Safar Cash & billing GSTIN</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.drawerFooter}>
              {user ? (
                <TouchableOpacity
                  style={styles.logoutFullBtn}
                  onPress={async () => {
                    setMenuOpen(false);
                    await logout();
                    router.replace('/');
                  }}
                >
                  <Text style={styles.logoutFullBtnText}>Sign Out ({user.email})</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.authBtnRow}>
                  <TouchableOpacity
                    style={styles.drawerLoginBtn}
                    onPress={() => navigateTo('/auth/login')}
                  >
                    <Text style={styles.drawerLoginBtnText}>Log In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.drawerSignUpBtn}
                    onPress={() => navigateTo('/auth/register')}
                  >
                    <Text style={styles.drawerSignUpBtnText}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandMain: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
    lineHeight: 19,
  },
  brandSub: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 120,
  },
  cityPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  sosBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  userBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 100,
  },
  userBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerSectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  drawerRowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerRowSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  drawerFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
  },
  authBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  drawerLoginBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
  },
  drawerLoginBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  drawerSignUpBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FF6000',
    alignItems: 'center',
  },
  drawerSignUpBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  logoutFullBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  logoutFullBtnText: {
    color: '#DC2626',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
