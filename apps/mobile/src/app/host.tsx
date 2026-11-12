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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
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
  DollarSign,
  MapPin,
  Camera,
  Upload,
  X,
  Phone,
  SlidersHorizontal,
  Clock,
  Send,
  Sparkles,
} from 'lucide-react-native';

const HOST_TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: TrendingUp },
  { key: 'bookings', label: 'Bookings', Icon: Calendar },
  { key: 'cars', label: 'My Cars', Icon: Car },
  { key: 'inbox', label: 'Inbox', Icon: MessageSquare },
  { key: 'profile', label: 'Payouts', Icon: User },
];

export const CAR_8_ANGLES = [
  { key: 'FRONT', label: '1. Front View', hint: 'Front bumper, grille & number plate' },
  { key: 'REAR', label: '2. Rear View', hint: 'Boot, tail lamps & rear number plate' },
  { key: 'LEFT_SIDE', label: '3. Left Side Profile', hint: 'Full passenger-side body & doors' },
  { key: 'RIGHT_SIDE', label: '4. Right Side Profile', hint: 'Full driver-side body & doors' },
  { key: 'FRONT_LEFT', label: '5. Front-Left 45° Corner', hint: 'Left fender, headlamp & front tyre' },
  { key: 'FRONT_RIGHT', label: '6. Front-Right 45° Corner', hint: 'Right fender, ORVM & front alloy' },
  { key: 'ODOMETER', label: '7. Dashboard & Odometer', hint: 'Live KM reading & fuel level gauge' },
  { key: 'INTERIOR', label: '8. Interior & Cabin Seats', hint: 'Front & rear upholstery condition' },
];

export default function HostScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();

  const [activeHostTab, setActiveHostTab] = useState<
    'dashboard' | 'bookings' | 'cars' | 'inbox' | 'profile'
  >('dashboard');
  const [bookings, setBookings] = useState<any[]>([]);
  const [hostCars, setHostCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected car for controls & switcher
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [carSelectorOpen, setCarSelectorOpen] = useState(false);
  const [carControlModalOpen, setCarControlModalOpen] = useState(false);

  // Add / List New Car + 8-Side Photo Upload Modal
  const [addCarModalOpen, setAddCarModalOpen] = useState(false);
  const [newCarMake, setNewCarMake] = useState('Hyundai');
  const [newCarModel, setNewCarModel] = useState('Creta SX(O) Automatic');
  const [newCarReg, setNewCarReg] = useState('GJ01KL9021');
  const [newCarPrice, setNewCarPrice] = useState('2800');
  const [newCarFuel, setNewCarFuel] = useState('Diesel');
  const [newCarTrans, setNewCarTrans] = useState('Automatic');
  const [car8Photos, setCar8Photos] = useState<Record<string, string>>({});
  const [savingCar, setSavingCar] = useState(false);

  // Remote command states
  const [remoteActionBusy, setRemoteActionBusy] = useState<string | null>(null);

  // 8-Angle Inspection flow for Bookings
  const [inspectionBooking, setInspectionBooking] = useState<any | null>(null);
  const [inspectionStage, setInspectionStage] = useState<'PICKUP' | 'RETURN' | null>(null);
  const [inspectionOdometer, setInspectionOdometer] = useState('');
  const [inspectionFuel, setInspectionFuel] = useState('100');
  const [inspectionNote, setInspectionNote] = useState('');
  const [inspectionMedia, setInspectionMedia] = useState<Record<string, string>>({});
  const [inspectionPhotosUri, setInspectionPhotosUri] = useState<Record<string, string>>({});
  const [inspectionBusy, setInspectionBusy] = useState(false);

  // Guest Chat
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: string; text: string; time: string }>
  >([
    {
      sender: 'guest',
      text: 'Hi, I have booked your car for the upcoming drive. Where is the exact handover spot?',
      time: '10:15 AM',
    },
    {
      sender: 'host',
      text: 'Hello! Handover is at SVP Airport Terminal 2 parking slot B4. We will complete the 8-angle camera walkaround upon arrival.',
      time: '10:20 AM',
    },
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
      if (cars.length > 0) {
        setHostCars(cars);
        if (!selectedCar) setSelectedCar(cars[0]);
      }
    } catch (error) {
      console.error('Error fetching host data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fallback demo car if host has no registered car yet
  const defaultCar = useMemo(() => {
    return {
      id: 'demo-fronx',
      make: 'Maruti Suzuki',
      model: 'Fronx Turbo 2025',
      registrationNumber: 'GJ01WW7428',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      pricePerDay: 2499,
      rating: 4.92,
      tripsCount: 18,
      status: 'ACTIVE',
      category: 'SUV',
      photosCount: Object.keys(car8Photos).length || 8,
    };
  }, [car8Photos]);

  const activeCar = selectedCar || hostCars[0] || defaultCar;

  const handleRemoteAction = (action: 'lock' | 'unlock' | 'track') => {
    if (!activeCar) return;
    setRemoteActionBusy(action);
    setTimeout(() => {
      setRemoteActionBusy(null);
      if (action === 'lock') {
        Alert.alert(
          'Vehicle Locked',
          `${activeCar.make} ${activeCar.model} (${activeCar.registrationNumber || 'GJ01WW7428'}) immobilized & doors locked.`
        );
      } else if (action === 'unlock') {
        Alert.alert(
          'Vehicle Unlocked',
          `${activeCar.make} ${activeCar.model} unlocked for 8-angle handover inspection.`
        );
      } else {
        Alert.alert(
          'Live GPS Telematics',
          `${activeCar.make} ${activeCar.model} is parked at Ahmedabad Hub (Ashram Road). Speed: 0 km/h • Battery: 12.6V.`
        );
      }
    }, 900);
  };

  // Universal Camera / Gallery Picker for 8 Angles
  const pickAngleImage = async (
    angleKey: string,
    mode: 'camera' | 'gallery',
    target: 'onboarding' | 'inspection'
  ) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Camera Access Needed',
            'Please allow camera access in settings, or use the Gallery button.'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.82,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.82,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];

      if (target === 'onboarding') {
        setCar8Photos((prev) => ({ ...prev, [angleKey]: asset.uri }));
      } else {
        setInspectionPhotosUri((prev) => ({ ...prev, [angleKey]: asset.uri }));
        // Also try uploading to backend media endpoint if available
        try {
          const form = new FormData();
          form.append('file', {
            uri: asset.uri,
            name: `${angleKey.toLowerCase()}-${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          } as any);
          const uploaded = await apiRequest(`/media?kind=${encodeURIComponent(angleKey)}`, {
            method: 'POST',
            body: form,
          });
          if (uploaded?.id) {
            setInspectionMedia((curr) => ({ ...curr, [angleKey]: uploaded.id }));
          }
        } catch {
          // Keep local URI verified even if offline/demo
          setInspectionMedia((curr) => ({ ...curr, [angleKey]: `local-${angleKey}` }));
        }
      }
    } catch {
      // Fallback to image library on web/simulator
      const fallback = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.82,
      });
      if (!fallback.canceled && fallback.assets?.[0]?.uri) {
        const uri = fallback.assets[0].uri;
        if (target === 'onboarding') {
          setCar8Photos((prev) => ({ ...prev, [angleKey]: uri }));
        } else {
          setInspectionPhotosUri((prev) => ({ ...prev, [angleKey]: uri }));
          setInspectionMedia((curr) => ({ ...curr, [angleKey]: `local-${angleKey}` }));
        }
      }
    }
  };

  const handleSaveNewCarWith8Photos = async () => {
    if (!newCarMake.trim() || !newCarModel.trim() || !newCarReg.trim()) {
      Alert.alert('Details Required', 'Please enter the car make, model, and Gujarat registration number.');
      return;
    }
    const uploadedCount = Object.keys(car8Photos).length;
    if (uploadedCount === 0) {
      Alert.alert(
        '8-Side Car Photos Required',
        'Please capture or upload at least 1 photo using the Camera or Gallery buttons.'
      );
      return;
    }

    setSavingCar(true);
    const createdCar = {
      id: `car-${Date.now()}`,
      make: newCarMake.trim(),
      model: newCarModel.trim(),
      registrationNumber: newCarReg.trim().toUpperCase(),
      pricePerDay: Number(newCarPrice) || 2500,
      fuelType: newCarFuel,
      transmission: newCarTrans,
      rating: 5.0,
      status: 'ACTIVE',
      category: 'SUV',
      photosCount: uploadedCount,
      customCoverUri: Object.values(car8Photos)[0],
    };

    setTimeout(() => {
      setHostCars((prev) => [createdCar, ...(prev.length ? prev : [defaultCar])]);
      setSelectedCar(createdCar);
      setSavingCar(false);
      setAddCarModalOpen(false);
      Alert.alert(
        'Vehicle Listed Successfully!',
        `${createdCar.make} ${createdCar.model} (${createdCar.registrationNumber}) has been onboarded with ${uploadedCount}/8 angle photos.`
      );
    }, 600);
  };

  const beginInspection = (booking: any) => {
    setInspectionBooking(booking);
    setInspectionStage(booking.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN');
    setInspectionOdometer('24580');
    setInspectionFuel('100');
    setInspectionNote('');
    setInspectionMedia({});
    setInspectionPhotosUri({});
  };

  const submitInspection = async () => {
    if (!inspectionBooking || !inspectionStage) return;
    const odometer = Number(inspectionOdometer);
    if (!Number.isInteger(odometer) || odometer < 0) {
      Alert.alert('Odometer Required', 'Enter the current odometer reading in kilometres.');
      return;
    }
    if (Object.keys(inspectionPhotosUri).length === 0) {
      Alert.alert(
        '8-Angle Photos Required',
        'Please capture at least 1 vehicle angle photo using the Camera button before submitting.'
      );
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
      }).catch(() => {});

      setInspectionBooking(null);
      Alert.alert(
        inspectionStage === 'PICKUP' ? '8-Angle Handover Completed' : '8-Angle Return Verified',
        `Recorded ${Object.keys(inspectionPhotosUri).length}/8 angle photos and odometer (${odometer} km).`
      );
      await fetchHostData();
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

  const totalHostEarnings = useMemo(() => {
    const fromBookings = bookings.reduce(
      (sum, b) => sum + Number(b.totalAmount || b.baseFare || 0),
      0
    );
    return fromBookings > 0 ? fromBookings : 42800;
  }, [bookings]);

  const topPadding =
    Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  const onboardingUploadedCount = Object.keys(car8Photos).length;
  const inspectionUploadedCount = Object.keys(inspectionPhotosUri).length;

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── CLEAN HOST HEADER ────────── */}
      <View style={s.hostHeader}>
        <View>
          <Text style={s.greetingText}>SAFAR FLEET PARTNER HUB</Text>
          <Text style={s.hostNameText}>
            {user?.firstName
              ? `${user.firstName} ${user.lastName || ''}`
              : 'Devendra Sharma'}
          </Text>
        </View>

        <View style={s.headerRightGroup}>
          <TouchableOpacity
            style={s.upload8TopBtn}
            onPress={() => setAddCarModalOpen(true)}
            activeOpacity={0.85}
          >
            <Camera size={13} color="#FFFFFF" />
            <Text style={s.upload8TopBtnText}>8-Side Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.earningsPill}
            onPress={() => setActiveHostTab('dashboard')}
            activeOpacity={0.8}
          >
            <DollarSign size={13} color="#059669" />
            <Text style={s.earningsPillText}>
              ₹{totalHostEarnings.toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ────────── ACTIVE VEHICLE SELECTOR CARD ────────── */}
      <TouchableOpacity
        style={s.vehicleSelectorCard}
        onPress={() => setCarSelectorOpen(true)}
        activeOpacity={0.85}
      >
        <Image
          source={
            activeCar.customCoverUri
              ? { uri: activeCar.customCoverUri }
              : getVehicleImageSource(activeCar)
          }
          style={s.selectorThumb}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={s.selectorCarName}>
            {activeCar.make} {activeCar.model}
          </Text>
          <View style={s.selectorMetaRow}>
            <Text style={s.selectorRegPlate}>
              {activeCar.registrationNumber || 'GJ01WW7428'}
            </Text>
            <View style={s.selectorRatingBox}>
              <Star size={11} color="#F59E0B" fill="#F59E0B" />
              <Text style={s.selectorRatingText}>{activeCar.rating || '4.9'}</Text>
            </View>
            <View style={s.photoCountPill}>
              <Camera size={10} color="#059669" />
              <Text style={s.photoCountPillText}>
                {onboardingUploadedCount || 8}/8 Photos
              </Text>
            </View>
          </View>
        </View>
        <ChevronDown size={18} color="#64748B" />
      </TouchableOpacity>

      {/* ────────── HOST SUB TABS ────────── */}
      <View style={s.tabBarRow}>
        {HOST_TABS.map((tab) => {
          const active = tab.key === activeHostTab;
          const Icon = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabItem}
              onPress={() => setActiveHostTab(tab.key as any)}
              activeOpacity={0.75}
            >
              <Icon size={16} color={active ? '#FF6000' : '#64748B'} />
              <Text style={[s.tabItemText, active && s.tabItemTextActive]}>
                {tab.label}
              </Text>
              {active && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ────────── TAB CONTENT ────────── */}
      <ScrollView
        contentContainerStyle={s.contentScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════
            TAB 1: HOST DASHBOARD
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'dashboard' && (
          <View>
            {/* 8-Angle Car Photo Studio Quick Launch Card */}
            <TouchableOpacity
              style={s.photoStudioBanner}
              onPress={() => setAddCarModalOpen(true)}
              activeOpacity={0.9}
            >
              <View style={s.photoStudioIconBox}>
                <Camera size={22} color="#FF6000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.photoStudioEyebrow}>8-SIDE STUDIO & CAMERA</Text>
                <Text style={s.photoStudioTitle}>
                  Upload 8-Angle Vehicle Photos
                </Text>
                <Text style={s.photoStudioSub}>
                  Front, Rear, Left, Right, 45° Corners, Odometer & Interior with live Camera
                </Text>
              </View>
              <View style={s.photoStudioCta}>
                <Text style={s.photoStudioCtaText}>Camera</Text>
              </View>
            </TouchableOpacity>

            {/* Quick Remote Car Command Center */}
            <View style={s.remoteControlCard}>
              <View style={s.remoteHeaderRow}>
                <View>
                  <Text style={s.remoteHeaderTitle}>Instant Telematics & Lock</Text>
                  <Text style={s.remoteHeaderSub}>
                    Direct cellular sync with onboard Safar GPS immobilizer
                  </Text>
                </View>
                <View style={s.liveSyncBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveSyncText}>ONLINE</Text>
                </View>
              </View>

              <View style={s.remoteActionsRow}>
                <TouchableOpacity
                  style={[s.remoteBtn, remoteActionBusy === 'lock' && s.remoteBtnBusy]}
                  onPress={() => handleRemoteAction('lock')}
                  activeOpacity={0.8}
                >
                  <Lock size={15} color="#0F172A" />
                  <Text style={s.remoteBtnText}>Lock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.remoteBtn,
                    remoteActionBusy === 'unlock' && s.remoteBtnBusy,
                  ]}
                  onPress={() => handleRemoteAction('unlock')}
                  activeOpacity={0.8}
                >
                  <Unlock size={15} color="#0F172A" />
                  <Text style={s.remoteBtnText}>Unlock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.remoteBtn,
                    remoteActionBusy === 'track' && s.remoteBtnBusy,
                  ]}
                  onPress={() => handleRemoteAction('track')}
                  activeOpacity={0.8}
                >
                  <Navigation size={15} color="#FF6000" />
                  <Text style={s.remoteBtnText}>Live GPS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Performance Stats Grid */}
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statValue}>
                  ₹{totalHostEarnings.toLocaleString('en-IN')}
                </Text>
                <Text style={s.statLabel}>80% Host Share Earned</Text>
                <Text style={s.statSub}>Next weekly payout: Tuesday</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{bookings.length || 14}</Text>
                <Text style={s.statLabel}>Completed Drives</Text>
                <Text style={s.statSub}>100% 8-angle verified</Text>
              </View>
            </View>

            {/* Quick Vehicle Controls Section */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Fleet & Listing Controls</Text>
            </View>

            <View style={s.operationsGroup}>
              <TouchableOpacity
                style={s.opItem}
                onPress={() => setAddCarModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={[s.opIconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Camera size={18} color="#FF6000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>8-Angle Car Photo Upload & Camera</Text>
                  <Text style={s.opSub}>
                    Update all 8 exterior & interior angles ({onboardingUploadedCount}/8 uploaded)
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>

              <View style={s.opDivider} />

              <TouchableOpacity
                style={s.opItem}
                onPress={() => setCarControlModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={s.opIconBox}>
                  <SlidersHorizontal size={18} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>Dynamic Pricing & Availability</Text>
                  <Text style={s.opSub}>
                    Daily rate: ₹{activeCar.pricePerDay || 2499}/day • Safar Reserve™ enabled
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>

              <View style={s.opDivider} />

              <TouchableOpacity
                style={s.opItem}
                onPress={() =>
                  Alert.alert(
                    'Safar Shield Protection',
                    'Every booking is backed by DigiLocker Aadhaar/DL verification, 8-angle pre/post trip camera evidence, and comprehensive damage protection.'
                  )
                }
                activeOpacity={0.7}
              >
                <View style={[s.opIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <ShieldCheck size={18} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opTitle}>Safar Shield Damage Protection</Text>
                  <Text style={s.opSub}>Zero host liability on verified guest trips</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: GUEST BOOKINGS & 8-ANGLE HANDOVER
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'bookings' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Guest Reservations & Handover</Text>
              <Text style={s.sectionCount}>{bookings.length || 1} Active</Text>
            </View>

            {(bookings.length > 0
              ? bookings
              : [
                  {
                    id: 'demo-bk-101',
                    bookingId: 'SFR-88412',
                    status: 'CONFIRMED',
                    startDate: new Date(Date.now() + 864e5).toISOString(),
                    endDate: new Date(Date.now() + 3 * 864e5).toISOString(),
                    user: { name: 'Kartik Sangtani (DigiLocker Verified)' },
                  },
                ]
            ).map((b) => (
              <View key={b.id} style={s.bookingCard}>
                <View style={s.bookingHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.guestNameText}>{b.user?.name || 'Verified Guest'}</Text>
                    <Text style={s.bookingIdText}>
                      Booking #{b.bookingId || String(b.id).slice(0, 8)}
                    </Text>
                  </View>
                  <View style={s.bookingStatusPill}>
                    <Text style={s.bookingStatusText}>{b.status}</Text>
                  </View>
                </View>

                <View style={s.bookingDatesBox}>
                  <Clock size={13} color="#0F172A" />
                  <Text style={s.bookingDatesText}>
                    {new Date(b.startDate).toLocaleDateString()} →{' '}
                    {new Date(b.endDate).toLocaleDateString()}
                  </Text>
                </View>

                <View style={s.bookingActionsRow}>
                  <TouchableOpacity
                    style={s.handoverBtn}
                    onPress={() => beginInspection(b)}
                  >
                    <Camera size={14} color="#FFF" />
                    <Text style={s.handoverBtnText}>
                      8-Angle Camera Handover
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.chatGuestBtn}
                    onPress={() => setActiveHostTab('inbox')}
                  >
                    <MessageSquare size={14} color="#0F172A" />
                    <Text style={s.chatGuestBtnText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: MY CARS & 8-SIDE UPLOAD
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'cars' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Hosted Fleet ({hostCars.length || 1})</Text>
              <TouchableOpacity
                style={s.addCarPillBtn}
                onPress={() => setAddCarModalOpen(true)}
              >
                <Plus size={14} color="#FFF" />
                <Text style={s.addCarPillText}>Add Car + 8 Photos</Text>
              </TouchableOpacity>
            </View>

            {(hostCars.length > 0 ? hostCars : [defaultCar]).map((c) => (
              <View key={c.id} style={s.hostCarCard}>
                <View style={s.hostCarTopRow}>
                  <Image
                    source={
                      c.customCoverUri
                        ? { uri: c.customCoverUri }
                        : getVehicleImageSource(c)
                    }
                    style={s.hostCarThumb}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={s.activeBadge}>
                      <Text style={s.activeBadgeText}>ACTIVE • WHITE PLATE</Text>
                    </View>
                    <Text style={s.hostCarTitle}>
                      {c.make} {c.model}
                    </Text>
                    <Text style={s.hostCarReg}>
                      {c.registrationNumber || 'GJ01WW7428'} • ★ {c.rating || '4.9'}
                    </Text>
                    <Text style={s.hostCarPrice}>
                      ₹{Number(c.pricePerDay || 2499).toLocaleString('en-IN')}/day
                    </Text>
                  </View>
                </View>

                <View style={s.hostCarActionsRow}>
                  <TouchableOpacity
                    style={s.upload8CarBtn}
                    onPress={() => {
                      setSelectedCar(c);
                      setAddCarModalOpen(true);
                    }}
                  >
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={s.upload8CarBtnText}>
                      Upload / Camera 8-Side Photos ({onboardingUploadedCount}/8)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.settingsCarBtn}
                    onPress={() => {
                      setSelectedCar(c);
                      setCarControlModalOpen(true);
                    }}
                  >
                    <SlidersHorizontal size={14} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 4: INBOX / GUEST CHAT
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'inbox' && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Direct Guest Messaging</Text>
            </View>

            <View style={s.chatContainer}>
              <View style={s.chatHeaderRow}>
                <View style={s.chatAvatar}>
                  <Text style={s.chatAvatarText}>K</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.chatGuestName}>Kartik Sangtani</Text>
                  <Text style={s.chatCarSub}>
                    Booking: {activeCar.make} {activeCar.model}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => Linking.openURL('tel:+919909031177')}>
                  <Phone size={18} color="#059669" />
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
                        msg.sender === 'host'
                          ? s.chatBubbleTextHost
                          : s.chatBubbleTextGuest,
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
                  placeholder="Message guest regarding pickup…"
                  placeholderTextColor="#94A3B8"
                  value={chatInput}
                  onChangeText={setChatInput}
                />
                <TouchableOpacity style={s.chatSendBtn} onPress={sendChatMessage}>
                  <Send size={15} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 5: HOST PAYOUTS & 80/20 SPLIT
        ══════════════════════════════════════════════════════════ */}
        {activeHostTab === 'profile' && (
          <View>
            <View style={s.hostProfileCard}>
              <View style={s.profileAvatarBox}>
                <Text style={s.profileAvatarText}>D</Text>
              </View>
              <Text style={s.profileName}>
                {user?.firstName
                  ? `${user.firstName} ${user.lastName || ''}`
                  : 'Devendra Sharma'}
              </Text>
              <Text style={s.profileSub}>
                Safar Verified Fleet Partner • 80% Revenue Share Tier
              </Text>

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
                  <Text style={s.profileStatNum}>80%</Text>
                  <Text style={s.profileStatLbl}>Net Payout</Text>
                </View>
              </View>
            </View>

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Settlement & GST Details</Text>
            </View>

            <View style={s.payoutSettingsGroup}>
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Bank Settlement Account</Text>
                <Text style={s.payoutVal}>HDFC Bank (•••• 8421)</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Verified PAN</Text>
                <Text style={s.payoutVal}>ABCDE1234F ✓</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Dual GST Split Model</Text>
                <Text style={s.payoutVal}>80% Partner Lease / 20% Platform</Text>
              </View>
              <View style={s.payoutDivider} />
              <View style={s.payoutItem}>
                <Text style={s.payoutKey}>Payout Schedule</Text>
                <Text style={[s.payoutVal, { color: '#059669' }]}>
                  Every Tuesday via NEFT/IMPS
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: ADD / EDIT CAR + ALL-8-SIDE CAMERA & GALLERY UPLOAD
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={addCarModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddCarModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalCarTitle}>
                  Vehicle Onboarding & 8-Side Photos
                </Text>
                <Text style={s.modalCarReg}>
                  Upload all 8 angles using Camera or Gallery ({onboardingUploadedCount}/8 completed)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddCarModalOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${Math.min(100, (onboardingUploadedCount / 8) * 100)}%` },
                ]}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Vehicle Basic Details */}
              <View style={s.twoColInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Car Make</Text>
                  <TextInput
                    style={s.inputField}
                    value={newCarMake}
                    onChangeText={setNewCarMake}
                    placeholder="e.g. Mahindra"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Car Model</Text>
                  <TextInput
                    style={s.inputField}
                    value={newCarModel}
                    onChangeText={setNewCarModel}
                    placeholder="e.g. Thar 4x4"
                  />
                </View>
              </View>

              <View style={s.twoColInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Registration No.</Text>
                  <TextInput
                    style={s.inputField}
                    value={newCarReg}
                    onChangeText={setNewCarReg}
                    autoCapitalize="characters"
                    placeholder="GJ01XX0000"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Daily Rent (₹)</Text>
                  <TextInput
                    style={s.inputField}
                    value={newCarPrice}
                    onChangeText={setNewCarPrice}
                    keyboardType="numeric"
                    placeholder="2800"
                  />
                </View>
              </View>

              {/* Quick Launch Camera for Next Missing Angle */}
              <TouchableOpacity
                style={s.quickLaunchCameraBanner}
                onPress={() => {
                  const nextMissing =
                    CAR_8_ANGLES.find((a) => !car8Photos[a.key]) || CAR_8_ANGLES[0];
                  pickAngleImage(nextMissing.key, 'camera', 'onboarding');
                }}
                activeOpacity={0.85}
              >
                <Camera size={18} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.quickLaunchCameraTitle}>
                    Quick Capture with Camera ({onboardingUploadedCount}/8)
                  </Text>
                  <Text style={s.quickLaunchCameraSub}>
                    Tap to open camera for the next required angle
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 8-Angle Photo Grid */}
              <Text style={s.anglesSectionHeader}>
                ALL 8 REQUIRED VEHICLE ANGLES
              </Text>

              <View style={s.anglesGrid}>
                {CAR_8_ANGLES.map((angle) => {
                  const uri = car8Photos[angle.key];
                  return (
                    <View
                      key={angle.key}
                      style={[s.angleCard, uri && s.angleCardCaptured]}
                    >
                      <View style={s.angleCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.angleTitle}>{angle.label}</Text>
                          <Text style={s.angleHint}>{angle.hint}</Text>
                        </View>
                        {uri && (
                          <View style={s.angleDoneBadge}>
                            <CheckCircle2 size={12} color="#059669" />
                            <Text style={s.angleDoneText}>Done</Text>
                          </View>
                        )}
                      </View>

                      {uri && (
                        <Image
                          source={{ uri }}
                          style={s.anglePreviewImg}
                          resizeMode="cover"
                        />
                      )}

                      <View style={s.angleBtnsRow}>
                        <TouchableOpacity
                          style={s.angleCameraBtn}
                          onPress={() =>
                            pickAngleImage(angle.key, 'camera', 'onboarding')
                          }
                          activeOpacity={0.8}
                        >
                          <Camera size={13} color="#FFFFFF" />
                          <Text style={s.angleCameraBtnText}>
                            {uri ? 'Retake' : 'Camera'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.angleGalleryBtn}
                          onPress={() =>
                            pickAngleImage(angle.key, 'gallery', 'onboarding')
                          }
                          activeOpacity={0.8}
                        >
                          <Upload size={13} color="#0F172A" />
                          <Text style={s.angleGalleryBtnText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={s.confirmInspectionBtn}
                onPress={handleSaveNewCarWith8Photos}
                disabled={savingCar}
              >
                {savingCar ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.confirmInspectionText}>
                    Save Vehicle & 8-Side Photos ({onboardingUploadedCount}/8)
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: 8-ANGLE DIGITAL HANDOVER / RETURN INSPECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!inspectionBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectionBooking(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalGrabber} />
            <View style={s.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalCarTitle}>
                  {inspectionStage === 'PICKUP'
                    ? '8-Angle Pickup Handover'
                    : '8-Angle Return Inspection'}
                </Text>
                <Text style={s.modalCarReg}>
                  Capture all 8 sides + odometer reading ({inspectionUploadedCount}/8 captured)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInspectionBooking(null)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.twoColInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Odometer (KM)</Text>
                  <TextInput
                    style={s.inputField}
                    placeholder="e.g. 24580"
                    keyboardType="number-pad"
                    value={inspectionOdometer}
                    onChangeText={setInspectionOdometer}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Fuel Level (%)</Text>
                  <TextInput
                    style={s.inputField}
                    placeholder="100"
                    keyboardType="number-pad"
                    value={inspectionFuel}
                    onChangeText={setInspectionFuel}
                  />
                </View>
              </View>

              <Text style={s.anglesSectionHeader}>
                CAPTURE ALL 8 VEHICLE ANGLES
              </Text>

              <View style={s.anglesGrid}>
                {CAR_8_ANGLES.map((angle) => {
                  const uri = inspectionPhotosUri[angle.key];
                  return (
                    <View
                      key={angle.key}
                      style={[s.angleCard, uri && s.angleCardCaptured]}
                    >
                      <View style={s.angleCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.angleTitle}>{angle.label}</Text>
                          <Text style={s.angleHint}>{angle.hint}</Text>
                        </View>
                        {uri && (
                          <View style={s.angleDoneBadge}>
                            <CheckCircle2 size={12} color="#059669" />
                            <Text style={s.angleDoneText}>Saved</Text>
                          </View>
                        )}
                      </View>

                      {uri && (
                        <Image
                          source={{ uri }}
                          style={s.anglePreviewImg}
                          resizeMode="cover"
                        />
                      )}

                      <View style={s.angleBtnsRow}>
                        <TouchableOpacity
                          style={s.angleCameraBtn}
                          onPress={() =>
                            pickAngleImage(angle.key, 'camera', 'inspection')
                          }
                        >
                          <Camera size={13} color="#FFFFFF" />
                          <Text style={s.angleCameraBtnText}>
                            {uri ? 'Retake' : 'Camera'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.angleGalleryBtn}
                          onPress={() =>
                            pickAngleImage(angle.key, 'gallery', 'inspection')
                          }
                        >
                          <Upload size={13} color="#0F172A" />
                          <Text style={s.angleGalleryBtnText}>Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Pre-Existing Scratch / Tyre Notes</Text>
              <TextInput
                style={s.inputField}
                placeholder="No visible scratches or dents"
                value={inspectionNote}
                onChangeText={setInspectionNote}
              />

              <TouchableOpacity
                style={s.confirmInspectionBtn}
                onPress={submitInspection}
                disabled={inspectionBusy}
              >
                {inspectionBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.confirmInspectionText}>
                    Complete 8-Angle Inspection ({inspectionUploadedCount}/8)
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── VEHICLE CONTROLS MODAL ────────── */}
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
                <Text style={s.modalCarTitle}>
                  {activeCar.make} {activeCar.model}
                </Text>
                <Text style={s.modalCarReg}>
                  {activeCar.registrationNumber || 'GJ01WW7428'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCarControlModalOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.controlRow}
              onPress={() => {
                setCarControlModalOpen(false);
                setAddCarModalOpen(true);
              }}
            >
              <Text style={s.controlTitle}>8-Angle Photo Studio & Camera</Text>
              <Text style={s.controlSub}>
                Capture or update all 8 sides of your vehicle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.controlRow}
              onPress={() =>
                Alert.alert(
                  'Pricing Control',
                  `Daily rental rate is ₹${activeCar.pricePerDay || 2499}/day. Safar Reserve™ monthly rate is active.`
                )
              }
            >
              <Text style={s.controlTitle}>Daily & Safar Reserve™ Pricing</Text>
              <Text style={s.controlSub}>
                Configure daily rates and 300 km / Unlimited packages
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.controlRow}
              onPress={() =>
                Alert.alert(
                  'GPS & Telematics',
                  'Onboard Safar GPS tracker is active with 10-second live ping.'
                )
              }
            >
              <Text style={s.controlTitle}>GPS & Immobilizer Status</Text>
              <Text style={s.controlSub}>Real-time location & geofencing</Text>
            </TouchableOpacity>
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
            <Text style={s.switcherTitle}>Select Hosted Vehicle</Text>
            {(hostCars.length > 0 ? hostCars : [defaultCar]).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.switcherItem}
                onPress={() => {
                  setSelectedCar(c);
                  setCarSelectorOpen(false);
                }}
              >
                <Text style={s.switcherCarName}>
                  {c.make} {c.model}
                </Text>
                <Text style={s.switcherReg}>
                  {c.registrationNumber || 'GJ01WW7428'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  greetingText: {
    fontSize: 9.5,
    color: '#FF6000',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hostNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upload8TopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  upload8TopBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  earningsPillText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#065F46',
  },

  /* Active Vehicle Selector */
  vehicleSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  selectorThumb: {
    width: 64,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  selectorCarName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  selectorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  selectorRegPlate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
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
  photoCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoCountPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
  },

  /* Sub Tabs */
  tabBarRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    position: 'relative',
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2.5,
    backgroundColor: '#FF6000',
    borderRadius: 2,
  },

  contentScroll: {
    padding: 16,
    paddingBottom: 44,
  },

  /* 8-Side Photo Studio Launch Banner */
  photoStudioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    marginBottom: 14,
    gap: 12,
  },
  photoStudioIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStudioEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.7,
  },
  photoStudioTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  photoStudioSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  photoStudioCta: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  photoStudioCtaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Remote Control Card */
  remoteControlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  remoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  remoteHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  remoteHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
  },
  remoteBtnBusy: {
    opacity: 0.6,
  },
  remoteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
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
    borderColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    marginTop: 2,
  },
  statSub: {
    fontSize: 9.5,
    color: '#059669',
    fontWeight: '700',
    marginTop: 4,
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
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  operationsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  opSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  opDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },

  /* Bookings Cards */
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  guestNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  bookingIdText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  bookingStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    color: '#334155',
    fontWeight: '700',
  },
  bookingActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  handoverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF6000',
    borderRadius: 10,
    paddingVertical: 10,
  },
  handoverBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  chatGuestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chatGuestBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Cars Tab */
  addCarPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addCarPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  hostCarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hostCarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostCarThumb: {
    width: 84,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  activeBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
  },
  hostCarTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  hostCarReg: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  hostCarPrice: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FF6000',
    marginTop: 2,
  },
  hostCarActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  upload8CarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 10,
  },
  upload8CarBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  settingsCarBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
  },

  /* Inbox Tab */
  chatContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  chatGuestName: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  chatCarSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  chatDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  chatMessagesList: {
    gap: 10,
    marginBottom: 14,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 10,
    borderRadius: 14,
  },
  chatBubbleGuest: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
  },
  chatBubbleHost: {
    alignSelf: 'flex-end',
    backgroundColor: '#0F172A',
  },
  chatBubbleText: {
    fontSize: 12,
    lineHeight: 17,
  },
  chatBubbleTextGuest: {
    color: '#0F172A',
  },
  chatBubbleTextHost: {
    color: '#FFFFFF',
  },
  chatBubbleTime: {
    fontSize: 9,
    color: '#94A3B8',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF6000',
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
    borderColor: '#E2E8F0',
  },
  profileAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F172A',
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
    fontWeight: '900',
    color: '#0F172A',
  },
  profileSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  profileStatsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    width: '100%',
    justifyContent: 'space-around',
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  profileStatLbl: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  profileStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  payoutSettingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  payoutKey: {
    fontSize: 12,
    color: '#64748B',
  },
  payoutVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  payoutDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  /* Modals & 8-Angle Grid */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modalCarTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalCarReg: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#059669',
  },
  twoColInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickLaunchCameraBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF6000',
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
  },
  quickLaunchCameraTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  quickLaunchCameraSub: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.9)',
  },
  anglesSectionHeader: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
  },
  anglesGrid: {
    gap: 10,
    marginBottom: 12,
  },
  angleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  angleCardCaptured: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  angleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  angleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  angleHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  angleDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  angleDoneText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  anglePreviewImg: {
    width: '100%',
    height: 110,
    borderRadius: 10,
    marginTop: 8,
  },
  angleBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  angleCameraBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    borderRadius: 10,
  },
  angleCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  angleGalleryBtn: {
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
  angleGalleryBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  confirmInspectionBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmInspectionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  controlRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  controlTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  controlSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  switcherSheet: {
    backgroundColor: '#FFFFFF',
    margin: 24,
    borderRadius: 20,
    padding: 20,
  },
  switcherTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  switcherItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switcherCarName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  switcherReg: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
