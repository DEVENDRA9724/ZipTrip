import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { router, usePathname } from 'expo-router';
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
} from 'lucide-react-native';

interface SafarHeaderProps {
  selectedCity?: string;
  onPressCity?: () => void;
  subtitle?: string;
}

export function SafarHeader({ selectedCity, onPressCity }: SafarHeaderProps) {
  const { user, logout } = require('@/context/AuthContext').useAuth();
  const pathname = usePathname();
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
              <User size={15} color="#2D114D" strokeWidth={2.4} />
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
              <Text style={styles.signUpBtnText}>Log In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.8}
            onPress={() => setMenuOpen(true)}
          >
            <Menu size={19} color="#2D114D" strokeWidth={2.4} />
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
                  <Text style={styles.brandMain}>safar</Text>
                  <Text style={styles.brandSub}>- SELF DRIVE -</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setMenuOpen(false)}
                style={styles.closeBtn}
              >
                <X size={20} color="#1E1B2E" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionTitle}>PORTAL NAVIGATION</Text>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/')}>
                <Car size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Explore Verified Cars</Text>
                  <Text style={styles.drawerRowSub}>Search fleet by hub, dates, budget & brand</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'guides' } })}
              >
                <Compass size={18} color="#2D114D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Gujarat Travel Guides</Text>
                  <Text style={styles.drawerRowSub}>Statue of Unity, Gir, Rann of Kutch, Saputara</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'how' } })}
              >
                <CheckCircle2 size={18} color="#0D9488" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>How It Works</Text>
                  <Text style={styles.drawerRowSub}>4-step digital rental, 8-angle handover & 80/20 GST</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerRow}
                onPress={() => navigateTo({ pathname: '/guides', params: { section: 'support' } })}
              >
                <HelpCircle size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Help & 24×7 Roadside Support</Text>
                  <Text style={styles.drawerRowSub}>Call +91 99090 31177, WhatsApp & FAQs</Text>
                </View>
              </TouchableOpacity>

              <Text style={[styles.drawerSectionTitle, { marginTop: 16 }]}>CUSTOMER & HOST HUB</Text>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/trips')}>
                <Calendar size={18} color="#2D114D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>My Trips, Agreements & Invoices</Text>
                  <Text style={styles.drawerRowSub}>Manage active bookings & view Dual GST Invoices</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/verification')}>
                <ShieldCheck size={18} color="#0D9488" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>DigiLocker Aadhaar & DL e-KYC</Text>
                  <Text style={styles.drawerRowSub}>Instant government driver verification</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/host')}>
                <KeyRound size={18} color="#FF6000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>List Your Car (Host & Dealer Hub)</Text>
                  <Text style={styles.drawerRowSub}>Earn 80% revenue share & perform handover inspections</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerRow} onPress={() => navigateTo('/wallet')}>
                <Wallet size={18} color="#2D114D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerRowTitle}>Account Profile & Wallet</Text>
                  <Text style={styles.drawerRowSub}>Manage profile, wallet balance & security deposits</Text>
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
    borderBottomColor: '#E5E7EB',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandMain: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#2D114D',
    letterSpacing: -0.5,
    lineHeight: 23,
    textTransform: 'lowercase',
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.7,
    marginTop: 1,
    textTransform: 'uppercase',
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
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 110,
  },
  cityPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E1B2E',
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6000',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  userBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 100,
  },
  userBtnText: {
    color: '#2D114D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subNavBar: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFC',
  },
  subNavScroll: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 16,
  },
  subNavItem: {
    paddingVertical: 2,
  },
  subNavItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6000',
  },
  subNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  subNavTextActive: {
    color: '#FF6000',
    fontWeight: '800',
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
    borderColor: '#2D114D',
    alignItems: 'center',
  },
  drawerLoginBtnText: {
    color: '#2D114D',
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
