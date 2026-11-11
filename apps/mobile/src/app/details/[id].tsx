import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  apiRequest,
  getVehicleImageSource,
  getCarDistance,
  getVehicleTerms,
} from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  ArrowLeft,
  Share2,
  Heart,
  Edit2,
  Calendar,
  Clock,
  MapPin,
  Gauge,
  Fuel,
  Users,
  ShieldCheck,
  Star,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Camera,
  HelpCircle,
  Phone,
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const DETAIL_TABS = ['Photos', 'Km Package', 'About Host', 'Reviews', 'Features'];

const QUICK_QUESTIONS = [
  { q: "What's the fuel policy?", a: "Same-to-same fuel policy. Pick up the car with whatever fuel level it has, and return it at the same level. No hidden fuel surcharges!" },
  { q: "How much is security deposit?", a: "Zero Security Deposit for DigiLocker verified Indian citizens! If unverified, a standard ₹2,000 refundable deposit applies." },
  { q: "Can I drive outside Gujarat?", a: "Yes! All Safar Self Drive vehicles come with all-India permit capability and private white number plates with zero interstate taxi hassles." },
  { q: "Is doorstep delivery available?", a: "Yes! We offer doorstep pickup & drop at Ahmedabad Airport (AMD), Surat Airport (STV), Vadodara, and your hotel/residence across Gujarat." },
];

export default function VehicleDetailsScreen() {
  const { id, startDate: paramStart, endDate: paramEnd, hub: paramHub } = useLocalSearchParams<{
    id: string;
    startDate?: string;
    endDate?: string;
    hub?: string;
  }>();

  const { user } = require('@/context/AuthContext').useAuth();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Photos');
  const [isFavorite, setIsFavorite] = useState(false);

  // Dates
  const [startDate, setStartDate] = useState(paramStart || '2026-11-12');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(paramEnd || '2026-11-13');
  const [endTime, setEndTime] = useState('10:00 AM');

  // Modals
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  // KM Package selection ('standard' | 'unlimited')
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
        message: `Book ${vehicle.make} ${vehicle.model} on Safar Self Drive for ₹${vehicle.pricePerDay}/day! Private plates, zero deposit. https://safarselfdrive.com`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2D114D" />
        <Text style={s.centerText}>Loading vehicle specifications…</Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={s.center}>
        <Text style={{ color: '#64748B', fontSize: 16 }}>Vehicle details not found</Text>
        <TouchableOpacity style={s.backBtnSimple} onPress={() => router.back()}>
          <Text style={{ color: '#2D114D', fontWeight: '700' }}>Go Back</Text>
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
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* ────────── TOP APP BAR ────────── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.navIconBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#1F1235" />
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
            <Edit2 size={10} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={s.topBarRightActions}>
          <TouchableOpacity onPress={handleShare} style={s.navIconBtn} activeOpacity={0.7}>
            <Share2 size={18} color="#1F1235" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsFavorite((v) => !v)}
            style={s.navIconBtn}
            activeOpacity={0.7}
          >
            <Heart
              size={18}
              color={isFavorite ? '#DC2626' : '#1F1235'}
              fill={isFavorite ? '#DC2626' : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
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
                onPress={() => setActiveTab(tab)}
                style={[s.tabPill, active && s.tabPillActive]}
                activeOpacity={0.75}
              >
                <Text style={[s.tabPillText, active && s.tabPillTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────── MULTI-PHOTO GALLERY GRID ────────── */}
        <View style={s.galleryContainer}>
          {/* Main Hero Photo (Left) */}
          <View style={s.mainPhotoWrap}>
            <Image source={mainImageSource} style={s.mainPhoto} resizeMode="contain" />
            <View style={s.coverBadge}>
              <Text style={s.coverBadgeText}>Cover Photo</Text>
            </View>
          </View>

          {/* Stacked Thumbnails (Right) */}
          <View style={s.thumbStack}>
            <View style={s.thumbBox}>
              <Image source={mainImageSource} style={s.thumbImg} resizeMode="cover" />
            </View>
            <View style={s.thumbBox}>
              <Image source={mainImageSource} style={s.thumbImg} resizeMode="cover" />
            </View>
            <View style={[s.thumbBox, s.morePhotosBox]}>
              <Image source={mainImageSource} style={[s.thumbImg, { opacity: 0.35 }]} resizeMode="cover" />
              <View style={s.morePhotosOverlay}>
                <Camera size={14} color="#FFF" />
                <Text style={s.morePhotosText}>+4 more</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ────────── VEHICLE HEADER INFO ────────── */}
        <View style={s.vehicleInfoCard}>
          <View style={s.vehicleTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.carMakeYear}>{vehicle.make} · {vehicle.year || '2025'}</Text>
              <Text style={s.carFullTitle}>{vehicle.model}</Text>
            </View>
            <View style={s.ratingBadge}>
              <Star size={13} color="#FFB800" fill="#FFB800" />
              <Text style={s.ratingScore}>4.94</Text>
              <Text style={s.ratingReviews}>(52 reviews)</Text>
            </View>
          </View>

          {/* Location & Hub Info */}
          <View style={s.hubRow}>
            <MapPin size={14} color="#FF6000" />
            <Text style={s.hubText}>
              Available at {paramHub || `${vehicle.city || 'Ahmedabad'} Airport & SG Highway Hub`}
            </Text>
            <Text style={s.distanceBadge}>{distance} km away</Text>
          </View>

          {/* Specs Pills Grid */}
          <View style={s.specsGrid}>
            <View style={s.specCard}>
              <Gauge size={16} color="#2D114D" />
              <Text style={s.specVal}>{vehicle.transmission || 'Automatic'}</Text>
              <Text style={s.specLbl}>Gearbox</Text>
            </View>
            <View style={s.specCard}>
              <Fuel size={16} color="#2D114D" />
              <Text style={s.specVal}>{vehicle.fuelType || 'Diesel'}</Text>
              <Text style={s.specLbl}>Fuel Type</Text>
            </View>
            <View style={s.specCard}>
              <Users size={16} color="#2D114D" />
              <Text style={s.specVal}>{vehicle.seats || 5} Seats</Text>
              <Text style={s.specLbl}>Capacity</Text>
            </View>
            <View style={s.specCard}>
              <ShieldCheck size={16} color="#059669" />
              <Text style={[s.specVal, { color: '#059669' }]}>Zero Dep</Text>
              <Text style={s.specLbl}>KYC Passed</Text>
            </View>
          </View>
        </View>

        {/* ────────── CHOOSE KM PACKAGE (FROM SNIPPET) ────────── */}
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

        {/* ────────── ASK ANYTHING ABOUT THIS CAR (FROM SNIPPET) ────────── */}
        <View style={s.sectionBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={16} color="#FF6000" />
            <Text style={s.sectionHeaderTitle}>Ask Anything About This Car</Text>
          </View>

          {/* Inquiry Chips */}
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

          {/* Answer Preview Box */}
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
              <Text style={s.hostReliabilityTitle}>Highly Reliable Safar Verified Host</Text>
              <Text style={s.hostReliabilitySub}>
                100% on-time car handover · Zero cancellations in last 20 bookings
              </Text>
            </View>
          </View>
          <View style={s.hostOfferStrip}>
            <Zap size={13} color="#FFD600" />
            <Text style={s.hostOfferText}>
              DigiLocker KYC Active: ₹0 Security Deposit applied automatically
            </Text>
          </View>
        </View>

        {/* ────────── SAFAR STANDARD PROMISE ────────── */}
        <View style={s.promiseCard}>
          <Text style={s.promiseTitle}>Included with Every Booking</Text>
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
              <Text style={s.promiseText}>24x7 Roadside Assistance across Gujarat</Text>
            </View>
            <View style={s.promiseItem}>
              <CheckCircle2 size={14} color="#059669" />
              <Text style={s.promiseText}>Complete Dual GST Invoice (80/20 Invoicing)</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ────────── STICKY BOTTOM BAR (MATCHING SNIPPET) ────────── */}
      <View style={s.stickyFooter}>
        <TouchableOpacity
          style={s.fareBreakupToggle}
          onPress={() => setBreakupOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.fareBreakupToggleText}>View Fare Breakup</Text>
          {breakupOpen ? <ChevronDown size={14} color="#2D114D" /> : <ChevronUp size={14} color="#2D114D" />}
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
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF7A00', '#FF4E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.proceedGradient}
            >
              <Text style={s.proceedBtnText}>{user ? 'Proceed to Book' : 'Log In to Book'}</Text>
              <ArrowRight size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={s.refundableNote}>
          Zero Security Deposit on DigiLocker verified KYC.
        </Text>
      </View>

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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FB',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6FB',
  },
  centerText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
    fontWeight: '600',
  },
  backBtnSimple: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFE9F6',
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBox: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1F1235',
  },
  datesEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  datesEditText: {
    fontSize: 11,
    color: '#6B7280',
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
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  tabPillActive: {
    backgroundColor: '#2D114D',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
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
    borderColor: '#EFEBF5',
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
    backgroundColor: 'rgba(31, 18, 53, 0.75)',
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
    borderColor: '#EFEBF5',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  morePhotosBox: {
    position: 'relative',
    backgroundColor: '#2D114D',
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
    borderColor: '#EFEBF5',
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carMakeYear: {
    fontSize: 11,
    color: '#8A8F98',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  carFullTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1235',
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
    borderTopColor: '#F3F4F6',
  },
  hubText: {
    flex: 1,
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  distanceBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6000',
  },
  specsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  specCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  specVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 4,
  },
  specLbl: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 1,
  },

  /* Sections */
  sectionBox: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  sectionHeaderSub: {
    fontSize: 11,
    color: '#6B7280',
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
    borderColor: '#EFEBF5',
  },
  packageCardActive: {
    borderColor: '#2D114D',
    backgroundColor: '#FAF7FD',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#2D114D',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2D114D',
  },
  packageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  packageTitleActive: {
    color: '#1F1235',
    fontWeight: '800',
  },
  packageSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: '#FF7A00',
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
    color: '#1F1235',
  },

  /* Ask Anything Chips */
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
    borderColor: '#EFEBF5',
  },
  inquiryChipActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  inquiryChipText: {
    fontSize: 11,
    color: '#374151',
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
    marginBottom: 2,
  },
  answerBodyText: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16,
  },

  /* Host Reliability Card */
  hostReliabilityCard: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
  },
  hostReliabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  hostReliabilityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  hostReliabilitySub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  hostOfferStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C0830',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  hostOfferText: {
    fontSize: 10,
    color: '#E9DDF7',
    fontWeight: '600',
  },

  /* Promise Card */
  promiseCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  promiseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
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
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
  },

  /* Sticky Footer */
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  fareBreakupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  fareBreakupToggleText: {
    fontSize: 11,
    color: '#2D114D',
    fontWeight: '700',
  },
  footerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerPriceTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1235',
  },
  footerGstInclusive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  proceedBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  proceedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  refundableNote: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },

  /* Breakup Modal */
  breakupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  breakupSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  breakupGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  breakupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1235',
    marginBottom: 14,
  },
  breakupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakupKey: {
    fontSize: 12,
    color: '#6B7280',
  },
  breakupVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F1235',
  },
  breakupDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  breakupRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakupTotalKey: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
  },
  breakupTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6000',
  },
  closeBreakupBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  closeBreakupText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
