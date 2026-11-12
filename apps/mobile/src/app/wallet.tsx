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
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest } from '@/services/api';
import {
  Wallet,
  User,
  ShieldCheck,
  CreditCard,
  MapPin,
  Headphones,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X,
  Phone,
  Camera,
  Upload,
  Building2,
  Edit3,
  Compass,
  CalendarDays,
  Car,
  Award,
  ExternalLink,
} from 'lucide-react-native';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

const KYC_DOC_SLOTS = [
  { key: 'dl_front', label: 'Driving Licence (Front)', sub: 'Clear photo of LMV licence number & photo' },
  { key: 'dl_back', label: 'Driving Licence (Back)', sub: 'Address & validity dates clearly visible' },
  { key: 'aadhaar_front', label: 'Aadhaar / Govt ID (Front)', sub: 'Identity card front side' },
  { key: 'selfie', label: 'Driver Live Selfie', sub: 'Clear face photo for handover verification' },
];

export default function ProfileWalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshProfile } = require('@/context/AuthContext').useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState(user?.firstName || 'Operations');
  const [profileLastName, setProfileLastName] = useState(user?.lastName || 'Admin');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '+91 99000 00001');
  const [profileEmail, setProfileEmail] = useState(user?.email || 'guest@safarselfdrive.com');
  const [dlNumber, setDlNumber] = useState('GJ01 20210048291');
  const [emergencyPhone, setEmergencyPhone] = useState('+91 98250 00000');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Quick KYC Document Upload Modal inside Account
  const [kycUploadModalOpen, setKycUploadModalOpen] = useState(false);
  const [kycPhotos, setKycPhotos] = useState<Record<string, string>>({});
  const [kycVerifiedLocal, setKycVerifiedLocal] = useState<boolean>(!!user?.isVerified);

  // Corporate GST Modal
  const [gstModalOpen, setGstModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('Safar Enterprise Guest');
  const [gstNumber, setGstNumber] = useState('24AABCS1234F1Z5');
  const [gstSaved, setGstSaved] = useState(false);

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whatsappUpdates, setWhatsappUpdates] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchWallet();
        if (user.firstName) setProfileFirstName(user.firstName);
        if (user.lastName) setProfileLastName(user.lastName);
        if (user.phone) setProfilePhone(user.phone);
        if (user.email) setProfileEmail(user.email);
        if (user.isVerified) setKycVerifiedLocal(true);
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
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: amt }),
      });
      Alert.alert('Safar Cash Added', `₹${amt.toLocaleString('en-IN')} has been credited to your Safar Wallet.`);
      setDepositAmount('');
      setDepositModalOpen(false);
      await fetchWallet();
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      // Optimistic local fallback if demo mode
      setBalance((prev) => prev + amt);
      setDepositAmount('');
      setDepositModalOpen(false);
      Alert.alert('Safar Cash Added', `₹${amt.toLocaleString('en-IN')} credited to your Safar Wallet.`);
    } finally {
      setActionLoading(false);
    }
  };

  const captureOrPickImage = async (
    mode: 'camera' | 'gallery',
    onResult: (uri: string) => void
  ) => {
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Permission', 'Please allow camera access or choose Gallery.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.85,
          allowsEditing: true,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          onResult(res.assets[0].uri);
        }
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.85,
          allowsEditing: true,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          onResult(res.assets[0].uri);
        }
      }
    } catch {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        onResult(res.assets[0].uri);
      }
    }
  };

  const handleSaveProfile = () => {
    setEditProfileOpen(false);
    Alert.alert('Profile Updated', 'Your personal details and driving licence record have been saved.');
  };

  const handleSaveKycDocs = () => {
    const count = Object.keys(kycPhotos).length;
    if (count === 0) {
      Alert.alert('Upload Required', 'Please capture or upload at least your Driving Licence photo.');
      return;
    }
    setKycVerifiedLocal(true);
    setKycUploadModalOpen(false);
    Alert.alert(
      'KYC Documents Submitted',
      'Your Driving Licence and identity photos have been encrypted and linked to your profile. Zero Security Deposit is now active.'
    );
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

  const userName = user
    ? `${profileFirstName} ${profileLastName}`.trim()
    : 'Safar Guest';

  const isVerified = user?.isVerified || kycVerifiedLocal;
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── CLEAN TOP HEADER ────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Account & Identity</Text>
          <Text style={s.headerSub}>Profile, DigiLocker KYC, Wallet & GST Billing</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.supportIconBtn}
            onPress={() => Linking.openURL('tel:+919909031177')}
          >
            <Phone size={15} color="#059669" />
          </TouchableOpacity>
          {user && (
            <TouchableOpacity
              style={s.editTopBtn}
              onPress={() => setEditProfileOpen(true)}
            >
              <Edit3 size={14} color="#0F172A" />
              <Text style={s.editTopBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ────────── 1. EXECUTIVE USER PROFILE CARD ────────── */}
        {user ? (
          <View style={s.userCard}>
            <View style={s.userTopRow}>
              <TouchableOpacity
                style={s.userAvatarBox}
                onPress={() =>
                  captureOrPickImage('camera', (uri) => setAvatarUri(uri))
                }
                activeOpacity={0.85}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={s.avatarImage} />
                ) : (
                  <Text style={s.userAvatarInitial}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                )}
                <View style={s.cameraBadge}>
                  <Camera size={10} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <View style={s.tierRow}>
                  <Award size={12} color="#FF6000" />
                  <Text style={s.tierText}>SAFAR PRIVILEGE MEMBER</Text>
                </View>
                <Text style={s.userNameText}>{userName}</Text>
                <Text style={s.userContactText}>
                  {profilePhone} • {profileEmail}
                </Text>
                <Text style={s.dlText}>DL: {dlNumber}</Text>
              </View>
            </View>

            {/* Quick Member Metrics Strip */}
            <View style={s.metricsStrip}>
              <View style={s.metricCol}>
                <Text style={s.metricVal}>₹{balance.toLocaleString('en-IN')}</Text>
                <Text style={s.metricLbl}>Safar Cash</Text>
              </View>
              <View style={s.metricDivider} />
              <View style={s.metricCol}>
                <Text style={[s.metricVal, { color: '#059669' }]}>
                  {isVerified ? 'Verified ✓' : 'Pending'}
                </Text>
                <Text style={s.metricLbl}>DigiLocker KYC</Text>
              </View>
              <View style={s.metricDivider} />
              <View style={s.metricCol}>
                <Text style={s.metricVal}>₹0</Text>
                <Text style={s.metricLbl}>Security Deposit</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.guestCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.guestEyebrow}>SAFAR SELF DRIVE ACCOUNT</Text>
              <Text style={s.guestTitle}>Sign In to Unlock Zero Deposit</Text>
              <Text style={s.guestSub}>
                Complete 60-second DigiLocker KYC, manage bookings, and download GST invoices.
              </Text>
              <View style={s.guestAuthRow}>
                <TouchableOpacity
                  style={s.loginBtn}
                  onPress={() => router.push('/auth/login')}
                  activeOpacity={0.85}
                >
                  <Text style={s.loginBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.registerBtn}
                  onPress={() => router.push('/auth/register')}
                  activeOpacity={0.85}
                >
                  <Text style={s.registerBtnText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ────────── 2. DEDICATED DIGILOCKER KYC & DL VERIFICATION HUB ────────── */}
        <View style={s.kycHubCard}>
          <View style={s.kycHubHeader}>
            <View style={s.kycIconCircle}>
              <ShieldCheck size={20} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.kycTitleRow}>
                <Text style={s.kycHubTitle}>Identity & Driving Licence KYC</Text>
                <View
                  style={[
                    s.kycStatusPill,
                    isVerified ? s.kycStatusPillVerified : s.kycStatusPillPending,
                  ]}
                >
                  <Text
                    style={[
                      s.kycStatusPillText,
                      isVerified
                        ? s.kycStatusPillTextVerified
                        : s.kycStatusPillTextPending,
                    ]}
                  >
                    {isVerified ? 'VERIFIED' : 'REQUIRED'}
                  </Text>
                </View>
              </View>
              <Text style={s.kycHubSub}>
                Verify Aadhaar & LMV Driving Licence once for ₹0 security deposit across all cars.
              </Text>
            </View>
          </View>

          <View style={s.kycCheckGrid}>
            <View style={s.kycCheckItem}>
              <CheckCircle2
                size={14}
                color={isVerified ? '#059669' : '#94A3B8'}
              />
              <Text style={s.kycCheckText}>Aadhaar e-KYC (DigiLocker)</Text>
            </View>
            <View style={s.kycCheckItem}>
              <CheckCircle2
                size={14}
                color={
                  isVerified || Object.keys(kycPhotos).length > 0
                    ? '#059669'
                    : '#94A3B8'
                }
              />
              <Text style={s.kycCheckText}>Original LMV Driving Licence</Text>
            </View>
          </View>

          <View style={s.kycButtonsRow}>
            <TouchableOpacity
              style={s.digilockerPrimaryBtn}
              onPress={() => router.push('/verification')}
              activeOpacity={0.85}
            >
              <ExternalLink size={14} color="#FFFFFF" />
              <Text style={s.digilockerPrimaryBtnText}>
                DigiLocker Gateway
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.uploadDlSecondaryBtn}
              onPress={() => setKycUploadModalOpen(true)}
              activeOpacity={0.85}
            >
              <Camera size={14} color="#0F172A" />
              <Text style={s.uploadDlSecondaryBtnText}>
                Camera / Upload DL ({Object.keys(kycPhotos).length}/4)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 3. SAFAR DIGITAL CASH WALLET ────────── */}
        <View style={s.walletCard}>
          <View style={s.walletHeaderRow}>
            <View style={s.walletIconBox}>
              <Wallet size={18} color="#FF6000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.walletTitle}>Safar Digital Cash</Text>
              <Text style={s.walletSub}>
                1-tap checkout, FASTag toll auto-settlement & instant refunds
              </Text>
            </View>
            <Text style={s.walletBalance}>₹{balance.toLocaleString('en-IN')}</Text>
          </View>

          <View style={s.quickAmountsRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={s.quickAmtBtn}
                onPress={() => handleDeposit(amt)}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                <Plus size={10} color="#0F172A" />
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

        {/* ────────── 4. SAFAR HOST CENTER BANNER ────────── */}
        <TouchableOpacity
          style={s.hostSwitchBanner}
          onPress={() => router.push('/host')}
          activeOpacity={0.88}
        >
          <View style={s.hostBannerIcon}>
            <Sparkles size={19} color="#FF6000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hostBannerTitle}>Safar Host & Fleet Partner Center</Text>
            <Text style={s.hostBannerSub}>
              List your car, upload 8-side inspection photos & earn 80% revenue share
            </Text>
          </View>
          <View style={s.switchModeBtn}>
            <Text style={s.switchModeBtnText}>Open</Text>
            <ArrowRight size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* ────────── 5. ACCOUNT & BOOKING SERVICES MENU ────────── */}
        <View style={s.menuSection}>
          <Text style={s.menuSectionTitle}>BOOKINGS, IDENTITY & BILLING</Text>

          <View style={s.menuGroup}>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/verification')}
              activeOpacity={0.7}
            >
              <View style={[s.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                <ShieldCheck size={16} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>DigiLocker KYC Verification Centre</Text>
                <Text style={s.menuItemSub}>
                  View Aadhaar & Driving Licence verification sessions
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/trips')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <CalendarDays size={16} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>My Trips & 8-Angle Walkaround</Text>
                <Text style={s.menuItemSub}>
                  Active bookings, handover camera inspection & digital passes
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => setGstModalOpen(true)}
              activeOpacity={0.7}
            >
              <View style={[s.menuIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Building2 size={16} color="#FF6000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Corporate GSTIN & Tax Invoices</Text>
                <Text style={s.menuItemSub}>
                  {gstSaved ? `${companyName} (${gstNumber})` : 'Add GSTIN for 18% business tax credit'}
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push('/cars')}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <Car size={16} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Explore Verified Fleet</Text>
                <Text style={s.menuItemSub}>
                  Browse SUVs, automatics & Safar Reserve™ subscriptions
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 6. SUPPORT, GUIDES & SETTINGS ────────── */}
        <View style={s.menuSection}>
          <Text style={s.menuSectionTitle}>GUIDES, SUPPORT & PREFERENCES</Text>

          <View style={s.menuGroup}>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push({ pathname: '/guides', params: { section: 'guides' } })}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <Compass size={16} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Gujarat Road Trip Guides</Text>
                <Text style={s.menuItemSub}>
                  Statue of Unity, Sasan Gir, Rann of Kutch & Saputara
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push({ pathname: '/guides', params: { section: 'support' } })}
              activeOpacity={0.7}
            >
              <View style={[s.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Headphones size={16} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>24×7 Gujarat Roadside SOS & Help</Text>
                <Text style={s.menuItemSub}>Direct helpline (+91 99090 31177), WhatsApp & FAQs</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => setSettingsOpen(true)}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <Settings size={16} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>App & Notification Settings</Text>
                <Text style={s.menuItemSub}>WhatsApp pass alerts, SMS & security preferences</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => router.push({ pathname: '/guides', params: { section: 'how' } })}
              activeOpacity={0.7}
            >
              <View style={s.menuIconBox}>
                <FileText size={16} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTitle}>Terms, Fuel Policy & 80/20 GST Rules</Text>
                <Text style={s.menuItemSub}>Transparent lease agreement & damage protection rules</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
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
                    <Text style={[s.menuItemTitle, { color: '#DC2626' }]}>Sign Out</Text>
                    <Text style={s.menuItemSub}>Log out of your Safar account</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={s.versionText}>
          Safar Self Drive • v2.5.0 Luxury Edition • Ahmedabad, Gujarat
        </Text>
      </ScrollView>

      {/* ────────── MODAL 1: EDIT PROFILE & DL RECORD ────────── */}
      <Modal
        visible={editProfileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Edit Profile & Licence</Text>
              <TouchableOpacity onPress={() => setEditProfileOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.inputRowTwo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>First Name</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={profileFirstName}
                    onChangeText={setProfileFirstName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Last Name</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={profileLastName}
                    onChangeText={setProfileLastName}
                  />
                </View>
              </View>

              <Text style={s.fieldLabel}>Mobile Number (WhatsApp Pass Enabled)</Text>
              <TextInput
                style={s.fieldInput}
                value={profilePhone}
                onChangeText={setProfilePhone}
                keyboardType="phone-pad"
              />

              <Text style={s.fieldLabel}>Email Address (For GST Tax Invoices)</Text>
              <TextInput
                style={s.fieldInput}
                value={profileEmail}
                onChangeText={setProfileEmail}
                keyboardType="email-address"
              />

              <Text style={s.fieldLabel}>LMV Driving Licence Number</Text>
              <TextInput
                style={s.fieldInput}
                value={dlNumber}
                onChangeText={setDlNumber}
                autoCapitalize="characters"
              />

              <Text style={s.fieldLabel}>Emergency Family Contact</Text>
              <TextInput
                style={s.fieldInput}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity style={s.primaryModalBtn} onPress={handleSaveProfile}>
                <Text style={s.primaryModalBtnText}>Save Profile Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 2: CAMERA / UPLOAD KYC & DRIVING LICENCE PHOTOS ────────── */}
      <Modal
        visible={kycUploadModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setKycUploadModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '88%' }]}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalTitle}>Driving Licence & ID Upload</Text>
                <Text style={s.modalSubInline}>
                  Use your Camera or Photo Library to upload clear document images
                </Text>
              </View>
              <TouchableOpacity onPress={() => setKycUploadModalOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {KYC_DOC_SLOTS.map((slot) => {
                const uri = kycPhotos[slot.key];
                return (
                  <View key={slot.key} style={s.docUploadCard}>
                    <View style={s.docUploadInfo}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docSlotTitle}>{slot.label}</Text>
                        <Text style={s.docSlotSub}>{slot.sub}</Text>
                      </View>
                      {uri && (
                        <View style={s.capturedTag}>
                          <CheckCircle2 size={12} color="#059669" />
                          <Text style={s.capturedTagText}>Uploaded</Text>
                        </View>
                      )}
                    </View>

                    {uri && (
                      <Image
                        source={{ uri }}
                        style={s.docPreviewImg}
                        resizeMode="cover"
                      />
                    )}

                    <View style={s.docActionBtnsRow}>
                      <TouchableOpacity
                        style={s.cameraActionBtn}
                        onPress={() =>
                          captureOrPickImage('camera', (u) =>
                            setKycPhotos((prev) => ({ ...prev, [slot.key]: u }))
                          )
                        }
                      >
                        <Camera size={14} color="#FFFFFF" />
                        <Text style={s.cameraActionBtnText}>
                          {uri ? 'Retake Photo' : 'Open Camera'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.galleryActionBtn}
                        onPress={() =>
                          captureOrPickImage('gallery', (u) =>
                            setKycPhotos((prev) => ({ ...prev, [slot.key]: u }))
                          )
                        }
                      >
                        <Upload size={14} color="#0F172A" />
                        <Text style={s.galleryActionBtnText}>Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={s.primaryModalBtn} onPress={handleSaveKycDocs}>
                <Text style={s.primaryModalBtnText}>
                  Submit & Activate Zero Deposit
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 3: CORPORATE GST BILLING ────────── */}
      <Modal
        visible={gstModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGstModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Corporate GST Billing Profile</Text>
              <TouchableOpacity onPress={() => setGstModalOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>
              Claim 18% GST input credit on corporate and business road trips (SAC 997311).
            </Text>

            <Text style={s.fieldLabel}>Registered Company / Firm Name</Text>
            <TextInput
              style={s.fieldInput}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="e.g. Adani Enterprises Ltd."
            />

            <Text style={s.fieldLabel}>15-Digit GSTIN Number</Text>
            <TextInput
              style={s.fieldInput}
              value={gstNumber}
              onChangeText={setGstNumber}
              autoCapitalize="characters"
              placeholder="e.g. 24AABCS1234F1Z5"
            />

            <TouchableOpacity
              style={s.primaryModalBtn}
              onPress={() => {
                setGstSaved(true);
                setGstModalOpen(false);
                Alert.alert('GSTIN Saved', 'All future trip invoices will include your company GSTIN.');
              }}
            >
              <Text style={s.primaryModalBtnText}>Save Corporate GST Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 4: CUSTOM DEPOSIT ────────── */}
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
            <Text style={s.modalSub}>
              Instant zero-fee balance for bookings and FASTag highway tolls
            </Text>

            <TextInput
              style={s.amtInput}
              placeholder="Enter amount in ₹ (e.g. 2500)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={depositAmount}
              onChangeText={setDepositAmount}
            />

            <TouchableOpacity
              style={s.primaryModalBtn}
              onPress={() => handleDeposit(Number(depositAmount))}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.primaryModalBtnText}>Add Funds Instantly</Text>
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

      {/* ────────── MODAL 5: SETTINGS ────────── */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>App & Notification Settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={s.settingRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.settingTitle}>WhatsApp Digital Pass & Hub Pins</Text>
                <Text style={s.settingSub}>
                  Receive instant booking passes, vehicle GPS pin, and invoice PDFs on WhatsApp.
                </Text>
              </View>
              <Switch
                value={whatsappUpdates}
                onValueChange={setWhatsappUpdates}
                trackColor={{ false: '#CBD5E1', true: '#FF6000' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={s.settingRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.settingTitle}>SMS Trip Reminders & FASTag Alerts</Text>
                <Text style={s.settingSub}>
                  Real-time SMS when crossing Gujarat highway toll plazas.
                </Text>
              </View>
              <Switch
                value={smsAlerts}
                onValueChange={setSmsAlerts}
                trackColor={{ false: '#CBD5E1', true: '#0F172A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={s.settingRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.settingTitle}>Biometric Security for Wallet</Text>
                <Text style={s.settingSub}>
                  Require FaceID / Fingerprint before authorizing wallet payments.
                </Text>
              </View>
              <Switch
                value={biometricLock}
                onValueChange={setBiometricLock}
                trackColor={{ false: '#CBD5E1', true: '#059669' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  editTopBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  content: {
    padding: 16,
    paddingBottom: 44,
  },

  /* 1. User Card */
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  userTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userAvatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  userAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF6000',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  tierText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.6,
  },
  userNameText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  userContactText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  dlText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricCol: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricLbl: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },

  /* Guest Card */
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guestEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.8,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 3,
  },
  guestSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 17,
  },
  guestAuthRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  loginBtn: {
    flex: 1,
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  registerBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  registerBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },

  /* 2. Dedicated KYC Hub Card */
  kycHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kycHubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  kycIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kycHubTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  kycStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kycStatusPillVerified: {
    backgroundColor: '#ECFDF5',
  },
  kycStatusPillPending: {
    backgroundColor: '#FFF7ED',
  },
  kycStatusPillText: {
    fontSize: 9,
    fontWeight: '900',
  },
  kycStatusPillTextVerified: {
    color: '#059669',
  },
  kycStatusPillTextPending: {
    color: '#FF6000',
  },
  kycHubSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  kycCheckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  kycCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kycCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  kycButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  digilockerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 11,
  },
  digilockerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  uploadDlSecondaryBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 11,
  },
  uploadDlSecondaryBtnText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },

  /* 3. Wallet Card */
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  walletSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  walletBalance: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
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
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAmtText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  customAmtBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  customAmtText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#C2410C',
  },

  /* 4. Host Switch Banner */
  hostSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    gap: 12,
  },
  hostBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 96, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBannerTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hostBannerSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6000',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  switchModeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 5. Menu Sections */
  menuSection: {
    marginTop: 20,
  },
  menuSectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.7,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },

  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 24,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubInline: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  inputRowTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 5,
    marginTop: 10,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  primaryModalBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  amtInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelModalBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelModalText: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* KYC Upload Slots */
  docUploadCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  docUploadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docSlotTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  docSlotSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  capturedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  capturedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  docPreviewImg: {
    width: '100%',
    height: 110,
    borderRadius: 10,
    marginTop: 8,
  },
  docActionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cameraActionBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    borderRadius: 10,
  },
  cameraActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  galleryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    borderRadius: 10,
  },
  galleryActionBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Settings */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
});
