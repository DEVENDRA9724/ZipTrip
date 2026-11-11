import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest, getVehicleImageSource, getCarDistance, getVehicleTerms } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  Search,
  X,
  Star,
  ShieldCheck,
  ArrowRight,
  Car,
  Check,
  Heart,
  Navigation,
  Sparkles,
  Tag,
  Building2,
  Plane,
  Compass,
  Crown,
  Briefcase,
  Zap,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 42) / 2;

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const OUR_BENEFITS = [
  { icon: ShieldCheck, title: '100% Secured Trip', sub: 'Hassle-Free Handover' },
  { icon: MapPin, title: 'Doorstep Delivery', sub: 'Airport & Citywide' },
  { icon: Star, title: '25k+ Top Rated', sub: 'Verified Private Cars' },
  { icon: Tag, title: 'Zero Security Deposit', sub: 'On DigiLocker KYC' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatShortDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [bookingMode, setBookingMode] = useState<'self' | 'taxi'>('self');
  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('Swami Vivekanand Bridge, Ahmedabad');
  const [deliveryAnywhere, setDeliveryAnywhere] = useState(true);
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');
  const [activeDriveOption, setActiveDriveOption] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Dates: Tomorrow to Day after tomorrow
  const [startDate, setStartDate] = useState(() => ymd(new Date(Date.now() + 864e5)));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(() => ymd(new Date(Date.now() + 2 * 864e5)));
  const [endTime, setEndTime] = useState('10:00 AM');

  // Modals
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // Vehicles
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const endpoint = city === 'All' ? '/vehicles' : `/vehicles?city=${encodeURIComponent(city)}`;
          const data = await apiRequest(endpoint);
          if (alive) {
            setVehicles(Array.isArray(data) ? data : []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [city])
  );

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const days = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 1;
    return Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate]);

  // Filter fleet based on drive option and mode
  const fleet = useMemo(() => {
    return vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi');
      if (bookingMode === 'self' && isTaxi) return false;
      if (bookingMode === 'taxi' && !isTaxi) return false;

      // Filter by drive option
      if (activeDriveOption === 'yatra') {
        // Outstation road trips: SUVs, Sedans & tourers
        const cat = String(v.category || '').toUpperCase();
        return cat.includes('SUV') || cat.includes('MUV') || String(v.model || '').toLowerCase().includes('thar');
      }
      if (activeDriveOption === 'business') {
        // Executive business: Automatics and Sedans
        return String(v.transmission || '').toLowerCase().includes('auto') || String(v.category || '').toUpperCase().includes('SEDAN');
      }
      return true;
    });
  }, [vehicles, bookingMode, activeDriveOption]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  // Safe top padding guaranteeing clearance above the iPhone notch / Dynamic Island
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  // Handle Search Car Button
  const handleSearchCars = () => {
    setIsSearching(true);
    setSearchFeedback(`Found ${fleet.length} verified cars in ${city} for ${formatShortDate(startDate)} → ${formatShortDate(endDate)}`);
    setTimeout(() => {
      setIsSearching(false);
      scrollRef.current?.scrollTo({ y: 550, animated: true });
    }, 300);
  };

  // Handle Selection of Safar Original Drive Options
  const handleSelectDriveOption = (optionId: string) => {
    setActiveDriveOption(optionId);
    if (optionId === 'flexidrive') {
      setKmPackage('standard');
      setSearchFeedback('FlexiDrive™ selected: Flexible daily rate with 300 KMs included.');
    } else if (optionId === 'yatra') {
      setKmPackage('unlimited');
      setSearchFeedback('Gujarat Yatra™ selected: Unlimited KMs package for outstation trips.');
    } else if (optionId === 'clublease') {
      // Set to 7 days ahead
      const startD = new Date(startDate);
      const newEnd = new Date(startD.getTime() + 7 * 864e5);
      setEndDate(ymd(newEnd));
      setSearchFeedback('Club Lease™ selected: 7-day extended booking with 25% discount unlocked.');
    } else if (optionId === 'business') {
      setKmPackage('standard');
      setSearchFeedback('Business Exec™ selected: Automatic corporate sedans & SUVs.');
    }
    // Smooth scroll down to the cars fleet
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 550, animated: true });
    }, 200);
  };

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── TOP APP BAR (CLEAR OF NOTCH) ────────── */}
      <View style={s.topBar}>
        <View style={s.brandGroup}>
          <Image
            source={require('../../assets/safar-logo.png')}
            style={s.brandLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={s.brandName}>Safar Self Drive</Text>
            <TouchableOpacity
              style={s.citySelector}
              onPress={() => setCityModalOpen(true)}
              activeOpacity={0.7}
            >
              <MapPin size={11} color="#FF6000" />
              <Text style={s.cityName}>{city}</Text>
              <ChevronDown size={11} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.topBarRight}>
          {user ? (
            <TouchableOpacity
              style={s.userAvatar}
              onPress={() => router.push('/wallet')}
              activeOpacity={0.8}
            >
              <Text style={s.userInitial}>
                {(user.firstName || user.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.loginPill}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.85}
            >
              <Text style={s.loginPillText}>Log In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── SAFAR GRADIENT HERO BANNER ────────── */}
        <LinearGradient
          colors={['#FAF5FF', '#F3EEFA', '#FDFBFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroBanner}
        >
          <View style={s.heroTagBadge}>
            <Sparkles size={11} color="#FF6000" />
            <Text style={s.heroTagText}>GUJARAT'S PREMIER SELF DRIVE</Text>
          </View>

          <Text style={s.heroMainTitle}>Your Journey. Your Rules.</Text>
          <Text style={s.heroSubtitle}>
            Verified cars with private number plates • Instant DigiLocker handover
          </Text>
        </LinearGradient>

        {/* ────────── SEARCH & CALENDAR CARD ────────── */}
        <View style={s.searchCard}>
          {/* Location Search Bar with GPS Icon */}
          <TouchableOpacity
            style={s.locationInputBox}
            onPress={() => setCityModalOpen(true)}
            activeOpacity={0.85}
          >
            <Search size={16} color="#2D114D" />
            <Text style={s.locationInputText} numberOfLines={1}>
              {hubAddress}
            </Text>
            <TouchableOpacity onPress={() => setCityModalOpen(true)}>
              <Navigation size={16} color="#FF6000" />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Two Side-By-Side Calendar Date/Time Blocks */}
          <View style={s.datesRow}>
            {/* Trip Start */}
            <TouchableOpacity
              style={s.dateBox}
              onPress={() => setStartPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={s.dateBoxLabel}>Trip Start</Text>
              <Text style={s.dateBoxValue}>
                {formatShortDate(startDate)}, {startTime}
              </Text>
            </TouchableOpacity>

            {/* Trip End */}
            <TouchableOpacity
              style={s.dateBox}
              onPress={() => setEndPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={s.dateBoxLabel}>Trip End</Text>
              <Text style={s.dateBoxValue}>
                {formatShortDate(endDate)}, {endTime}
              </Text>
            </TouchableOpacity>
          </View>

          {/* KM Package Selector: 300 kms vs Unlimited */}
          <View style={s.kmSelectorRow}>
            <TouchableOpacity
              style={[s.kmPill, kmPackage === 'standard' && s.kmPillActive]}
              onPress={() => setKmPackage('standard')}
              activeOpacity={0.8}
            >
              <Text style={[s.kmPillText, kmPackage === 'standard' && s.kmPillTextActive]}>
                300 Kms incl.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.kmPill, kmPackage === 'unlimited' && s.kmPillActive]}
              onPress={() => setKmPackage('unlimited')}
              activeOpacity={0.8}
            >
              <Sparkles size={11} color={kmPackage === 'unlimited' ? '#FFD166' : '#FF6000'} />
              <Text style={[s.kmPillText, kmPackage === 'unlimited' && s.kmPillTextActive]}>
                Unlimited kms
              </Text>
            </TouchableOpacity>
          </View>

          {/* Delivery & Pick-up from Anywhere Checkbox */}
          <TouchableOpacity
            style={s.checkboxRow}
            onPress={() => setDeliveryAnywhere((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, deliveryAnywhere && s.checkboxActive]}>
              {deliveryAnywhere && <Check size={12} color="#FFF" strokeWidth={3} />}
            </View>
            <Text style={s.checkboxLabel}>Doorstep delivery & pickup from anywhere</Text>
          </TouchableOpacity>

          {/* Safar Vibrant Orange Gradient Search Car CTA Button */}
          <TouchableOpacity
            style={s.searchCarBtn}
            onPress={handleSearchCars}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#FF6000', '#FF7A1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.searchCarGradient}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Search size={17} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={s.searchCarBtnText}>Search Available Cars</Text>
                  <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ────────── MODERN GRADIENT FLEXI NOTICE CARD ────────── */}
        <LinearGradient
          colors={['#FAF5FF', '#F4ECFB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.flexiCard}
        >
          <View style={s.flexiTopRow}>
            <LinearGradient
              colors={['#2D114D', '#461979']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.flexiBadge}
            >
              <Sparkles size={11} color="#FFD166" />
              <Text style={s.flexiBadgeText}>FLEXI DOORSTEP SERVICE</Text>
            </LinearGradient>

            <View style={s.flexiDistancePill}>
              <MapPin size={11} color="#FF6000" />
              <Text style={s.flexiDistanceText}>Airport & Citywide</Text>
            </View>
          </View>
          <Text style={s.flexiText}>
            Hosts can deliver and collect your car directly at your doorstep, hotel, or Ahmedabad / Surat Airport.
          </Text>
        </LinearGradient>

        {/* ────────── ORIGINAL SAFAR DRIVE FORMATS (NOT ZOOMCAR COPIED) ────────── */}
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionMainTitle}>Safar Drive Formats</Text>
            <Text style={s.sectionSubTitle}>Curated self-drive plans crafted for Gujarat</Text>
          </View>
          {activeDriveOption !== 'all' && (
            <TouchableOpacity onPress={() => setActiveDriveOption('all')}>
              <Text style={s.resetFilterText}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2x2 Clean Modern Grid of Distinctive Safar Formats */}
        <View style={s.driveFormatsGrid}>
          {/* Tile 1: Safar FlexiDrive™ */}
          <TouchableOpacity
            style={[s.formatCard, activeDriveOption === 'flexidrive' && s.formatCardSelected]}
            onPress={() => handleSelectDriveOption('flexidrive')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={activeDriveOption === 'flexidrive' ? ['#2D114D', '#441473'] : ['#FAF5FF', '#F3EEFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.formatCardGradient}
            >
              <View style={s.formatHeaderRow}>
                <View
                  style={[
                    s.formatIconBox,
                    activeDriveOption === 'flexidrive' ? s.formatIconBoxActive : s.formatIconBoxPurple,
                  ]}
                >
                  <Zap size={18} color={activeDriveOption === 'flexidrive' ? '#FF6000' : '#2D114D'} />
                </View>
                <View
                  style={[
                    s.formatTagBadge,
                    activeDriveOption === 'flexidrive' ? s.formatTagActive : s.formatTagDefault,
                  ]}
                >
                  <Text
                    style={[
                      s.formatTagText,
                      activeDriveOption === 'flexidrive' ? s.formatTagTextActive : s.formatTagTextPurple,
                    ]}
                  >
                    MOST POPULAR
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  s.formatTitle,
                  activeDriveOption === 'flexidrive' ? s.textWhite : s.textPurple,
                ]}
              >
                FlexiDrive™
              </Text>
              <Text
                style={[
                  s.formatSub,
                  activeDriveOption === 'flexidrive' ? s.textLightPurple : s.textMuted,
                ]}
              >
                Hourly & Daily • Flexible return
              </Text>
              <View style={s.formatFooterRow}>
                <Text
                  style={[
                    s.formatPerk,
                    activeDriveOption === 'flexidrive' ? s.textGold : s.textOrange,
                  ]}
                >
                  ⚡ Zero Security Deposit
                </Text>
                <ArrowRight
                  size={14}
                  color={activeDriveOption === 'flexidrive' ? '#FFFFFF' : '#2D114D'}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Tile 2: Safar Gujarat Yatra™ */}
          <TouchableOpacity
            style={[s.formatCard, activeDriveOption === 'yatra' && s.formatCardSelected]}
            onPress={() => handleSelectDriveOption('yatra')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={activeDriveOption === 'yatra' ? ['#2D114D', '#441473'] : ['#FFF7ED', '#FFEDD5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.formatCardGradient}
            >
              <View style={s.formatHeaderRow}>
                <View
                  style={[
                    s.formatIconBox,
                    activeDriveOption === 'yatra' ? s.formatIconBoxActive : s.formatIconBoxOrange,
                  ]}
                >
                  <Compass size={18} color={activeDriveOption === 'yatra' ? '#FF6000' : '#C2410C'} />
                </View>
                <View
                  style={[
                    s.formatTagBadge,
                    activeDriveOption === 'yatra' ? s.formatTagActive : s.formatTagAmber,
                  ]}
                >
                  <Text
                    style={[
                      s.formatTagText,
                      activeDriveOption === 'yatra' ? s.formatTagTextActive : s.formatTagTextAmber,
                    ]}
                  >
                    UNLIMITED KMS
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  s.formatTitle,
                  activeDriveOption === 'yatra' ? s.textWhite : s.textDarkAmber,
                ]}
              >
                Gujarat Yatra™
              </Text>
              <Text
                style={[
                  s.formatSub,
                  activeDriveOption === 'yatra' ? s.textLightPurple : s.textMutedAmber,
                ]}
              >
                Somnath • Dwarka • Gir • Kevadia
              </Text>
              <View style={s.formatFooterRow}>
                <Text
                  style={[
                    s.formatPerk,
                    activeDriveOption === 'yatra' ? s.textGold : s.textOrange,
                  ]}
                >
                  🚗 Highway SUVs & 4x4
                </Text>
                <ArrowRight
                  size={14}
                  color={activeDriveOption === 'yatra' ? '#FFFFFF' : '#C2410C'}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Tile 3: Safar Club Lease™ */}
          <TouchableOpacity
            style={[s.formatCard, activeDriveOption === 'clublease' && s.formatCardSelected]}
            onPress={() => handleSelectDriveOption('clublease')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={activeDriveOption === 'clublease' ? ['#2D114D', '#441473'] : ['#FAF5FF', '#F1E9FA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.formatCardGradient}
            >
              <View style={s.formatHeaderRow}>
                <View
                  style={[
                    s.formatIconBox,
                    activeDriveOption === 'clublease' ? s.formatIconBoxActive : s.formatIconBoxPurple,
                  ]}
                >
                  <Crown size={18} color={activeDriveOption === 'clublease' ? '#FFD166' : '#6B21A8'} />
                </View>
                <View
                  style={[
                    s.formatTagBadge,
                    activeDriveOption === 'clublease' ? s.formatTagActive : s.formatTagPurple,
                  ]}
                >
                  <Text
                    style={[
                      s.formatTagText,
                      activeDriveOption === 'clublease' ? s.formatTagTextActive : s.formatTagTextPurple,
                    ]}
                  >
                    SAVE UP TO 35%
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  s.formatTitle,
                  activeDriveOption === 'clublease' ? s.textWhite : s.textPurple,
                ]}
              >
                Club Lease™
              </Text>
              <Text
                style={[
                  s.formatSub,
                  activeDriveOption === 'clublease' ? s.textLightPurple : s.textMuted,
                ]}
              >
                7 to 90 Days • Free Car Swap
              </Text>
              <View style={s.formatFooterRow}>
                <Text
                  style={[
                    s.formatPerk,
                    activeDriveOption === 'clublease' ? s.textGold : s.textOrange,
                  ]}
                >
                  👑 Zero Maintenance
                </Text>
                <ArrowRight
                  size={14}
                  color={activeDriveOption === 'clublease' ? '#FFFFFF' : '#2D114D'}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Tile 4: Safar Business Exec™ */}
          <TouchableOpacity
            style={[s.formatCard, activeDriveOption === 'business' && s.formatCardSelected]}
            onPress={() => handleSelectDriveOption('business')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={activeDriveOption === 'business' ? ['#2D114D', '#441473'] : ['#F8FAFC', '#EEF2F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.formatCardGradient}
            >
              <View style={s.formatHeaderRow}>
                <View
                  style={[
                    s.formatIconBox,
                    activeDriveOption === 'business' ? s.formatIconBoxActive : s.formatIconBoxBlue,
                  ]}
                >
                  <Briefcase size={18} color={activeDriveOption === 'business' ? '#60A5FA' : '#1E40AF'} />
                </View>
                <View
                  style={[
                    s.formatTagBadge,
                    activeDriveOption === 'business' ? s.formatTagActive : s.formatTagBlue,
                  ]}
                >
                  <Text
                    style={[
                      s.formatTagText,
                      activeDriveOption === 'business' ? s.formatTagTextActive : s.formatTagTextBlue,
                    ]}
                  >
                    MON – FRI PASS
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  s.formatTitle,
                  activeDriveOption === 'business' ? s.textWhite : s.textDarkBlue,
                ]}
              >
                Business Exec™
              </Text>
              <Text
                style={[
                  s.formatSub,
                  activeDriveOption === 'business' ? s.textLightPurple : s.textMutedBlue,
                ]}
              >
                Ahmedabad & Surat Commute
              </Text>
              <View style={s.formatFooterRow}>
                <Text
                  style={[
                    s.formatPerk,
                    activeDriveOption === 'business' ? s.textGold : s.textBlue,
                  ]}
                >
                  💼 GST Invoice Ready
                </Text>
                <ArrowRight
                  size={14}
                  color={activeDriveOption === 'business' ? '#FFFFFF' : '#1E40AF'}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ────────── OUR BENEFITS SECTION ────────── */}
        <View style={s.benefitsRow}>
          {OUR_BENEFITS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <View key={idx} style={s.benefitCard}>
                <View style={s.benefitIconCircle}>
                  <Icon size={14} color="#FF6000" />
                </View>
                <Text style={s.benefitTitle}>{item.title}</Text>
                <Text style={s.benefitSub}>{item.sub}</Text>
              </View>
            );
          })}
        </View>

        {/* ────────── ACTIVE SEARCH / FILTER FEEDBACK BANNER ────────── */}
        {searchFeedback && (
          <View style={s.feedbackBanner}>
            <CheckCircle2 size={16} color="#059669" />
            <Text style={s.feedbackText}>{searchFeedback}</Text>
          </View>
        )}

        {/* ────────── "UNMATCHED SELECTION" HEADER ────────── */}
        <View style={s.selectionHeaderCard}>
          <Text style={s.selectionTitle}>Verified Gujarat Fleet</Text>
          <Text style={s.selectionSub}>Sanitized cars with complete insurance & instant handover</Text>
          <View style={s.selectionDatesPill}>
            <Calendar size={11} color="#FF6000" />
            <Text style={s.selectionDates}>
              {formatShortDate(startDate)} – {formatShortDate(endDate)} ({days} {days === 1 ? 'day' : 'days'})
            </Text>
          </View>
        </View>

        {/* ────────── 2-COLUMN CAR BOX GRID ────────── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#2D114D" />
            <Text style={s.loadingText}>Loading available cars…</Text>
          </View>
        ) : fleet.length === 0 ? (
          <View style={s.emptyBox}>
            <Car size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>No cars available for selected filter</Text>
            <Text style={s.emptySub}>Tap Show All or select another location/date.</Text>
            <TouchableOpacity
              style={s.resetEmptyBtn}
              onPress={() => setActiveDriveOption('all')}
            >
              <Text style={s.resetEmptyBtnText}>Show All Available Cars</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.carGrid}>
            {fleet.map((car) => {
              const terms = getVehicleTerms(car);
              const price = Number(car.pricePerDay || 2500);
              const isFav = !!favorites[car.id];
              const dist = getCarDistance(car);

              return (
                <TouchableOpacity
                  key={car.id}
                  style={s.carBoxCard}
                  onPress={() => openCar(String(car.id))}
                  activeOpacity={0.88}
                >
                  {/* Photo Stage */}
                  <View style={s.carBoxImageWrap}>
                    <Image
                      source={getVehicleImageSource(car)}
                      style={s.carBoxImage}
                      resizeMode="cover"
                    />

                    {/* Rating Badge on Top-Left */}
                    <View style={s.carBoxRating}>
                      <Star size={10} color="#FFB800" fill="#FFB800" />
                      <Text style={s.carBoxRatingText}>4.9★</Text>
                    </View>

                    {/* Wishlist Heart on Top-Right */}
                    <TouchableOpacity
                      style={s.carBoxHeart}
                      onPress={() => toggleFavorite(String(car.id))}
                      activeOpacity={0.8}
                    >
                      <Heart
                        size={14}
                        color={isFav ? '#FF6000' : '#FFFFFF'}
                        fill={isFav ? '#FF6000' : 'transparent'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Body Content */}
                  <View style={s.carBoxBody}>
                    <Text style={s.carBoxTitle} numberOfLines={1}>
                      {car.make} {car.model}
                    </Text>

                    <Text style={s.carBoxSpecs} numberOfLines={1}>
                      {car.fuelType || 'Petrol'} • {car.transmission || 'Manual'}
                    </Text>

                    <Text style={s.carBoxDistance}>
                      📍 {dist} km away
                    </Text>

                    <View style={s.carBoxPriceRow}>
                      <View>
                        <Text style={s.carBoxPrice}>
                          ₹{price.toLocaleString('en-IN')}
                          <Text style={s.carBoxUnit}>/day</Text>
                        </Text>
                        <Text style={s.carBoxTripTotal}>
                          ₹{(price * days).toLocaleString('en-IN')} total
                        </Text>
                      </View>

                      <LinearGradient
                        colors={['#FF6000', '#FF7A1A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.carBoxBookBtn}
                      >
                        <Text style={s.carBoxBookText}>Book</Text>
                      </LinearGradient>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ────────── HOST BOTTOM BANNER ────────── */}
        <TouchableOpacity
          style={s.hostBanner}
          onPress={() => router.push('/host')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.hostBannerTitle}>Have an idle car in Gujarat?</Text>
            <Text style={s.hostBannerSub}>
              Earn ₹45,000+ monthly by hosting on Safar with zero liability.
            </Text>
          </View>
          <View style={s.hostBannerAction}>
            <Text style={s.hostBannerActionText}>Host & Earn</Text>
            <ArrowRight size={14} color="#FF6000" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ────────── CITY MODAL ────────── */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCityModalOpen(false)}
        >
          <View style={s.citySheet}>
            <Text style={s.citySheetTitle}>Select Location in Gujarat</Text>
            {CITIES.map((c) => {
              const active = c === city;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.cityRow, active && s.cityRowActive]}
                  onPress={() => {
                    setCity(c);
                    setHubAddress(`${c}, Gujarat (Airport & City Hubs)`);
                    setCityModalOpen(false);
                  }}
                >
                  <MapPin size={16} color={active ? '#FF6000' : '#6B7280'} />
                  <Text style={[s.cityRowText, active && s.cityRowTextActive]}>{c}</Text>
                  {active && <Check size={16} color="#FF6000" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date & Time Picker Modals */}
      <DateTimePickerModal
        visible={startPickerOpen}
        title="Select Trip Start Date & Time"
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
        title="Select Trip End Date & Time"
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
    backgroundColor: '#F8F6FB',
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEBF5',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D114D',
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  cityName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  topBarRight: {},
  loginPill: {
    backgroundColor: '#2D114D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loginPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  /* Hero Banner */
  heroBanner: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8F8',
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.8,
  },
  heroMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2D114D',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 3,
  },

  /* Search Card */
  searchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    shadowColor: '#2D114D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  locationInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDF2',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  locationInputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  datesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dateBox: {
    flex: 1,
    backgroundColor: '#FAF8FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDF2',
    padding: 10,
  },
  dateBoxLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  dateBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 3,
  },

  /* KM Selector Row */
  kmSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  kmPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F3EEFA',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  kmPillActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  kmPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D114D',
  },
  kmPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  searchCarBtn: {
    borderRadius: 14,
    marginTop: 14,
    overflow: 'hidden',
    shadowColor: '#FF6000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  searchCarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  searchCarBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* Flexi Notice Card */
  flexiCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D8F8',
    padding: 14,
  },
  flexiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  flexiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flexiBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  flexiDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  flexiDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6000',
  },
  flexiText: {
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16.5,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionMainTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2D114D',
  },
  sectionSubTitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6000',
  },

  /* Drive Formats 2x2 Grid */
  driveFormatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  formatCard: {
    width: (W - 42) / 2,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEBF5',
    shadowColor: '#2D114D',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  formatCardSelected: {
    borderColor: '#FF6000',
    borderWidth: 1.5,
  },
  formatCardGradient: {
    padding: 12,
    minHeight: 136,
    justifyContent: 'space-between',
  },
  formatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatIconBoxActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  formatIconBoxPurple: {
    backgroundColor: '#F3EEFA',
  },
  formatIconBoxOrange: {
    backgroundColor: '#FFEDD5',
  },
  formatIconBoxBlue: {
    backgroundColor: '#DBEAFE',
  },
  formatTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  formatTagActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  formatTagDefault: {
    backgroundColor: '#FFF1E8',
  },
  formatTagAmber: {
    backgroundColor: '#FEF3C7',
  },
  formatTagPurple: {
    backgroundColor: '#F3E8FF',
  },
  formatTagBlue: {
    backgroundColor: '#DBEAFE',
  },
  formatTagText: {
    fontSize: 8,
    fontWeight: '800',
  },
  formatTagTextActive: {
    color: '#FFFFFF',
  },
  formatTagTextPurple: {
    color: '#2D114D',
  },
  formatTagTextAmber: {
    color: '#92400E',
  },
  formatTagTextBlue: {
    color: '#1E40AF',
  },
  formatTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 6,
  },
  formatSub: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  formatFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  formatPerk: {
    fontSize: 9.5,
    fontWeight: '800',
  },

  /* Text Color Helpers */
  textWhite: { color: '#FFFFFF' },
  textPurple: { color: '#2D114D' },
  textDarkAmber: { color: '#7C2D12' },
  textDarkBlue: { color: '#0F172A' },
  textLightPurple: { color: '#E9D5FF' },
  textMuted: { color: '#6B7280' },
  textMutedAmber: { color: '#9A3412' },
  textMutedBlue: { color: '#64748B' },
  textGold: { color: '#FFD166' },
  textOrange: { color: '#FF6000' },
  textBlue: { color: '#2563EB' },

  /* Benefits Row */
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 8,
    marginTop: 18,
  },
  benefitCard: {
    width: (W - 40) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 3,
  },
  benefitIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 2,
  },
  benefitSub: {
    fontSize: 9.5,
    color: '#6B7280',
  },

  /* Feedback Banner */
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 10,
  },
  feedbackText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },

  /* Unmatched Selection Header */
  selectionHeaderCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D114D',
  },
  selectionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  selectionDatesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  selectionDates: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FF6000',
  },

  /* 2-Column Car Box Grid */
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 14,
  },
  carBoxCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  carBoxImageWrap: {
    height: 115,
    backgroundColor: '#FAF8FC',
    position: 'relative',
    overflow: 'hidden',
  },
  carBoxImage: {
    width: '100%',
    height: '100%',
  },
  carBoxRating: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(45, 17, 77, 0.82)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  carBoxRatingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  carBoxHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBoxBody: {
    padding: 10,
  },
  carBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D114D',
  },
  carBoxSpecs: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  carBoxDistance: {
    fontSize: 9.5,
    color: '#8A8F98',
    marginTop: 3,
  },
  carBoxPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  carBoxPrice: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#2D114D',
  },
  carBoxUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  carBoxTripTotal: {
    fontSize: 9,
    color: '#8A8F98',
    marginTop: 1,
  },
  carBoxBookBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBoxBookText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyBox: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
  },
  emptySub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  resetEmptyBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 6,
  },
  resetEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Host Banner */
  hostBanner: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#1E0A34',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hostBannerSub: {
    fontSize: 10.5,
    color: '#D8B4FE',
    marginTop: 3,
    lineHeight: 15,
  },
  hostBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  hostBannerActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6000',
  },

  /* City Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  citySheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  citySheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D114D',
    marginBottom: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  cityRowActive: {
    backgroundColor: '#FAF5FF',
  },
  cityRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cityRowTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
});
