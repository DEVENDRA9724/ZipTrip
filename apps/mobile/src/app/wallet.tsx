import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import {
  Wallet as WalletIcon,
  Plus,
  Gift,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  User,
  LogOut,
  FileText,
  HelpCircle,
  Car,
  X,
  Camera,
  Upload,
  Edit3,
  Building2,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const ADD_AMOUNTS = [500, 1000, 2000, 5000];

const KYC_DOC_SLOTS = [
  { key: 'dl_front', label: '1. Driving Licence (Front)', sub: 'Name, Photo & DL Number' },
  { key: 'dl_back', label: '2. Driving Licence (Back)', sub: 'Address & Validity Date' },
  { key: 'aadhaar_front', label: '3. Aadhaar Card / Passport', sub: 'Govt. Identity Proof' },
  { key: 'selfie', label: '4. Live Driver Selfie', sub: 'Face Match Verification' },
];

export default function AccountAndWalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  // Wallet balance & promo
  const [balance, setBalance] = useState(user ? 1250 : 0);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromos, setAppliedPromos] = useState<string[]>([]);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [selectedTopup, setSelectedTopup] = useState(1000);

  // Profile & KYC Camera State
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycPhotos, setKycPhotos] = useState<Record<string, string>>({});
  const [kycVerified, setKycVerified] = useState(true);

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(
    user ? `${user.firstName || 'Devendra'} ${user.lastName || ''}`.trim() : 'Safar Guest'
  );
  const [profilePhone, setProfilePhone] = useState(user?.phone || '+91 98765 43210');
  const [profileCity, setProfileCity] = useState('Ahmedabad, Gujarat');
  const [dlNumber, setDlNumber] = useState('GJ01-20210094821');

  // Corporate GST Modal
  const [gstModalOpen, setGstModalOpen] = useState(false);
  const [gstCompany, setGstCompany] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 50) : Math.max(insets.top, 20);

  const pickImage = async (
    onResult: (uri: string) => void,
    mode: 'camera' | 'gallery' = 'gallery'
  ) => {
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Permission', 'Please allow camera access in settings.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          onResult(res.assets[0].uri);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Gallery Permission', 'Please allow photo library access.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          onResult(res.assets[0].uri);
        }
      }
    } catch {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!res.canceled && res.assets?.[0]?.uri) {
        onResult(res.assets[0].uri);
      }
    }
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (appliedPromos.includes(code)) {
      Alert.alert('Already Redeemed', 'This promo code has already been credited.');
      return;
    }
    if (code === 'SAFAR500' || code === 'GUJARAT500' || code === 'WELCOME500') {
      setBalance((b) => b + 500);
      setAppliedPromos((p) => [...p, code]);
      setPromoCode('');
      Alert.alert('₹500 Credited', `Promo "${code}" applied to your Safar Cash wallet.`);
    } else {
      Alert.alert('Invalid Code', 'Try SAFAR500 for ₹500 instant travel credit.');
    }
  };

  const handleTopupConfirm = () => {
    setBalance((b) => b + selectedTopup);
    setTopupModalOpen(false);
    Alert.alert('Wallet Credited', `₹${selectedTopup.toLocaleString('en-IN')} added to your Safar Cash balance.`);
  };

  const handleSaveKycDocs = () => {
    const uploadedCount = Object.keys(kycPhotos).length;
    if (uploadedCount === 0) {
      Alert.alert('Upload Required', 'Please capture or select at least 1 document photo.');
      return;
    }
    setKycVerified(true);
    setKycModalOpen(false);
    Alert.alert(
      'Documents Verified',
      'Your Driving Licence and KYC documents have been saved. Zero Security Deposit is active.'
    );
  };

  const uploadedKycCount = Object.keys(kycPhotos).length;

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── CLEAN MINIMAL HEADER ────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Account</Text>
        {user ? (
          <TouchableOpacity
            style={s.editChip}
            onPress={() => setEditProfileOpen(true)}
            activeOpacity={0.75}
          >
            <Edit3 size={13} color="#0F172A" />
            <Text style={s.editChipText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.signInTopBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <Text style={s.signInTopBtnText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── 1. LIGHT PROFILE CARD ────────── */}
        <View style={s.profileCard}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={() =>
              Alert.alert('Profile Photo', 'Update your profile photo', [
                { text: 'Take Photo', onPress: () => pickImage((uri) => setAvatarUri(uri), 'camera') },
                { text: 'Choose from Gallery', onPress: () => pickImage((uri) => setAvatarUri(uri), 'gallery') },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            activeOpacity={0.85}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarLetter}>
                {user ? (user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase() : 'G'}
              </Text>
            )}
            <View style={s.cameraBadge}>
              <Camera size={10} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={s.profileNameText}>
              {user ? profileName : 'Guest Member'}
            </Text>
            <Text style={s.profileSubText}>
              {user ? user.email || profilePhone : 'Sign in to sync bookings & KYC'}
            </Text>
            <View style={s.verifiedBadge}>
              <CheckCircle2 size={12} color="#059669" />
              <Text style={s.verifiedBadgeText}>
                {kycVerified ? 'DigiLocker Verified • ₹0 Deposit' : 'Verification Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* ────────── 2. IDENTITY & DRIVING LICENCE KYC (MOVED FROM FOOTER) ────────── */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <View style={s.cardIconCircle}>
              <ShieldCheck size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Identity & Driving Licence KYC</Text>
              <Text style={s.cardSub}>
                DL: {dlNumber} • {uploadedKycCount > 0 ? `${uploadedKycCount}/4 Scanned` : 'Verified'}
              </Text>
            </View>
          </View>

          <View style={s.kycButtonsRow}>
            <TouchableOpacity
              style={s.kycSecondaryBtn}
              onPress={() => router.push('/verification')}
              activeOpacity={0.8}
            >
              <ShieldCheck size={15} color="#0F172A" />
              <Text style={s.kycSecondaryBtnText}>DigiLocker KYC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.kycPrimaryBtn}
              onPress={() => setKycModalOpen(true)}
              activeOpacity={0.85}
            >
              <Camera size={15} color="#FFFFFF" />
              <Text style={s.kycPrimaryBtnText}>Scan DL (Camera)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 3. CLEAN SAFAR CASH WALLET ────────── */}
        <View style={s.card}>
          <View style={s.walletTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.cardIconCircle, { backgroundColor: '#FFF7ED' }]}>
                <WalletIcon size={18} color="#FF6000" />
              </View>
              <View>
                <Text style={s.cardSub}>Safar Cash Balance</Text>
                <Text style={s.walletAmount}>₹{balance.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.addMoneyBtn}
              onPress={() => setTopupModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={s.addMoneyBtnText}>Add Money</Text>
            </TouchableOpacity>
          </View>

          <View style={s.promoInputRow}>
            <Gift size={15} color="#94A3B8" />
            <TextInput
              style={s.promoInput}
              placeholder="Promo code (e.g. SAFAR500)"
              placeholderTextColor="#94A3B8"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity onPress={handleApplyPromo}>
              <Text style={s.applyPromoText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 4. CLEAN ACCOUNT MENU ────────── */}
        <View style={s.menuGroup}>
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setEditProfileOpen(true)}
            activeOpacity={0.7}
          >
            <User size={18} color="#475569" />
            <Text style={s.menuItemText}>Personal Details & Driving Licence</Text>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.menuDivider} />

          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setGstModalOpen(true)}
            activeOpacity={0.7}
          >
            <Building2 size={18} color="#475569" />
            <Text style={s.menuItemText}>Corporate GSTIN & Tax Billing</Text>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.menuDivider} />

          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/trips')}
            activeOpacity={0.7}
          >
            <FileText size={18} color="#475569" />
            <Text style={s.menuItemText}>My Trips & 8-Side Camera Walkaround</Text>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.menuDivider} />

          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/host')}
            activeOpacity={0.7}
          >
            <Car size={18} color="#475569" />
            <Text style={s.menuItemText}>List Your Car & Host Dashboard</Text>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.menuDivider} />

          <TouchableOpacity
            style={s.menuItem}
            onPress={() => Linking.openURL('tel:+919900000001')}
            activeOpacity={0.7}
          >
            <HelpCircle size={18} color="#475569" />
            <Text style={s.menuItemText}>24×7 Roadside & Concierge Support</Text>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {user && (
          <TouchableOpacity
            style={s.logoutBtn}
            onPress={() => {
              logout();
              Alert.alert('Signed Out', 'You have been signed out.');
            }}
            activeOpacity={0.8}
          >
            <LogOut size={16} color="#DC2626" />
            <Text style={s.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ────────── MODAL 1: CAMERA / UPLOAD DRIVING LICENCE & KYC ────────── */}
      <Modal
        visible={kycModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setKycModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '88%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Driving Licence & ID Scanner</Text>
                <Text style={s.modalSubtitle}>Capture with Camera or upload from gallery</Text>
              </View>
              <TouchableOpacity onPress={() => setKycModalOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <View style={s.kycGrid}>
                {KYC_DOC_SLOTS.map((slot) => {
                  const uri = kycPhotos[slot.key];
                  return (
                    <View key={slot.key} style={[s.kycSlotCard, !!uri && s.kycSlotCardDone]}>
                      {uri ? (
                        <Image source={{ uri }} style={s.kycPreviewImg} resizeMode="cover" />
                      ) : (
                        <View style={{ marginBottom: 8 }}>
                          <Text style={s.kycSlotTitle}>{slot.label}</Text>
                          <Text style={s.kycSlotSub}>{slot.sub}</Text>
                        </View>
                      )}
                      {uri && <Text style={[s.kycSlotTitle, { marginTop: 6 }]}>{slot.label}</Text>}

                      <View style={s.kycSlotBtns}>
                        <TouchableOpacity
                          style={s.camSmallBtn}
                          onPress={() =>
                            pickImage((u) => setKycPhotos((p) => ({ ...p, [slot.key]: u })), 'camera')
                          }
                        >
                          <Camera size={12} color="#FFFFFF" />
                          <Text style={s.camSmallBtnText}>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.uploadSmallBtn}
                          onPress={() =>
                            pickImage((u) => setKycPhotos((p) => ({ ...p, [slot.key]: u })), 'gallery')
                          }
                        >
                          <Upload size={12} color="#0F172A" />
                          <Text style={s.uploadSmallBtnText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={s.primaryModalBtn} onPress={handleSaveKycDocs}>
                <Text style={s.primaryModalBtnText}>Save Verified Documents</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 2: EDIT PROFILE ────────── */}
      <Modal
        visible={editProfileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Profile & Licence</Text>
              <TouchableOpacity onPress={() => setEditProfileOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={s.inputLabel}>Full Name</Text>
                <TextInput
                  style={s.textInput}
                  value={profileName}
                  onChangeText={setProfileName}
                />
              </View>
              <View>
                <Text style={s.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={s.textInput}
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                />
              </View>
              <View>
                <Text style={s.inputLabel}>Driving Licence Number</Text>
                <TextInput
                  style={s.textInput}
                  value={dlNumber}
                  onChangeText={setDlNumber}
                  autoCapitalize="characters"
                />
              </View>
              <View>
                <Text style={s.inputLabel}>City</Text>
                <TextInput
                  style={s.textInput}
                  value={profileCity}
                  onChangeText={setProfileCity}
                />
              </View>

              <TouchableOpacity
                style={s.primaryModalBtn}
                onPress={() => {
                  setEditProfileOpen(false);
                  Alert.alert('Saved', 'Your profile details have been updated.');
                }}
              >
                <Text style={s.primaryModalBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 3: CORPORATE GSTIN ────────── */}
      <Modal
        visible={gstModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGstModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Corporate GSTIN Details</Text>
              <TouchableOpacity onPress={() => setGstModalOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={s.inputLabel}>Registered Company Name</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Safar Enterprise Pvt. Ltd."
                  placeholderTextColor="#94A3B8"
                  value={gstCompany}
                  onChangeText={setGstCompany}
                />
              </View>
              <View>
                <Text style={s.inputLabel}>15-Digit GSTIN</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. 24AABCS1234F1Z5"
                  placeholderTextColor="#94A3B8"
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                style={s.primaryModalBtn}
                onPress={() => {
                  setGstModalOpen(false);
                  Alert.alert('GSTIN Saved', 'Your B2B GST details will appear on all invoices.');
                }}
              >
                <Text style={s.primaryModalBtnText}>Save GST Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 4: WALLET TOP-UP ────────── */}
      <Modal
        visible={topupModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTopupModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Money to Safar Cash</Text>
              <TouchableOpacity onPress={() => setTopupModalOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={s.amountsRow}>
              {ADD_AMOUNTS.map((amt) => {
                const active = selectedTopup === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[s.amountChip, active && s.amountChipActive]}
                    onPress={() => setSelectedTopup(amt)}
                  >
                    <Text style={[s.amountChipText, active && s.amountChipTextActive]}>
                      ₹{amt.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={s.primaryModalBtn} onPress={handleTopupConfirm}>
              <Text style={s.primaryModalBtnText}>
                Add ₹{selectedTopup.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  signInTopBtn: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  signInTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },

  /* Light Profile Card */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileSubText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  verifiedBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },

  /* Generic White Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  kycButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kycSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  kycSecondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  kycPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  kycPrimaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Wallet Card */
  walletTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF6000',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addMoneyBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promoInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  applyPromoText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FF6000',
  },

  /* Grouped Menu */
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 46,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  logoutBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  primaryModalBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* KYC Grid inside Modal */
  kycGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kycSlotCard: {
    width: (W - 52) / 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  kycSlotCardDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  kycPreviewImg: {
    width: '100%',
    height: 75,
    borderRadius: 8,
  },
  kycSlotTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  kycSlotSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  kycSlotBtns: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  camSmallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 6,
  },
  camSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadSmallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
  },
  uploadSmallBtnText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Topup chips */
  amountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  amountChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  amountChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  amountChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  amountChipTextActive: {
    color: '#FFFFFF',
  },
});
