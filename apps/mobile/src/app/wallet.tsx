import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest } from '@/services/api';
import {
  Wallet,
  User,
  ShieldCheck,
  CreditCard,
  Gift,
  Share2,
  MapPin,
  Heart,
  Headphones,
  FileText,
  Star,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X,
  Phone,
} from 'lucide-react-native';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export default function ProfileWalletScreen() {
  const { user, logout, refreshProfile } = require('@/context/AuthContext').useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whatsappUpdates, setWhatsappUpdates] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchWallet();
      }
    }, [user])
  );

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/wallet');
      setBalance(Number(data.balance || 0));
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (amt: number) => {
    if (amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: amt }),
      });
      Alert.alert('Success', `₹${amt.toLocaleString('en-IN')} added to your Safar Wallet.`);
      setDepositAmount('');
      setDepositModalOpen(false);
      await fetchWallet();
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Deposit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Safar Self Drive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.name || 'Safar Guest';

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* ────────── HEADER ────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile & Account</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ────────── USER CARD ────────── */}
        {user ? (
          <View style={s.userCard}>
            <View style={s.userAvatarBox}>
              <Text style={s.userAvatarInitial}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userNameText}>{userName}</Text>
              <Text style={s.userContactText}>{user.phone || user.email || 'Verified Member'}</Text>
              <View style={s.kycBadge}>
                <ShieldCheck size={12} color="#059669" />
                <Text style={s.kycBadgeText}>
                  {user.isVerified ? 'DigiLocker KYC Verified' : 'Standard Member'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.editProfileBtn}
              onPress={() => router.push('/verification')}
              activeOpacity={0.75}
            >
              <Text style={s.editProfileText}>KYC</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.guestCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.guestTitle}>Welcome to Safar</Text>
              <Text style={s.guestSub}>Sign in to manage bookings, wallet & host perks</Text>
            </View>
            <TouchableOpacity
              style={s.loginBtn}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.8}
            >
              <Text style={s.loginBtnText}>Log In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ────────── HOST SWITCH CALLOUT BANNER ────────── */}
        <TouchableOpacity
          style={s.hostSwitchBanner}
          onPress={() => router.push('/host')}
          activeOpacity={0.88}
        >
          <View style={s.hostBannerIcon}>
            <Sparkles size={20} color="#FF7A00" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hostBannerTitle}>Safar Host Center</Text>
            <Text style={s.hostBannerSub}>Manage your hosted vehicles, guest handovers & earnings</Text>
          </View>
          <View style={s.switchModeBtn}>
            <Text style={s.switchModeBtnText}>Open</Text>
            <ArrowRight size={14} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* ────────── SAFAR WALLET CARD ────────── */}
        <View style={s.walletCard}>
          <View style={s.walletHeaderRow}>
            <View style={s.walletIconBox}>
              <Wallet size={18} color="#2D114D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.walletTitle}>Safar Digital Cash</Text>
              <Text style={s.walletSub}>Instant zero-fee booking checkout & refunds</Text>
            </View>
            <Text style={s.walletBalance}>₹{balance.toLocaleString('en-IN')}</Text>
          </View>

          {/* Quick Add Pills */}
          <View style={s.quickAmountsRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={s.quickAmtBtn}
                onPress={() => handleDeposit(amt)}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                <Plus size={10} color="#2D114D" />
                <Text style={s.quickAmtText}>₹{amt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.customAmtBtn}
              onPress={() => setDepositModalOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={s.customAmtText}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── QUICK TILES MENU ────────── */}
        <View style={s.menuSection}>
          <Text style={s.menuSectionTitle}>Preferences & Services</Text>

          <View style={s.menuGroup}>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <MapPin size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Change City</Text>
                <Text style={s.menuItemSub}>Ahmedabad (Current)</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/verification')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <ShieldCheck size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>DigiLocker KYC Verification</Text>
                <Text style={s.menuItemSub}>Required for Zero Security Deposit drives</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/trips')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <CreditCard size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>My Invoices & GST Bills</Text>
                <Text style={s.menuItemSub}>Download GST-compliant tax invoices</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/guides')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <Headphones size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Help & 24x7 Gujarat Desk</Text>
                <Text style={s.menuItemSub}>FAQs, How It Works & Call Helpline</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── MORE / SETTINGS ────────── */}
        <View style={s.menuSection}>
          <Text style={s.menuSectionTitle}>App & Account</Text>

          <View style={s.menuGroup}>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => setSettingsOpen(true)}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <Settings size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Settings</Text>
                <Text style={s.menuItemSub}>Notifications & WhatsApp updates</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/guides')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <FileText size={16} color="#2D114D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Terms & Policies</Text>
                <Text style={s.menuItemSub}>Fuel, toll, damage & insurance policies</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {user && (
              <>
                <View style={s.menuDivider} />
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <View style={[s.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <LogOut size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuItemTitle, { color: '#DC2626' }]}>Log Out</Text>
                    <Text style={s.menuItemSub}>Sign out of your account</Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Version */}
        <Text style={s.versionText}>Safar Self Drive · Version 2.4.0 (Gujarat Edition)</Text>
      </ScrollView>

      {/* ────────── CUSTOM DEPOSIT MODAL ────────── */}
      <Modal
        visible={depositModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDepositModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <Text style={s.modalTitle}>Add Money to Safar Cash</Text>
            <Text style={s.modalSub}>Funds are instantly available for trip bookings</Text>

            <TextInput
              style={s.amtInput}
              placeholder="Enter amount (e.g. 1500)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={depositAmount}
              onChangeText={setDepositAmount}
            />

            <TouchableOpacity
              style={s.confirmDepositBtn}
              onPress={() => handleDeposit(Number(depositAmount))}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.confirmDepositText}>Deposit Funds</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelModalBtn}
              onPress={() => setDepositModalOpen(false)}
            >
              <Text style={s.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ────────── SETTINGS MODAL ────────── */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.modalTitle}>App Settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={s.settingRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.settingTitle}>Get Booking Info on Phone</Text>
                <Text style={s.settingSub}>
                  Receive quick communication on car location, trip extensions, and digital handover on WhatsApp.
                </Text>
              </View>
              <Switch
                value={whatsappUpdates}
                onValueChange={setWhatsappUpdates}
                trackColor={{ false: '#D1D5DB', true: '#2D114D' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F1235',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  /* User Card */
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 14,
  },
  userAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  userContactText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kycBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  editProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3EEFA',
  },
  editProfileText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* Guest Card */
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  guestSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Host Switch Callout Banner */
  hostSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E0A34',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    gap: 12,
  },
  hostBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 122, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hostBannerSub: {
    fontSize: 10,
    color: '#D8B4FE',
    marginTop: 2,
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF7A00',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  switchModeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Wallet Card */
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  walletSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  walletBalance: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  quickAmtBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickAmtText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },
  customAmtBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#EFE9F6',
  },
  customAmtText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },

  /* Menu Sections */
  menuSection: {
    marginTop: 18,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8A8F98',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1235',
  },
  menuItemSub: {
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 58,
  },

  /* Version */
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 22,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1235',
  },
  modalSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 16,
  },
  amtInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1235',
    marginBottom: 16,
  },
  confirmDepositBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmDepositText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelModalBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelModalText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1235',
  },
  settingSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
});
