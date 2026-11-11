import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest, getVehicleImageSource } from '@/services/api';
import {
  Car,
  Calendar,
  Lock,
  Unlock,
  Navigation,
  Plus,
  ChevronRight,
  ChevronDown,
  Star,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  User,
  Settings,
  DollarSign,
  MapPin,
  Camera,
  X,
  Phone,
  AlertCircle,
  SlidersHorizontal,
  Clock,
  Send,
  Zap,
} from 'lucide-react-native';

const HOST_TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: TrendingUp },
  { key: 'bookings', label: 'Bookings', Icon: Calendar },
  { key: 'cars', label: 'My Cars', Icon: Car },
  { key: 'inbox', label: 'Inbox', Icon: MessageSquare },
  { key: 'profile', label: 'Profile', Icon: User },
];

export default function HostScreen() {
  const { user } = require('@/context/AuthContext').useAuth();

  const [activeHostTab, setActiveHostTab] = useState<'dashboard' | 'bookings' | 'cars' | 'inbox' | 'profile'>('dashboard');
  const [bookings, setBookings] = useState<any[]>([]);
  const [hostCars, setHostCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected car for controls & switcher
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [carSelectorOpen, setCarSelectorOpen] = useState(false);
  const [carControlModalOpen, setCarControlModalOpen] = useState(false);

  // Remote command states
  const [remoteActionBusy, setRemoteActionBusy] = useState<string | null>(null);

  // Inspection flow
  const [inspectionBooking, setInspectionBooking] = useState<any | null>(null);
  const [inspectionStage, setInspectionStage] = useState<'PICKUP' | 'RETURN' | null>(null);
  const [inspectionOdometer, setInspectionOdometer] = useState('');
  const [inspectionFuel, setInspectionFuel] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [inspectionMedia, setInspectionMedia] = useState<Record<string, string>>({});
  const [inspectionBusy, setInspectionBusy] = useState(false);

  // Guest Chat modal
  const [chatBooking, setChatBooking] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'guest', text: 'Hi, I have booked your car for the upcoming weekend. Where is the exact handover spot?', time: '10:15 AM' },
    { sender: 'host', text: 'Hello! Handover will be at SVP Airport Terminal 2 parking slot B4. I will share the digital pass upon arrival.', time: '10:20 AM' },
  ]);
  const [chatInput, setChatInput] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchHostData();
      }
    }, [user])
  );

  const fetchHostData = async () => {
    setLoading(true);
    try {
      const [bookingsData, carsData] = await Promise.all([
        apiRequest('/bookings/host-bookings').catch(() => []),
        apiRequest('/vehicles/mine').catch(() => []),
      ]);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      const cars = Array.isArray(carsData) ? carsData : [];
      setHostCars(cars);
      if (cars.length > 0 && !selectedCar) {
        setSelectedCar(cars[0]);
      }
    } catch (error) {
      console.error('Error fetching host data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock remote car action with realistic feedback
  const handleRemoteAction = (action: 'lock' | 'unlock' | 'track') => {
    if (!activeCar) return;
    setRemoteActionBusy(action);
    setTimeout(() => {
      setRemoteActionBusy(null);
      if (action === 'lock') {
        Alert.alert('Vehicle Locked', `${activeCar.make} ${activeCar.model} (${activeCar.registrationNumber || 'GJ01WW7428'}) has been locked securely.`);
      } else if (action === 'unlock') {
        Alert.alert('Vehicle Unlocked', `${activeCar.make} ${activeCar.model} doors unlocked for guest inspection.`);
      } else {
        Alert.alert('Live GPS Location', `${activeCar.make} ${activeCar.model} is currently parked at Ahmedabad SVP Airport (Slot B4). Engine Status: OFF.`);
      }
    }, 1200);
  };

  const beginInspection = (booking: any) => {
    setInspectionBooking(booking);
    setInspectionStage(booking.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN');
    setInspectionOdometer('');
    setInspectionFuel('');
    setInspectionNote('');
    setInspectionMedia({});
  };

  const captureInspectionPhoto = async (kind: string) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Camera permission is required for vehicle inspection.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: `${kind.toLowerCase()}-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' } as any);
      const uploaded = await apiRequest(`/media?kind=${encodeURIComponent(kind)}`, { method: 'POST', body: form });
      setInspectionMedia((current) => ({ ...current, [kind]: uploaded.id }));
    } catch (error: any) {
      Alert.alert('Photo upload failed', error.message || 'Could not upload inspection photo.');
    }
  };

  const submitInspection = async () => {
    if (!inspectionBooking || !inspectionStage) return;
    const odometer = Number(inspectionOdometer);
    if (!Number.isInteger(odometer) || odometer < 0) {
      Alert.alert('Odometer required', 'Enter the current odometer reading in kilometres.');
      return;
    }
    setInspectionBusy(true);
    try {
      await apiRequest(`/bookings/${inspectionBooking.id}/inspection`, {
        method: 'POST',
        body: JSON.stringify({
          stage: inspectionStage,
          odometer,
          fuelPercent: inspectionFuel ? Number(inspectionFuel) : 100,
          damageNote: inspectionNote.trim() || 'No visible damage',
          mediaIds: Object.values(inspectionMedia),
        }),
      });
      setInspectionBooking(null);
      Alert.alert(
        inspectionStage === 'PICKUP' ? 'Handover Completed' : 'Return Completed',
        'Digital inspection pass recorded successfully.'
      );
      await fetchHostData();
    } catch (error: any) {
      Alert.alert('Inspection failed', error.message || 'Could not save inspection evidence.');
    } finally {
      setInspectionBusy(false);
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: 'host', text: chatInput.trim(), time: 'Just now' },
    ]);
    setChatInput('');
  };

  // Fallback demo car if host has no registered car yet
  const defaultCar = useMemo(() => {
    return {
      id: 'demo-fronx',
      make: 'Maruti Suzuki',
      model: 'Fronx 2025',
      registrationNumber: 'GJ01WW7428',
      transmission: 'Manual',
      fuelType: 'Petrol',
      pricePerDay: 2499,
      rating: 4.88,
      tripsCount: 18,
      status: 'ACTIVE',
      category: 'SUV',
    };
  }, []);

  const activeCar = selectedCar || hostCars[0] || defaultCar;

  // Total calculated host earnings
  const totalHostEarnings = useMemo(() => {
    const fromBookings = bookings.reduce((sum, b) => sum + Number(b.totalAmount || b.baseFare || 0), 0);
    return fromBookings > 0 ? fromBookings : 38400;
  }, [bookings]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* ────────── HOST HEADER WITH SWITCHER & EARNINGS ────────── */}
      <View style={s.hostHeader}>
        <View style={s.hostHeaderLeft}>
          <Text style={s.greetingText}>Good Day,</Text>
          <Text style={s.hostNameText}>
            {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Devendra Sharma'}
          </Text>
        </View>

        {/* Total Earnings Pill Button */}
        <TouchableOpacity
          style={s.earningsPill}
          onPress={() => setActiveHostTab('dashboard')}
          activeOpacity={0.8}
        >
          <DollarSign size={14} color="#059669" />
          <Text style={s.earningsPillText}>₹{totalHostEarnings.toLocaleString('en-IN')}</Text>
        </TouchableOpacity>
      </View>

      {/* ────────── ACTIVE VEHICLE SELECTOR CARD (FROM SNIPPET) ────────── */}
      <TouchableOpacity
        style={s.vehicleSelectorCard}
        onPress={() => setCarSelectorOpen(true)}
        activeOpacity={0.8}
      >
        <Image
          source={getVehicleImageSource(activeCar)}
          style={s.selectorThumb}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={s.selectorCarName}>
            {activeCar.make} {activeCar.model}
          </Text>
          <View style={s.selectorMetaRow}>
            <Text style={s.selectorRegPlate}>{activeCar.registrationNumber || 'GJ01WW7428'}</Text>
            <View style={s.selectorRatingBox}>
              <Star size={11} color="#FFB800" fill="#FFB800" />
              <Text style={s.selectorRatingText}>{activeCar.rating || '4.9'}</Text>
            </View>
          </View>
        </View>
        <ChevronDown size={18} color="#6B7280" />
      </TouchableOpacity>

      {/* ────────── HOST TOP SUB TABS ────────── */}
      <View style={s.tabBarRow}>
        {HOST_TABS.map((tab) => {
          const active = tab.key === activeHostTab;
          const Icon = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, active && s.tabItemActive]}
              onPress={() => setActiveHostTab(tab.key as any)}
              activeOpacity={0.75}
            >
              <Icon size={16} color={active ? '#2D114D' : '#6B7280'} />
              <Text style={[s.tabItemText, active && s.tabItemTextActive]}>{tab.label}</Text>
              {active && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ────────── TAB CONTENT ────────── */}
      <ScrollView contentContainerStyle={s.contentScroll} showsVerticalScrollIndicator={false}>
        {/* ══════════════════════════════════════════════════════════
            TAB 1: HOST DASHBOARD
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'dashboard' && (
          <View>
            {/* Quick Remote Car Command Center (From Snippet) */}
            <View style={s.remoteControlCard}>
              <View style={s.remoteHeaderRow}>
                <View>
                  <Text style={s.remoteHeaderTitle}>Instant Vehicle Commands</Text>
                  <Text style={s.remoteHeaderSub}>Direct cellular sync with onboard telematics</Text>
                </View>
                <View style={s.liveSyncBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveSyncText}>Connected</Text>
                </View>
              </View>

              <View style={s.remoteActionsRow}>
                <TouchableOpacity
                  style={[s.remoteBtn, remoteActionBusy === 'lock' && s.remoteBtnBusy]}
                  onPress={() => handleRemoteAction('lock')}
                  activeOpacity={0.8}
                >
                  <Lock size={16} color="#2D114D" />
                  <Text style={s.remoteBtnText}>Lock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.remoteBtn, remoteActionBusy === 'unlock' && s.remoteBtnBusy]}
                  onPress={() => handleRemoteAction('unlock')}
                  activeOpacity={0.8}
                >
                  <Unlock size={16} color="#2D114D" />
                  <Text style={s.remoteBtnText}>Unlock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.remoteBtn, remoteActionBusy === 'track' && s.remoteBtnBusy]}
                  onPress={() => handleRemoteAction('track')}
                  activeOpacity={0.8}
                >
                  <Navigation size={16} color="#2D114D" />
                  <Text style={s.remoteBtnText}>Track GPS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Performance Stats Grid */}
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statValue}>₹{totalHostEarnings.toLocaleString('en-IN')}</Text>
                <Text style={s.statLabel}>Total Earned</Text>
                <Text style={s.statSub}>Next payout: Tuesday</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{bookings.length || 12}</Text>
                <Text style={s.statLabel}>Completed Trips</Text>
                <Text style={s.statSub}>100% on-time</Text>
              </View>
            </View>

            {/* Trust Banner (Matching Snippet) */}
            <View style={s.trustBannerCard}>
              <LinearGradient
                colors={['#FF7A00', '#FF5500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.trustBannerGradient}
              >
                <Text style={s.trustBannerTitle}>Build trust. Get more bookings.</Text>
                <Text style={s.trustBannerSub}>
                  Keep your car washed and fuel tank topped up to maintain your 5★ SuperHost badge.
                </Text>
                <TouchableOpacity
                  style={s.trustBannerBtn}
                  onPress={() => setActiveHostTab('cars')}
                >
                  <Text style={s.trustBannerBtnText}>Manage Vehicle Settings →</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Quick Vehicle Controls Section */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Vehicle Operations</Text>
            </View>

            <View style={s.operationsGroup}>
              <TouchableOpacity
                style={s.opItem}
                onPress={() => setCarControlModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={s.opIconBox}>
                  <SlidersHorizontal size={18} color="#2D114D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>Pricing & Availability</Text>
                  <Text style={s.opSub}>Set daily rates (₹{activeCar.pricePerDay || 2499}/day), pause/resume listing</Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={s.opDivider} />

              <TouchableOpacity
                style={s.opItem}
                onPress={() => setCarControlModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={s.opIconBox}>
                  <MapPin size={18} color="#2D114D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>Delivery Hotspots</Text>
                  <Text style={s.opSub}>Ahmedabad Airport, SG Highway, Surat Hub</Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={s.opDivider} />

              <TouchableOpacity
                style={s.opItem}
                onPress={() => {
                  Alert.alert('Accident & Protection', 'Every booking on Safar Self Drive is covered by ₹10,00,000 comprehensive third-party and accidental damage insurance. Host has zero out-of-pocket liability.');
                }}
                activeOpacity={0.7}
              >
                <View style={s.opIconBox}>
                  <ShieldCheck size={18} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>Safar Shield Protection</Text>
                  <Text style={s.opSub}>Zero liability on verified driver trips</Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: GUEST BOOKINGS
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'bookings' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Guest Reservations</Text>
              <Text style={s.sectionCount}>{bookings.length} Bookings</Text>
            </View>

            {bookings.length === 0 ? (
              <View style={s.emptyCard}>
                <Calendar size={36} color="#2D114D" />
                <Text style={s.emptyTitle}>No Pending Bookings</Text>
                <Text style={s.emptySub}>
                  When customers book your vehicle, their itinerary and digital handover details will appear here.
                </Text>
              </View>
            ) : (
              bookings.map((b) => (
                <View key={b.id} style={s.bookingCard}>
                  <View style={s.bookingHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.guestNameText}>{b.user?.name || 'Guest Driver'}</Text>
                      <Text style={s.bookingIdText}>Booking #{b.bookingId || b.id.slice(0, 8)}</Text>
                    </View>
                    <View style={s.bookingStatusPill}>
                      <Text style={s.bookingStatusText}>{b.status}</Text>
                    </View>
                  </View>

                  <View style={s.bookingDatesBox}>
                    <Clock size={13} color="#2D114D" />
                    <Text style={s.bookingDatesText}>
                      {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={s.bookingActionsRow}>
                    <TouchableOpacity
                      style={s.handoverBtn}
                      onPress={() => beginInspection(b)}
                    >
                      <Camera size={14} color="#FFF" />
                      <Text style={s.handoverBtnText}>Digital Handover Pass</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.chatGuestBtn}
                      onPress={() => {
                        setChatBooking(b);
                        setActiveHostTab('inbox');
                      }}
                    >
                      <MessageSquare size={14} color="#2D114D" />
                      <Text style={s.chatGuestBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: MY CARS (MATCHING SNIPPET)
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'cars' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Hosted Fleet</Text>
              <TouchableOpacity
                style={s.addCarPillBtn}
                onPress={() => {
                  Alert.alert(
                    'List a New Vehicle',
                    'To onboard a new car to Safar, you will need the RC copy, valid insurance, and photos of front, rear, sides and interior.\n\nOur onboarding team will inspect the car within 24 hours in Ahmedabad.'
                  );
                }}
              >
                <Plus size={14} color="#FFF" />
                <Text style={s.addCarPillText}>Add Car</Text>
              </TouchableOpacity>
            </View>

            {/* List of Cars */}
            {(hostCars.length > 0 ? hostCars : [defaultCar]).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.hostCarCard}
                onPress={() => {
                  setSelectedCar(c);
                  setCarControlModalOpen(true);
                }}
                activeOpacity={0.85}
              >
                <Image
                  source={getVehicleImageSource(c)}
                  style={s.hostCarThumb}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <View style={s.carStatusRow}>
                    <View style={s.activeBadge}>
                      <Text style={s.activeBadgeText}>ACTIVE ON SAFAR</Text>
                    </View>
                  </View>
                  <Text style={s.hostCarTitle}>
                    {c.make} {c.model}
                  </Text>
                  <Text style={s.hostCarReg}>
                    {c.registrationNumber || 'GJ01WW7428'} · ★ {c.rating || '4.9'}
                  </Text>
                  <Text style={s.hostCarPrice}>
                    ₹{Number(c.pricePerDay || 2499).toLocaleString('en-IN')}/day
                  </Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}

            {/* Onboarding Info Box */}
            <View style={s.onboardingCard}>
              <View style={s.onboardingHeader}>
                <Car size={18} color="#FF7A00" />
                <Text style={s.onboardingTitle}>Earn With Multiple Cars</Text>
              </View>
              <Text style={s.onboardingSub}>
                Have more than one car? Fleets with 2+ cars earn an average of ₹85,000/month with zero hassle.
              </Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 4: INBOX / GUEST CHAT (MATCHING SNIPPET)
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'inbox' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Chat With Guests</Text>
            </View>

            {/* Chat Messages */}
            <View style={s.chatContainer}>
              <View style={s.chatHeaderRow}>
                <View style={s.chatAvatar}>
                  <Text style={s.chatAvatarText}>K</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.chatGuestName}>Kartik Sangtani</Text>
                  <Text style={s.chatCarSub}>Booking: {activeCar.make} {activeCar.model}</Text>
                </View>
                <TouchableOpacity onPress={() => Linking.openURL('tel:+919909031177')}>
                  <Phone size={18} color="#2D114D" />
                </TouchableOpacity>
              </View>

              <View style={s.chatDivider} />

              <View style={s.chatMessagesList}>
                {chatMessages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      s.chatBubble,
                      msg.sender === 'host' ? s.chatBubbleHost : s.chatBubbleGuest,
                    ]}
                  >
                    <Text
                      style={[
                        s.chatBubbleText,
                        msg.sender === 'host' ? s.chatBubbleTextHost : s.chatBubbleTextGuest,
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text style={s.chatBubbleTime}>{msg.time}</Text>
                  </View>
                ))}
              </View>

              <View style={s.chatInputRow}>
                <TextInput
                  style={s.chatInput}
                  placeholder="Type a message to guest..."
                  placeholderTextColor="#9CA3AF"
                  value={chatInput}
                  onChangeText={setChatInput}
                />
                <TouchableOpacity style={s.chatSendBtn} onPress={sendChatMessage}>
                  <Send size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 5: HOST PROFILE & PAYOUTS
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'profile' && (
          <View>
            <View style={s.hostProfileCard}>
              <View style={s.profileAvatarBox}>
                <Text style={s.profileAvatarText}>D</Text>
              </View>
              <Text style={s.profileName}>
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Devendra Sharma'}
              </Text>
              <Text style={s.profileSub}>Safar Verified SuperHost since 2024</Text>

              <View style={s.profileStatsRow}>
                <View style={s.profileStatItem}>
                  <Text style={s.profileStatNum}>18</Text>
                  <Text style={s.profileStatLbl}>Trips Hosted</Text>
                </View>
                <View style={s.profileStatDivider} />
                <View style={s.profileStatItem}>
                  <Text style={s.profileStatNum}>4.9★</Text>
                  <Text style={s.profileStatLbl}>Host Rating</Text>
                </View>
                <View style={s.profileStatDivider} />
                <View style={s.profileStatItem}>
                  <Text style={s.profileStatNum}>100%</Text>
                  <Text style={s.profileStatLbl}>Acceptance</Text>
                </View>
              </View>
            </View>

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Banking & Legal Details</Text>
            </View>

            <View style={s.payoutSettingsGroup}>
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Bank Account</Text>
                <Text style={s.payoutVal}>HDFC Bank (•••• 8421)</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>PAN Number</Text>
                <Text style={s.payoutVal}>ABCDE1234F (Verified)</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>GST Registration</Text>
                <Text style={s.payoutVal}>24ABCDE1234F1Z5</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Payout Frequency</Text>
                <Text style={[s.payoutVal, { color: '#059669', fontWeight: '800' }]}>Weekly Direct Deposit</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ────────── VEHICLE CONTROLS MODAL (MATCHING SNIPPET) ────────── */}
      <Modal
        visible={carControlModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCarControlModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalCarTitle}>{activeCar.make} {activeCar.model}</Text>
                <Text style={s.modalCarReg}>{activeCar.registrationNumber || 'GJ01WW7428'}</Text>
              </View>
              <TouchableOpacity onPress={() => setCarControlModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={s.controlSectionHeader}>CONTROLS</Text>
              <TouchableOpacity
                style={s.controlRow}
                onPress={() => Alert.alert('Pricing', 'Daily rental rate is set to ₹2,499. Minimum trip duration: 1 Day.')}
              >
                <Text style={s.controlTitle}>Pricing Control</Text>
                <Text style={s.controlSub}>Set daily prices and unlimited km packages</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlRow}
                onPress={() => Alert.alert('Hotspots', 'Pickup locations: Ahmedabad Airport, SG Highway Hub, Surat Hub.')}
              >
                <Text style={s.controlTitle}>Delivery & Pickup</Text>
                <Text style={s.controlSub}>Set delivery radius, airport hotspots</Text>
              </TouchableOpacity>

              <Text style={[s.controlSectionHeader, { marginTop: 14 }]}>TELEMATICS & SAFETY</Text>
              <TouchableOpacity
                style={s.controlRow}
                onPress={() => Alert.alert('GPS Status', 'Onboard Safar IoT tracker active with 10-second ping.')}
              >
                <Text style={s.controlTitle}>GPS Device</Text>
                <Text style={s.controlSub}>Real-time location & geo-fencing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlRow}
                onPress={() => Alert.alert('FASTag', 'FASTag linked for automatic toll reconciliation.')}
              >
                <Text style={s.controlTitle}>FASTag Integration</Text>
                <Text style={s.controlSub}>Automatic highway toll settlement</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── CAR SWITCHER MODAL ────────── */}
      <Modal
        visible={carSelectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCarSelectorOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCarSelectorOpen(false)}
        >
          <View style={s.switcherSheet}>
            <Text style={s.switcherTitle}>Select Vehicle</Text>
            {(hostCars.length > 0 ? hostCars : [defaultCar]).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.switcherItem}
                onPress={() => {
                  setSelectedCar(c);
                  setCarSelectorOpen(false);
                }}
              >
                <Text style={s.switcherCarName}>{c.make} {c.model}</Text>
                <Text style={s.switcherReg}>{c.registrationNumber || 'GJ01WW7428'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────── DIGITAL INSPECTION MODAL ────────── */}
      <Modal
        visible={!!inspectionBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectionBooking(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalGrabber} />
            <Text style={s.modalTitle}>
              {inspectionStage === 'PICKUP' ? 'Vehicle Handover Inspection' : 'Vehicle Return Inspection'}
            </Text>
            <Text style={s.modalSub}>Record odometer & vehicle photo evidence before handover</Text>

            <TextInput
              style={s.inputField}
              placeholder="Odometer reading in KM (e.g. 34210)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={inspectionOdometer}
              onChangeText={setInspectionOdometer}
            />

            <TextInput
              style={s.inputField}
              placeholder="Fuel % (e.g. 100)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={inspectionFuel}
              onChangeText={setInspectionFuel}
            />

            <View style={s.inspectionPhotoRow}>
              <TouchableOpacity
                style={s.takePhotoBtn}
                onPress={() => captureInspectionPhoto('ODOMETER')}
              >
                <Camera size={18} color="#2D114D" />
                <Text style={s.takePhotoText}>
                  {inspectionMedia.ODOMETER ? 'Odometer ✓' : 'Snap Odometer'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.confirmInspectionBtn}
              onPress={submitInspection}
              disabled={inspectionBusy}
            >
              {inspectionBusy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.confirmInspectionText}>Submit Digital Pass</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelModalBtn}
              onPress={() => setInspectionBooking(null)}
            >
              <Text style={s.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
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
  hostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  hostHeaderLeft: {},
  greetingText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  hostNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1235',
  },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  earningsPillText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#065F46',
  },

  /* Active Vehicle Selector Card */
  vehicleSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 12,
  },
  selectorThumb: {
    width: 60,
    height: 40,
  },
  selectorCarName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1235',
  },
  selectorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  selectorRegPlate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  selectorRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  selectorRatingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },

  /* Sub Tabs */
  tabBarRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    position: 'relative',
  },
  tabItemActive: {},
  tabItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabItemTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2.5,
    backgroundColor: '#2D114D',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  contentScroll: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Remote Control Card */
  remoteControlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  remoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  remoteHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1235',
  },
  remoteHeaderSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  liveSyncText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  remoteActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  remoteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3EEFA',
    borderRadius: 12,
    paddingVertical: 10,
  },
  remoteBtnBusy: {
    opacity: 0.6,
  },
  remoteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* Stats Grid */
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1235',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 2,
  },
  statSub: {
    fontSize: 9,
    color: '#059669',
    marginTop: 4,
  },

  /* Trust Banner */
  trustBannerCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 14,
  },
  trustBannerGradient: {
    padding: 16,
  },
  trustBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  trustBannerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    lineHeight: 16,
  },
  trustBannerBtn: {
    marginTop: 10,
  },
  trustBannerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Operations Group */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
  },
  sectionCount: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  operationsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
  },
  opItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  opIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1235',
  },
  opSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  opDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 62,
  },

  /* Bookings Cards */
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  guestNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1235',
  },
  bookingIdText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  bookingStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bookingStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  bookingDatesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 10,
  },
  bookingDatesText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  bookingActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  handoverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D114D',
    borderRadius: 10,
    paddingVertical: 9,
  },
  handoverBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chatGuestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3EEFA',
  },
  chatGuestBtnText: {
    color: '#2D114D',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Cars Tab */
  addCarPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addCarPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  hostCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 12,
  },
  hostCarThumb: {
    width: 75,
    height: 50,
  },
  carStatusRow: {
    marginBottom: 2,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  activeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#059669',
  },
  hostCarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1235',
  },
  hostCarReg: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  hostCarPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 2,
  },
  onboardingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  onboardingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  onboardingSub: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },

  /* Inbox Tab */
  chatContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  chatGuestName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  chatCarSub: {
    fontSize: 10,
    color: '#6B7280',
  },
  chatDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  chatMessagesList: {
    gap: 10,
    marginBottom: 14,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 14,
  },
  chatBubbleGuest: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
  },
  chatBubbleHost: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D114D',
  },
  chatBubbleText: {
    fontSize: 12,
  },
  chatBubbleTextGuest: {
    color: '#1F1235',
  },
  chatBubbleTextHost: {
    color: '#FFFFFF',
  },
  chatBubbleTime: {
    fontSize: 9,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1F1235',
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Host Profile */
  hostProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  profileAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  profileSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  profileStatsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    width: '100%',
    justifyContent: 'space-around',
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F1235',
  },
  profileStatLbl: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  profileStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  payoutSettingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
  },
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  payoutKey: {
    fontSize: 12,
    color: '#6B7280',
  },
  payoutVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F1235',
  },
  payoutDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalCarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1235',
  },
  modalCarReg: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  controlSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 6,
  },
  controlRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1235',
  },
  controlSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },

  switcherSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 30,
    padding: 16,
    alignSelf: 'center',
    width: '85%',
  },
  switcherTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
    marginBottom: 10,
  },
  switcherItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switcherCarName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1235',
  },
  switcherReg: {
    fontSize: 11,
    color: '#6B7280',
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
    marginBottom: 14,
  },
  inputField: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 13,
    color: '#1F1235',
    marginBottom: 10,
  },
  inspectionPhotoRow: {
    marginBottom: 14,
  },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3EEFA',
    borderRadius: 12,
    paddingVertical: 12,
  },
  takePhotoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },
  confirmInspectionBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmInspectionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelModalBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelModalText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
});
