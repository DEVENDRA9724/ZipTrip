import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  apiRequest,
  getVehicleImageSource,
  getCarDistance,
  getVehicleTerms,
} from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  Share2,
  Heart,
  Edit2,
  Calendar,
  MapPin,
  Gauge,
  Fuel,
  Users,
  ShieldCheck,
  Star,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Camera,
  ArrowRight,
  X,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const DETAIL_TABS = ['Car Images', 'Km Package', 'About Host', 'Reviews', 'Features'];

const CAR_IMAGE_VIEWS = [
  { key: 'FRONT', label: 'Front View', sub: 'Exterior Front & Grille' },
  { key: 'REAR', label: 'Rear View', sub: 'Boot & Tailgate' },
  { key: 'LEFT_SIDE', label: 'Left Side Profile', sub: 'Left Doors & Wheels' },
  { key: 'RIGHT_SIDE', label: 'Right Side Profile', sub: 'Driver Side Profile' },
  { key: 'FRONT_LEFT', label: 'Front Quarter View', sub: 'Headlamp & Fender' },
  { key: 'FRONT_RIGHT', label: 'Side Quarter View', sub: 'Alloy Wheels & Tyres' },
  { key: 'ODOMETER', label: 'Dashboard & Cockpit', sub: 'Instrument Cluster & Screen' },
  { key: 'INTERIOR', label: 'Cabin & Seats', sub: 'Front & Rear Seating' },
];

const QUICK_QUESTIONS = [
  {
    q: "What's the fuel policy?",
    a: 'Same-to-same fuel policy. Pick up the car with whatever fuel level it has, and return it at the same level. Zero hidden fuel surcharges!',
  },
  {
    q: 'How much is security deposit?',
    a: 'Zero Security Deposit for DigiLocker verified Indian citizens! Complete your KYC from the Account page in 60 seconds.',
  },
  {
    q: 'Can I drive outside Gujarat?',
    a: 'Yes! All Safar Self Drive vehicles come with private white number plates and zero commercial border hassles.',
  },
  {
    q: 'Is doorstep delivery available?',
    a: 'Yes! We offer doorstep pickup & drop at Ahmedabad Airport (AMD), Surat Airport (STV), Vadodara, and your hotel or residence.',
  },
];

export default function VehicleDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const { id, startDate: paramStart, endDate: paramEnd, hub: paramHub } = useLocalSearchParams<{
    id: string;
    startDate?: string;
    endDate?: string;
    hub?: string;
  }>();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Car Images');
  const [isFavorite, setIsFavorite] = useState(false);

  // Dates
  const [startDate, setStartDate] = useState(paramStart || '2026-11-13');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(paramEnd || '2026-11-14');
  const [endTime, setEndTime] = useState('10:00 AM');

  // Modals
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  // KM Package selection
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');

  useEffect(() => {
    fetchVehicleDetails();
  }, [id]);

  const fetchVehicleDetails = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/vehicles/${id}`);
      setVehicle(data);
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
      Alert.alert('Error', 'Could not load vehicle details.');
    } finally {
      setLoading(false);
    }
  };

  const days = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return 1;
    }
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [startDate, endDate]);

  const handleShare = async () => {
    if (!vehicle) return;
    try {
      await Share.share({
        message: `Book ${vehicle.make} ${vehicle.model} on Safar Self Drive for ₹${vehicle.pricePerDay}/day! Private white plates, ₹0 deposit. https://safarselfdrive.com`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={s.centerText}>Loading vehicle specifications…</Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[s.center, { paddingTop: topPadding }]}>
        <Text style={{ color: '#64748B', fontSize: 16 }}>Vehicle details not found</Text>
        <TouchableOpacity style={s.backBtnSimple} onPress={() => router.back()}>
          <Text style={{ color: '#0F172A', fontWeight: '800' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const terms = getVehicleTerms(vehicle);
  const distance = getCarDistance(vehicle);
  const pricePerDay = Number(vehicle.pricePerDay || 2500);

  // Pricing calculation
  const baseRent = pricePerDay * days;
  const unlimitedAddon = kmPackage === 'unlimited' ? 450 * days : 0;
  const gstAmount = Math.round((baseRent + unlimitedAddon) * 0.18);
  const totalPayable = baseRent + unlimitedAddon + gstAmount;

  const mainImageSource = getVehicleImageSource(vehicle);

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── TOP APP BAR ────────── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.navIconBtn} activeOpacity={0.7}>
          <ArrowLeft size={19} color="#0F172A" />
        </TouchableOpacity>

        <View style={s.topBarTitleBox}>
          <Text style={s.topBarTitle} numberOfLines={1}>
            {vehicle.make} {vehicle.model}
          </Text>
          <TouchableOpacity
            style={s.datesEditPill}
            onPress={() => setStartPickerOpen(true)}
            activeOpacity={0.75}
          >
            <Calendar size={11} color="#FF6000" />
            <Text style={s.datesEditText}>
              {startDate} · {startTime} → {endDate}
            </Text>
            <Edit2 size={10} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={s.topBarRightActions}>
          <TouchableOpacity onPress={handleShare} style={s.navIconBtn} activeOpacity={0.7}>
            <Share2 size={17} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsFavorite((v) => !v)}
            style={s.navIconBtn}
            activeOpacity={0.7}
          >
            <Heart
              size={17}
              color={isFavorite ? '#FF6000' : '#0F172A'}
              fill={isFavorite ? '#FF6000' : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── SUB NAVIGATION TABS ────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabScroll}
        >
          {DETAIL_TABS.map((tab) => {
            const active = tab === activeTab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  setActiveTab(tab);
                  if (tab === 'Car Images') {
                    setGalleryModalOpen(true);
                  }
                }}
                style={[s.tabPill, active && s.tabPillActive]}
                activeOpacity={0.75}
              >
                <Text style={[s.tabPillText, active && s.tabPillTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────── CAR IMAGES GALLERY (VIEW-ONLY FOR CUSTOMERS) ────────── */}
        <TouchableOpacity
          style={s.galleryContainer}
          activeOpacity={0.9}
          onPress={() => setGalleryModalOpen(true)}
        >
          {/* Main Hero Photo (Left) */}
          <View style={s.mainPhotoWrap}>
            <Image
              source={mainImageSource}
              style={s.mainPhoto}
              resizeMode="contain"
            />
            <View style={s.coverBadge}>
              <Text style={s.coverBadgeText}>Car Images</Text>
            </View>
          </View>

          {/* Stacked Thumbnails (Right) */}
          <View style={s.thumbStack}>
            <View style={s.thumbBox}>
              <Image
                source={mainImageSource}
                style={s.thumbImg}
                resizeMode="cover"
              />
            </View>
            <View style={s.thumbBox}>
              <Image
                source={mainImageSource}
                style={s.thumbImg}
                resizeMode="cover"
              />
            </View>
            <View style={[s.thumbBox, s.morePhotosBox]}>
              <Image source={mainImageSource} style={[s.thumbImg, { opacity: 0.3 }]} resizeMode="cover" />
              <View style={s.morePhotosOverlay}>
                <Camera size={14} color="#FFF" />
                <Text style={s.morePhotosText}>View All</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ────────── VEHICLE HEADER INFO ────────── */}
        <View style={s.vehicleInfoCard}>
          <View style={s.vehicleTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.carMakeYear}>{vehicle.make} · {vehicle.year || '2025'} • PRIVATE PLATE</Text>
              <Text style={s.carFullTitle}>{vehicle.model}</Text>
            </View>
            <View style={s.ratingBadge}>
              <Star size={13} color="#FFB800" fill="#FFB800" />
              <Text style={s.ratingScore}>4.94</Text>
              <Text style={s.ratingReviews}>(52 trips)</Text>
            </View>
          </View>

          {/* Location & Hub Info */}
          <View style={s.hubRow}>
            <MapPin size={14} color="#FF6000" />
            <Text style={s.hubText}>
              Available at {paramHub || `${vehicle.city || 'Ahmedabad'} Hub`}
            </Text>
            <Text style={s.distanceBadge}>{distance} km away</Text>
          </View>

          {/* Specs Pills Grid */}
          <View style={s.specsGrid}>
            <View style={s.specCard}>
              <Gauge size={16} color="#0F172A" />
              <Text style={s.specVal} numberOfLines={1}>{vehicle.transmission || 'Automatic'}</Text>
              <Text style={s.specLbl}>Gearbox</Text>
            </View>
            <View style={s.specCard}>
              <Fuel size={16} color="#0F172A" />
              <Text style={s.specVal} numberOfLines={1}>{vehicle.fuelType || 'Diesel'}</Text>
              <Text style={s.specLbl}>Fuel Type</Text>
            </View>
            <View style={s.specCard}>
              <Users size={16} color="#0F172A" />
              <Text style={s.specVal} numberOfLines={1}>{vehicle.seats || 5} Seats</Text>
              <Text style={s.specLbl}>Capacity</Text>
            </View>
            <View style={s.specCard}>
              <ShieldCheck size={16} color="#059669" />
              <Text style={[s.specVal, { color: '#059669' }]} numberOfLines={1}>₹0 Dep</Text>
              <Text style={s.specLbl}>DigiLocker</Text>
            </View>
          </View>
        </View>

        {/* ────────── CHOOSE KM PACKAGE ────────── */}
        <View style={s.sectionBox}>
          <Text style={s.sectionHeaderTitle}>Choose Your Km Package</Text>
          <Text style={s.sectionHeaderSub}>Select the travel allowance that fits your itinerary</Text>

          <TouchableOpacity
            style={[s.packageCard, kmPackage === 'standard' && s.packageCardActive]}
            onPress={() => setKmPackage('standard')}
            activeOpacity={0.8}
          >
            <View style={[s.radioCircle, kmPackage === 'standard' && s.radioCircleActive]}>
              {kmPackage === 'standard' && <View style={s.radioDot} />}
            </View>
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={[s.packageTitle, kmPackage === 'standard' && s.packageTitleActive]}>
                {days * terms.kmPerDay} Kms Included ({terms.kmPerDay} km/day)
              </Text>
              <Text style={s.packageSub}>
                ₹{terms.excessKmRate}/km charged in case of excess distance
              </Text>
            </View>
            <Text style={s.packagePrice}>
              ₹{baseRent.toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.packageCard, kmPackage === 'unlimited' && s.packageCardActive]}
            onPress={() => setKmPackage('unlimited')}
            activeOpacity={0.8}
          >
            <View style={[s.radioCircle, kmPackage === 'unlimited' && s.radioCircleActive]}>
              {kmPackage === 'unlimited' && <View style={s.radioDot} />}
            </View>
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.packageTitle, kmPackage === 'unlimited' && s.packageTitleActive]}>
                  Unlimited Kms Package
                </Text>
                <View style={s.recommendedBadge}>
                  <Text style={s.recommendedBadgeText}>BEST VALUE</Text>
                </View>
              </View>
              <Text style={s.packageSub}>
                Drive anywhere across Gujarat without paying per-km excess charges
              </Text>
            </View>
            <Text style={s.packagePrice}>
              ₹{(baseRent + 450 * days).toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ────────── FREQUENTLY ASKED QUESTIONS ────────── */}
        <View style={s.sectionBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Text style={s.sectionHeaderTitle}>Rental Terms & Policies</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsScroll}
          >
            {QUICK_QUESTIONS.map((item) => (
              <TouchableOpacity
                key={item.q}
                style={[s.inquiryChip, selectedQuestion === item.q && s.inquiryChipActive]}
                onPress={() => setSelectedQuestion(selectedQuestion === item.q ? null : item.q)}
                activeOpacity={0.75}
              >
                <Text style={[s.inquiryChipText, selectedQuestion === item.q && s.inquiryChipTextActive]}>
                  {item.q}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedQuestion && (
            <View style={s.answerBox}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <CheckCircle2 size={16} color="#059669" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.answerQuestionText}>{selectedQuestion}</Text>
                  <Text style={s.answerBodyText}>
                    {QUICK_QUESTIONS.find((item) => item.q === selectedQuestion)?.a}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ────────── HOST RELIABILITY BADGE ────────── */}
        <View style={s.hostReliabilityCard}>
          <View style={s.hostReliabilityHeader}>
            <ShieldCheck size={20} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={s.hostReliabilityTitle}>Safar Verified Host</Text>
              <Text style={s.hostReliabilitySub}>
                100% on-time car handover · Inspected & sanitized before every trip
              </Text>
            </View>
          </View>
          <View style={s.hostOfferStrip}>
            <ShieldCheck size={13} color="#059669" />
            <Text style={s.hostOfferText}>
              DigiLocker KYC Active: ₹0 Security Deposit applied automatically
            </Text>
          </View>
        </View>

        {/* ────────── SAFAR STANDARD PROMISE ────────── */}
        <View style={s.promiseCard}>
          <Text style={s.promiseTitle}>Included with Every Safar Drive</Text>
          <View style={s.promiseList}>
            <View style={s.promiseItem}>
              <CheckCircle2 size={14} color="#059669" />
              <Text style={s.promiseText}>Private White Number Plates (Zero Taxi Permits)</Text>
            </View>
            <View style={s.promiseItem}>
              <CheckCircle2 size={14} color="#059669" />
              <Text style={s.promiseText}>Full Comprehensive Insurance Included</Text>
            </View>
            <View style={s.promiseItem}>
              <CheckCircle2 size={14} color="#059669" />
              <Text style={s.promiseText}>24×7 Roadside Assistance across Gujarat</Text>
            </View>
            <View style={s.promiseItem}>
              <CheckCircle2 size={14} color="#059669" />
              <Text style={s.promiseText}>Complete Dual GST Invoice (SAC 997311)</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ────────── STICKY BOTTOM BAR ────────── */}
      <View style={s.stickyFooter}>
        <TouchableOpacity
          style={s.fareBreakupToggle}
          onPress={() => setBreakupOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.fareBreakupToggleText}>View Transparent Fare Breakup</Text>
          {breakupOpen ? <ChevronDown size={14} color="#0F172A" /> : <ChevronUp size={14} color="#0F172A" />}
        </TouchableOpacity>

        <View style={s.footerMainRow}>
          <View>
            <Text style={s.footerLabel}>
              {days} {days === 1 ? 'Day' : 'Days'} · {kmPackage === 'unlimited' ? 'Unlimited KMs' : `${days * terms.kmPerDay} KMs`}
            </Text>
            <Text style={s.footerPriceTotal}>
              ₹{totalPayable.toLocaleString('en-IN')}
              <Text style={s.footerGstInclusive}> (GST incl.)</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={s.proceedBtn}
            onPress={() => {
              if (!user) {
                router.push('/auth/login');
                return;
              }
              router.push({
                pathname: '/booking/confirm',
                params: {
                  vehicleId: String(vehicle.id),
                  startDate,
                  endDate,
                  startTime,
                  endTime,
                  kmPackage,
                },
              });
            }}
            activeOpacity={0.88}
          >
            <Text style={s.proceedBtnText}>{user ? 'Proceed to Book' : 'Log In to Book'}</Text>
            <ArrowRight size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={s.refundableNote}>
          Zero Security Deposit on DigiLocker verified KYC.
        </Text>
      </View>

      {/* ────────── VIEW-ONLY CAR IMAGES GALLERY MODAL ────────── */}
      <Modal
        visible={galleryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGalleryModalOpen(false)}
      >
        <View style={s.breakupBackdrop}>
          <View style={[s.breakupSheet, { maxHeight: '88%' }]}>
            <View style={s.galleryHeaderRow}>
              <View>
                <Text style={s.breakupTitle}>Car Images</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {vehicle.make} {vehicle.model} • Verified Exterior & Cabin Gallery
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setGalleryModalOpen(false)}
                style={s.closeCircleBtn}
              >
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              <View style={s.angleGrid}>
                {CAR_IMAGE_VIEWS.map((view) => (
                  <View key={view.key} style={s.angleCard}>
                    <View style={s.anglePhotoWrap}>
                      <Image
                        source={mainImageSource}
                        style={s.anglePhotoImg}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={s.angleCardTitle}>{view.label}</Text>
                    <Text style={s.angleCardSub}>{view.sub}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── EXPANDABLE FARE BREAKUP MODAL ────────── */}
      <Modal
        visible={breakupOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBreakupOpen(false)}
      >
        <View style={s.breakupBackdrop}>
          <View style={s.breakupSheet}>
            <View style={s.breakupGrabber} />
            <Text style={s.breakupTitle}>Fare Calculation & Breakup</Text>

            <View style={s.breakupRow}>
              <Text style={s.breakupKey}>Base Rental ({days} days @ ₹{pricePerDay}/d)</Text>
              <Text style={s.breakupVal}>₹{baseRent.toLocaleString('en-IN')}</Text>
            </View>

            {unlimitedAddon > 0 && (
              <View style={s.breakupRow}>
                <Text style={s.breakupKey}>Unlimited Kms Package Add-on</Text>
                <Text style={s.breakupVal}>₹{unlimitedAddon.toLocaleString('en-IN')}</Text>
              </View>
            )}

            <View style={s.breakupRow}>
              <Text style={s.breakupKey}>Goods & Services Tax (GST 18%)</Text>
              <Text style={s.breakupVal}>₹{gstAmount.toLocaleString('en-IN')}</Text>
            </View>

            <View style={s.breakupRow}>
              <Text style={s.breakupKey}>Security Deposit (DigiLocker KYC)</Text>
              <Text style={[s.breakupVal, { color: '#059669', fontWeight: '800' }]}>₹0 Free</Text>
            </View>

            <View style={s.breakupDivider} />

            <View style={s.breakupRowTotal}>
              <Text style={s.breakupTotalKey}>Final Total</Text>
              <Text style={s.breakupTotalVal}>₹{totalPayable.toLocaleString('en-IN')}</Text>
            </View>

            <TouchableOpacity style={s.closeBreakupBtn} onPress={() => setBreakupOpen(false)}>
              <Text style={s.closeBreakupText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DateTimePickerModal
        visible={startPickerOpen}
        title="Change Pick-up Date & Time"
        selectedDate={startDate}
        selectedTime={startTime}
        onClose={() => setStartPickerOpen(false)}
        onSelect={(d, t) => {
          setStartDate(d);
          setStartTime(t);
          setStartPickerOpen(false);
        }}
      />
      <DateTimePickerModal
        visible={endPickerOpen}
        title="Change Return Date & Time"
        selectedDate={endDate}
        selectedTime={endTime}
        minDate={startDate}
        onClose={() => setEndPickerOpen(false)}
        onSelect={(d, t) => {
          setEndDate(d);
          setEndTime(t);
          setEndPickerOpen(false);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  centerText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '600',
  },
  backBtnSimple: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBox: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  datesEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  datesEditText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  topBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* Sub Navigation Tabs */
  tabScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tabPillActive: {
    backgroundColor: '#0F172A',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Photo Gallery Grid */
  galleryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    height: 210,
  },
  mainPhotoWrap: {
    flex: 1.6,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mainPhoto: {
    width: '92%',
    height: '92%',
  },
  coverBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  thumbStack: {
    flex: 1,
    gap: 8,
  },
  thumbBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  morePhotosBox: {
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  morePhotosOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  morePhotosText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Vehicle Info Card */
  vehicleInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carMakeYear: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  carFullTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  ratingReviews: {
    fontSize: 10,
    color: '#78350F',
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hubText: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  distanceBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6000',
  },

  /* Responsive Specs Grid */
  specsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  specCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    minWidth: 64,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    textAlign: 'center',
  },
  specLbl: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },

  /* Sections */
  sectionBox: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },

  /* Package Cards */
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  packageCardActive: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#FF6000',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6000',
  },
  packageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  packageTitleActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  packageSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: '#FF6000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recommendedBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* Chips */
  chipsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  inquiryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inquiryChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  inquiryChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  inquiryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  answerBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  answerQuestionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  answerBodyText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 3,
    lineHeight: 16,
  },

  /* Host Reliability Card */
  hostReliabilityCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hostReliabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostReliabilityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  hostReliabilitySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  hostOfferStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  hostOfferText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },

  /* Standard Promise Card */
  promiseCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promiseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  promiseList: {
    gap: 8,
  },
  promiseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promiseText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },

  /* Sticky Footer */
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  fareBreakupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 6,
  },
  fareBreakupToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  footerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  footerPriceTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  footerGstInclusive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  refundableNote: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  /* Modals */
  breakupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  breakupSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  breakupGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  breakupTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  breakupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  breakupKey: {
    fontSize: 12.5,
    color: '#475569',
  },
  breakupVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  breakupDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  breakupRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakupTotalKey: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakupTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  closeBreakupBtn: {
    marginTop: 18,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBreakupText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* View-only Car Images Grid */
  galleryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  angleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  angleCard: {
    width: (W - 52) / 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 9,
  },
  anglePhotoWrap: {
    height: 95,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  anglePhotoImg: {
    width: '100%',
    height: '100%',
  },
  angleCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  angleCardSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
