import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest, getVehicleImageSource, getCarDistance, getVehicleTerms } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  MapPin,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Phone,
  ShieldCheck,
  Sparkles,
  Clock,
  Compass,
  ArrowRight,
  ArrowUpRight,
  Car,
  Fuel,
  Gauge,
  Users,
  Building2,
  Plane,
  Star,
  Zap,
  SlidersHorizontal,
  CheckCircle2,
  Navigation,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const ROADTRIP_W = W * 0.72;

const CITIES = ['All', 'Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const HUBS: Record<string, string[]> = {
  Ahmedabad: ['SVP Airport (AMD)', 'SG Highway, Bodakdev', 'Prahladnagar', 'Kalupur Rly Station', 'Drive-In Road'],
  Surat: ['Surat Airport (STV)', 'Vesu / VIP Road', 'Surat Railway Station', 'Adajan Hub'],
  Vadodara: ['Vadodara Airport (BDQ)', 'Alkapuri Hub', 'Railway Station', 'Gotri'],
  Gandhinagar: ['Infocity Hub', 'Gift City Road', 'Sector 11 Bus Port'],
  Rajkot: ['Hirasar Airport (HSR)', '150 Feet Ring Road', 'Yagnik Road'],
  All: ['Anywhere in Gujarat', 'Doorstep Delivery (Airport / Home)'],
};

const COLLECTIONS = [
  { key: 'All', title: 'All Fleet', subtitle: 'Browse all cars', icon: Car },
  { key: 'SUV', title: '4x4 & SUVs', subtitle: 'Thar, Scorpio, Creta', icon: Navigation },
  { key: 'Luxury', title: 'Luxury Class', subtitle: 'BMW, Mercedes, Fortuner', icon: Sparkles },
  { key: 'Sedan', title: 'Executive Sedans', subtitle: 'City, Dzire, Verna', icon: Car },
  { key: '7Seater', title: '7-Seater Family', subtitle: 'Innova, Carens, Ertiga', icon: Users },
  { key: 'Hatchback', title: 'City Hatchbacks', subtitle: 'Swift, i20, Baleno', icon: Zap },
];

const POPULAR_ROADTRIPS = [
  {
    id: 'sou',
    title: 'Statue of Unity',
    subtitle: 'Kevadia · 198 km from AMD',
    duration: '3.5 hrs drive',
    car: 'Innova Crysta / SUV',
    image: require('../../assets/cars/innova.jpg'),
    tag: 'Weekend Classic',
  },
  {
    id: 'gir',
    title: 'Gir Lion Reserve',
    subtitle: 'Sasan Gir · 360 km from AMD',
    duration: '6.5 hrs drive',
    car: 'Mahindra Thar 4x4',
    image: require('../../assets/cars/thar.jpg'),
    tag: 'Wildlife Safari',
  },
  {
    id: 'rann',
    title: 'White Rann of Kutch',
    subtitle: 'Dhordo · 410 km from AMD',
    duration: '7.0 hrs drive',
    car: 'Scorpio-N / Fortuner',
    image: require('../../assets/cars/scorpio.jpg'),
    tag: 'Desert Expedition',
  },
  {
    id: 'diu',
    title: 'Diu & Somnath Coast',
    subtitle: 'Arabian Sea · 380 km',
    duration: '7.5 hrs drive',
    car: 'Hyundai Creta / BMW',
    image: require('../../assets/cars/creta.jpg'),
    tag: 'Coastal Drive',
  },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shortDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const weekday = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { weekday: 'short' });
};

export default function HomeScreen() {
  const { user } = require('@/context/AuthContext').useAuth();

  const [bookingMode, setBookingMode] = useState<'self' | 'taxi'>('self');
  const [city, setCity] = useState('Ahmedabad');
  const [hub, setHub] = useState('SVP Airport (AMD)');
  const [category, setCategory] = useState('All');
  const [deliveryType, setDeliveryType] = useState<'hub' | 'doorstep'>('hub');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Dates: Tomorrow 10 AM to Day after tomorrow 10 AM (2 days)
  const [startDate, setStartDate] = useState(() => ymd(new Date(Date.now() + 864e5)));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(() => ymd(new Date(Date.now() + 2 * 864e5)));
  const [endTime, setEndTime] = useState('10:00 AM');

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

  const days = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    return isNaN(a) || isNaN(b) || b <= a ? 1 : Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate]);

  // Self drive fleet vs Taxi fleet
  const fleet = useMemo(() => {
    return vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi') || String(v.category || '').toLowerCase().includes('taxi');
      return bookingMode === 'self' ? !isTaxi : isTaxi;
    });
  }, [vehicles, bookingMode]);

  // Star Spotlight vehicle (e.g. Thar, BMW or Fortuner)
  const spotlightCar = useMemo(() => {
    if (!fleet.length) return null;
    const priority = ['thar', 'bmw', 'fortuner', 'innova', 'scorpio', 'creta'];
    for (const key of priority) {
      const found = fleet.find((v) => `${v.make} ${v.model}`.toLowerCase().includes(key));
      if (found) return found;
    }
    return fleet[0];
  }, [fleet]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleet.filter((v) => {
      const cat = String(v.category || '').toLowerCase();
      const seats = Number(v.seats || 5);
      const fullText = `${v.make} ${v.model} ${v.category} ${v.fuelType} ${v.transmission}`.toLowerCase();

      if (category === 'SUV') {
        const isSuv = cat.includes('suv') || cat.includes('muv') || fullText.includes('thar') || fullText.includes('scorpio');
        if (!isSuv) return false;
      } else if (category === 'Luxury') {
        const isLux = cat.includes('luxury') || fullText.includes('bmw') || fullText.includes('mercedes') || fullText.includes('fortuner');
        if (!isLux) return false;
      } else if (category === 'Sedan') {
        if (!cat.includes('sedan') && !fullText.includes('city') && !fullText.includes('dzire') && !fullText.includes('verna')) return false;
      } else if (category === '7Seater') {
        if (seats < 7 && !cat.includes('7') && !fullText.includes('innova') && !fullText.includes('carens') && !fullText.includes('ertiga')) return false;
      } else if (category === 'Hatchback') {
        if (!cat.includes('hatch') && !fullText.includes('swift') && !fullText.includes('i20') && !fullText.includes('baleno')) return false;
      }

      if (q && !fullText.includes(q)) return false;
      return true;
    });
  }, [fleet, category, query]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub, city },
    });
  };

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ══════════════════════════════════════════════════════════
            LUXURY HEADER & HERO EXPERIENCE
        ══════════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={['#090210', '#1C0830', '#340F59', '#190629']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {/* Ambient luminous glow orbs */}
          <View style={[s.orb, { top: -60, right: -40, width: 280, height: 280, backgroundColor: 'rgba(255, 110, 0, 0.18)' }]} />
          <View style={[s.orb, { bottom: 20, left: -60, width: 240, height: 240, backgroundColor: 'rgba(157, 78, 221, 0.22)' }]} />

          <SafeAreaView edges={['top']}>
            {/* Top Navigation Row */}
            <View style={s.navRow}>
              {/* Brand Logo & Name */}
              <View style={s.brandGroup}>
                <View style={s.logoWrapper}>
                  <Image source={require('../../assets/safar-logo.png')} style={s.brandLogo} resizeMode="contain" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={s.brandTitle}>SAFAR</Text>
                    <View style={s.gujaratBadge}>
                      <Text style={s.gujaratText}>GUJARAT</Text>
                    </View>
                  </View>
                  <Text style={s.brandTagline}>Premium Self Drive Fleet</Text>
                </View>
              </View>

              {/* Action Buttons: City Selector & Profile/Login */}
              <View style={s.navActions}>
                <TouchableOpacity style={s.citySelectorPill} onPress={() => setCityModalOpen(true)} activeOpacity={0.8}>
                  <MapPin size={13} color="#FF7A00" />
                  <Text style={s.citySelectorText} numberOfLines={1}>
                    {city}
                  </Text>
                  <ChevronDown size={14} color="#C4B5FD" />
                </TouchableOpacity>

                {user ? (
                  <TouchableOpacity
                    style={s.userAvatar}
                    onPress={() => router.push('/wallet')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.userAvatarText}>
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

            {/* Mode Switcher: Self Drive vs Chauffeur Taxi */}
            <Animated.View entering={FadeInDown.delay(40).duration(450)} style={s.modeSwitcherWrap}>
              <TouchableOpacity
                style={[s.modeTab, bookingMode === 'self' && s.modeTabActive]}
                onPress={() => setBookingMode('self')}
                activeOpacity={0.85}
              >
                <Car size={16} color={bookingMode === 'self' ? '#240B3B' : '#C4B5FD'} />
                <Text style={[s.modeTabText, bookingMode === 'self' && s.modeTabTextActive]}>
                  Self Drive Car
                </Text>
                {bookingMode === 'self' && (
                  <View style={s.privatePill}>
                    <Text style={s.privatePillText}>Private Plate</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modeTab, bookingMode === 'taxi' && s.modeTabActive]}
                onPress={() => setBookingMode('taxi')}
                activeOpacity={0.85}
              >
                <Compass size={16} color={bookingMode === 'taxi' ? '#240B3B' : '#C4B5FD'} />
                <Text style={[s.modeTabText, bookingMode === 'taxi' && s.modeTabTextActive]}>
                  Taxi with Driver
                </Text>
                {bookingMode === 'taxi' && (
                  <View style={s.privatePill}>
                    <Text style={s.privatePillText}>Per KM Rate</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Hero Copy */}
            <Animated.View entering={FadeInDown.delay(80).duration(500)} style={s.heroHeadingWrap}>
              <Text style={s.heroSubtitle}>
                {bookingMode === 'self'
                  ? 'NO CHAUFFEUR · NO BOUNDARIES · ZERO DEPOSIT'
                  : 'VERIFIED DRIVERS · AIRPORT & OUTSTATION'}
              </Text>
              <Text style={s.heroTitle}>
                {bookingMode === 'self' ? (
                  <>
                    Drive Gujarat on{'\n'}
                    <Text style={s.highlightText}>Your Own Terms.</Text>
                  </>
                ) : (
                  <>
                    Comfortable Rides{'\n'}
                    <Text style={s.highlightText}>Across Gujarat.</Text>
                  </>
                )}
              </Text>
            </Animated.View>

            {/* ──────────────────────────────────────────────────────────
                FROSTED GLASS TRIP PLANNER CARD
            ────────────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(130).duration(550)} style={s.plannerCardWrap}>
              <BlurView intensity={Platform.OS === 'ios' ? 45 : 95} tint="dark" style={s.plannerGlass}>
                {/* Hub Selection Row */}
                <TouchableOpacity
                  style={s.plannerHubRow}
                  onPress={() => setCityModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <View style={s.hubPinIcon}>
                    <MapPin size={18} color="#FF7A00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.plannerLabel}>PICKUP & RETURN HUB</Text>
                    <Text style={s.plannerValueMain}>{city} · {hub}</Text>
                  </View>
                  <View style={s.changeHubBtn}>
                    <Text style={s.changeHubText}>Change</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.plannerDivider} />

                {/* Date & Time Row */}
                <View style={s.plannerDatesRow}>
                  {/* Start Date Cell */}
                  <TouchableOpacity
                    style={s.dateCell}
                    onPress={() => setStartOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.plannerLabel}>START DATE & TIME</Text>
                    <Text style={s.dateCellMain}>{shortDate(startDate)}</Text>
                    <View style={s.timeBadge}>
                      <Clock size={11} color="#C4B5FD" />
                      <Text style={s.timeBadgeText}>
                        {weekday(startDate)}, {startTime}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Days Duration Indicator Badge */}
                  <View style={s.durationIndicator}>
                    <View style={s.durationLine} />
                    <View style={s.durationPill}>
                      <Text style={s.durationPillNumber}>{days}</Text>
                      <Text style={s.durationPillText}>{days === 1 ? 'Day' : 'Days'}</Text>
                    </View>
                    <View style={s.durationLine} />
                  </View>

                  {/* Return Date Cell */}
                  <TouchableOpacity
                    style={[s.dateCell, { alignItems: 'flex-end' }]}
                    onPress={() => setEndOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.plannerLabel}>RETURN DATE & TIME</Text>
                    <Text style={s.dateCellMain}>{shortDate(endDate)}</Text>
                    <View style={s.timeBadge}>
                      <Clock size={11} color="#C4B5FD" />
                      <Text style={s.timeBadgeText}>
                        {weekday(endDate)}, {endTime}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Delivery Preference Switch */}
                <View style={s.deliveryToggleRow}>
                  <TouchableOpacity
                    style={[s.deliveryOption, deliveryType === 'hub' && s.deliveryOptionActive]}
                    onPress={() => setDeliveryType('hub')}
                    activeOpacity={0.8}
                  >
                    <Building2 size={13} color={deliveryType === 'hub' ? '#FF7A00' : '#A394B8'} />
                    <Text style={[s.deliveryText, deliveryType === 'hub' && s.deliveryTextActive]}>
                      Hub Self Pickup (Free)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.deliveryOption, deliveryType === 'doorstep' && s.deliveryOptionActive]}
                    onPress={() => setDeliveryType('doorstep')}
                    activeOpacity={0.8}
                  >
                    <Plane size={13} color={deliveryType === 'doorstep' ? '#FF7A00' : '#A394B8'} />
                    <Text style={[s.deliveryText, deliveryType === 'doorstep' && s.deliveryTextActive]}>
                      Airport / Doorstep Delivery
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Big Search / Confirm CTA */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    setCategory('All');
                  }}
                  style={{ marginTop: 14 }}
                >
                  <LinearGradient
                    colors={['#FF7A00', '#FF4E00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.findCarsCta}
                  >
                    <View style={s.ctaIconBox}>
                      <CalendarDays size={18} color="#FFF" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Text style={s.findCarsTitle}>
                        {loading ? 'Finding Available Cars…' : `Browse ${fleet.length} Available Cars`}
                      </Text>
                      <Text style={s.findCarsSub}>
                        {days * 300} km included · Zero deposit on DigiLocker KYC
                      </Text>
                    </View>
                    <ArrowRight size={20} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>

            {/* Quick Trust Badges Strip */}
            <Animated.View entering={FadeInDown.delay(180).duration(450)} style={s.trustStrip}>
              <View style={s.trustItem}>
                <ShieldCheck size={14} color="#00E676" />
                <Text style={s.trustLabel}>Zero Deposit</Text>
              </View>
              <View style={s.trustDot} />
              <View style={s.trustItem}>
                <Zap size={14} color="#FFD600" />
                <Text style={s.trustLabel}>5-Min Handover</Text>
              </View>
              <View style={s.trustDot} />
              <View style={s.trustItem}>
                <CheckCircle2 size={14} color="#69F0AE" />
                <Text style={s.trustLabel}>Private Plate (White)</Text>
              </View>
              <View style={s.trustDot} />
              <View style={s.trustItem}>
                <Star size={14} color="#FFA000" />
                <Text style={s.trustLabel}>4.9★ Rated</Text>
              </View>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══════════════════════════════════════════════════════════
            SPOTLIGHT CAR OF THE WEEK (FEATURED SHOWCASE)
        ══════════════════════════════════════════════════════════ */}
        {spotlightCar && !loading && (
          <View style={s.spotlightSection}>
            <View style={s.sectionHeader}>
              <View>
                <View style={s.sectionBadge}>
                  <Sparkles size={11} color="#FF6000" />
                  <Text style={s.sectionBadgeText}>MOST POPULAR IN GUJARAT</Text>
                </View>
                <Text style={s.sectionTitleText}>Spotlight Vehicle</Text>
              </View>
              <TouchableOpacity
                onPress={() => openCar(String(spotlightCar.id))}
                style={s.viewDetailsSmallBtn}
              >
                <Text style={s.viewDetailsSmallText}>Book Now</Text>
                <ChevronRight size={14} color="#2D114D" />
              </TouchableOpacity>
            </View>

            <Pressable
              onPress={() => openCar(String(spotlightCar.id))}
              style={({ pressed }) => [s.spotlightCard, pressed && { opacity: 0.96 }]}
            >
              <LinearGradient
                colors={['#170529', '#2E0B52']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.spotlightGradient}
              >
                <View style={s.spotlightTopRow}>
                  <View>
                    <Text style={s.spotlightBrand}>{spotlightCar.make}</Text>
                    <Text style={s.spotlightModel}>{spotlightCar.model}</Text>
                  </View>
                  <View style={s.spotlightRatingBadge}>
                    <Star size={12} color="#FFB800" fill="#FFB800" />
                    <Text style={s.spotlightRatingText}>4.96</Text>
                    <Text style={s.spotlightTripsText}>(94 trips)</Text>
                  </View>
                </View>

                {/* Car Showcase Image with subtle reflection shadow */}
                <View style={s.spotlightImageContainer}>
                  <Image
                    source={getVehicleImageSource(spotlightCar)}
                    style={s.spotlightImage}
                    resizeMode="contain"
                  />
                </View>

                {/* Specs Pills */}
                <View style={s.spotlightSpecsRow}>
                  <View style={s.spotlightSpecPill}>
                    <Gauge size={13} color="#FFB580" />
                    <Text style={s.spotlightSpecText}>{spotlightCar.transmission || 'Automatic'}</Text>
                  </View>
                  <View style={s.spotlightSpecPill}>
                    <Fuel size={13} color="#FFB580" />
                    <Text style={s.spotlightSpecText}>{spotlightCar.fuelType || 'Diesel'}</Text>
                  </View>
                  <View style={s.spotlightSpecPill}>
                    <Users size={13} color="#FFB580" />
                    <Text style={s.spotlightSpecText}>{spotlightCar.seats || 5} Seats</Text>
                  </View>
                  <View style={s.spotlightSpecPill}>
                    <ShieldCheck size={13} color="#00E676" />
                    <Text style={[s.spotlightSpecText, { color: '#00E676' }]}>Zero Dep</Text>
                  </View>
                </View>

                {/* Pricing & CTA */}
                <View style={s.spotlightFooter}>
                  <View>
                    <Text style={s.spotlightPricePerDay}>
                      ₹{Number(spotlightCar.pricePerDay || 0).toLocaleString('en-IN')}
                      <Text style={s.spotlightPriceUnit}> /day</Text>
                    </Text>
                    <Text style={s.spotlightTotalPrice}>
                      ₹{(Number(spotlightCar.pricePerDay || 0) * days).toLocaleString('en-IN')} for {days} {days === 1 ? 'day' : 'days'} ({days * 300} km)
                    </Text>
                  </View>

                  <View style={s.spotlightCtaBtn}>
                    <Text style={s.spotlightCtaText}>Select Vehicle</Text>
                    <ArrowUpRight size={17} color="#2D114D" />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            FLEET COLLECTIONS / CATEGORIES (CURATED PILLS)
        ══════════════════════════════════════════════════════════ */}
        <View style={s.collectionsSection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.eyebrowText}>EXPLORE FLEET</Text>
              <Text style={s.sectionTitleText}>Choose Vehicle Category</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSearchOpen((v) => !v)}
              style={s.searchToggleBtn}
            >
              <Search size={16} color="#2D114D" />
              <Text style={s.searchToggleText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Quick search bar if open */}
          {searchOpen && (
            <Animated.View entering={FadeInDown.duration(200)} style={s.searchBox}>
              <Search size={16} color="#8A8F98" />
              <TextInput
                autoFocus
                placeholder="Search by model, brand, e.g. Thar, Swift, Automatic..."
                placeholderTextColor="#A0A5AF"
                value={query}
                onChangeText={setQuery}
                style={s.searchInputField}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <X size={16} color="#8A8F98" />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Horizontal Category Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.collectionsScroll}
          >
            {COLLECTIONS.map((c) => {
              const active = c.key === category;
              const IconComponent = c.icon;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  activeOpacity={0.8}
                  style={[s.collectionCard, active && s.collectionCardActive]}
                >
                  <View style={[s.collectionIconBox, active && s.collectionIconBoxActive]}>
                    <IconComponent size={20} color={active ? '#FFFFFF' : '#2D114D'} />
                  </View>
                  <Text style={[s.collectionTitle, active && s.collectionTitleActive]}>
                    {c.title}
                  </Text>
                  <Text style={[s.collectionSubtitle, active && s.collectionSubtitleActive]}>
                    {c.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════
            THE FLEET CARDS FEED
        ══════════════════════════════════════════════════════════ */}
        <View style={s.fleetSection}>
          <View style={s.fleetHeaderRow}>
            <Text style={s.fleetCountText}>
              {loading ? 'Loading vehicles…' : `${filteredVehicles.length} cars ready for instant booking`}
            </Text>
            <View style={s.fleetSortPill}>
              <SlidersHorizontal size={12} color="#6B7280" />
              <Text style={s.fleetSortText}>All Gujarat Hubs</Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#2D114D" />
              <Text style={s.loadingText}>Fetching available vehicles in {city}…</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={s.emptyBox}>
              <Car size={42} color="#D1D5DB" />
              <Text style={s.emptyTitle}>No cars match your search</Text>
              <Text style={s.emptySub}>
                Try switching city or choosing "All Fleet" to see available options.
              </Text>
              <TouchableOpacity
                style={s.resetFilterBtn}
                onPress={() => {
                  setCategory('All');
                  setCity('All');
                  setQuery('');
                }}
              >
                <Text style={s.resetFilterBtnText}>Show All Cars in Gujarat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredVehicles.map((car, idx) => {
              const terms = getVehicleTerms(car);
              const pricePerDay = Number(car.pricePerDay || 0);
              const tripTotal = pricePerDay * days;
              const distanceKm = getCarDistance(car);

              return (
                <Animated.View
                  key={car.id || idx}
                  entering={FadeInDown.delay(Math.min(idx, 5) * 60).duration(380)}
                >
                  <Pressable
                    onPress={() => openCar(String(car.id))}
                    style={({ pressed }) => [s.carCard, pressed && { transform: [{ scale: 0.99 }] }]}
                  >
                    {/* Top Row: Tag + Distance */}
                    <View style={s.carCardHeader}>
                      <View style={s.instantTag}>
                        <Zap size={11} color="#FF6000" />
                        <Text style={s.instantTagText}>Instant Booking</Text>
                      </View>
                      <View style={s.distanceTag}>
                        <MapPin size={11} color="#6B7280" />
                        <Text style={s.distanceTagText}>{distanceKm} km from you</Text>
                      </View>
                    </View>

                    {/* Studio Car Photo */}
                    <View style={s.carImageWrap}>
                      <Image
                        source={getVehicleImageSource(car)}
                        style={s.carImage}
                        resizeMode="contain"
                      />
                      <View style={s.platePill}>
                        <Text style={s.platePillText}>White Plate (Self Drive)</Text>
                      </View>
                    </View>

                    {/* Car Name & Specs */}
                    <View style={s.carDetailsBox}>
                      <View style={s.carTitleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.carMakeText}>{car.make} · {car.year || '2024'}</Text>
                          <Text style={s.carModelText} numberOfLines={1}>{car.model}</Text>
                        </View>
                        <View style={s.carRatingPill}>
                          <Star size={11} color="#FFB800" fill="#FFB800" />
                          <Text style={s.carRatingNumber}>4.9</Text>
                        </View>
                      </View>

                      {/* Specs Row */}
                      <View style={s.specsChipRow}>
                        <View style={s.specChip}>
                          <Gauge size={12} color="#6B7280" />
                          <Text style={s.specChipText}>{car.transmission || 'Automatic'}</Text>
                        </View>
                        <View style={s.specChip}>
                          <Fuel size={12} color="#6B7280" />
                          <Text style={s.specChipText}>{car.fuelType || 'Diesel'}</Text>
                        </View>
                        <View style={s.specChip}>
                          <Users size={12} color="#6B7280" />
                          <Text style={s.specChipText}>{car.seats || 5} Seats</Text>
                        </View>
                        <View style={s.specChip}>
                          <ShieldCheck size={12} color="#10B981" />
                          <Text style={[s.specChipText, { color: '#059669', fontWeight: '600' }]}>
                            Zero Dep
                          </Text>
                        </View>
                      </View>

                      {/* Divider */}
                      <View style={s.carCardDivider} />

                      {/* Pricing & CTA */}
                      <View style={s.carPricingRow}>
                        <View>
                          <Text style={s.priceMainText}>
                            ₹{pricePerDay.toLocaleString('en-IN')}
                            <Text style={s.priceUnitText}> /day</Text>
                          </Text>
                          <Text style={s.tripTotalText}>
                            ₹{tripTotal.toLocaleString('en-IN')} total · {days * terms.kmPerDay} km incl.
                          </Text>
                        </View>

                        <View style={s.viewDetailsBtn}>
                          <Text style={s.viewDetailsBtnText}>Book Now</Text>
                          <ArrowRight size={15} color="#FFF" />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════
            POPULAR GUJARAT ROADTRIP INSPIRATION CAROUSEL
        ══════════════════════════════════════════════════════════ */}
        <View style={s.roadtripsSection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.eyebrowText}>DESTINATIONS</Text>
              <Text style={s.sectionTitleText}>Top Gujarat Roadtrips</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/guides')}>
              <Text style={s.seeAllLink}>View Guides →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ROADTRIP_W + 16}
            decelerationRate="fast"
            contentContainerStyle={s.roadtripsScroll}
          >
            {POPULAR_ROADTRIPS.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={s.roadtripCard}
                activeOpacity={0.9}
                onPress={() => router.push('/guides')}
              >
                <Image source={trip.image} style={s.roadtripImage} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(11,3,20,0.6)', 'rgba(11,3,20,0.95)']}
                  style={s.roadtripGradient}
                />
                <View style={s.roadtripTagPill}>
                  <Text style={s.roadtripTagText}>{trip.tag}</Text>
                </View>
                <View style={s.roadtripContent}>
                  <Text style={s.roadtripTitle}>{trip.title}</Text>
                  <Text style={s.roadtripSubtitle}>{trip.subtitle}</Text>
                  <View style={s.roadtripMetaRow}>
                    <View style={s.roadtripMetaItem}>
                      <Clock size={11} color="#FFB580" />
                      <Text style={s.roadtripMetaText}>{trip.duration}</Text>
                    </View>
                    <View style={s.roadtripMetaItem}>
                      <Car size={11} color="#C4B5FD" />
                      <Text style={s.roadtripMetaText}>Best in {trip.car}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════
            HOST & EARN LUXURY BANNER
        ══════════════════════════════════════════════════════════ */}
        <View style={s.hostSection}>
          <Pressable
            onPress={() => router.push('/host')}
            style={({ pressed }) => [s.hostBannerWrap, pressed && { opacity: 0.95 }]}
          >
            <LinearGradient
              colors={['#1F0838', '#381260', '#160527']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hostBanner}
            >
              <View style={[s.orb, { width: 180, height: 180, right: -40, top: -40, backgroundColor: 'rgba(255,122,0,0.25)' }]} />
              <View style={s.hostHeaderBadge}>
                <Sparkles size={12} color="#FF7A00" />
                <Text style={s.hostHeaderBadgeText}>FOR VEHICLE OWNERS</Text>
              </View>
              <Text style={s.hostTitle}>
                Turn Your Idle Car into{'\n'}
                <Text style={{ color: '#FF7A00' }}>₹45,000+ Monthly Income.</Text>
              </Text>
              <Text style={s.hostDescription}>
                List your car on Safar Self Drive with comprehensive insurance and verified drivers.
              </Text>
              <View style={s.hostActionBtn}>
                <Text style={s.hostActionBtnText}>List Your Car Today</Text>
                <ArrowRight size={16} color="#2D114D" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ══════════════════════════════════════════════════════════
            24/7 GUJARAT CONCIERGE & HELPLINE
        ══════════════════════════════════════════════════════════ */}
        <TouchableOpacity
          style={s.helplineRow}
          onPress={() => Linking.openURL('tel:+919909031177')}
          activeOpacity={0.8}
        >
          <View style={s.helplineIconBox}>
            <Phone size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.helplineTitle}>Need Help Choosing or Custom Delivery?</Text>
            <Text style={s.helplineSub}>Call our 24x7 Gujarat Desk: +91 99090 31177</Text>
          </View>
          <ChevronRight size={18} color="#6B7280" />
        </TouchableOpacity>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          CITY & HUB SELECTOR SHEET MODAL
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setCityModalOpen(false)}>
          <View style={s.sheetContent}>
            <View style={s.sheetGrabber} />
            <View style={s.sheetTitleRow}>
              <View>
                <Text style={s.sheetMainTitle}>Select Pickup City & Hub</Text>
                <Text style={s.sheetSubTitle}>Cars available across all major Gujarat cities</Text>
              </View>
              <TouchableOpacity onPress={() => setCityModalOpen(false)} style={s.closeSheetBtn}>
                <X size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {CITIES.map((c) => {
                const isSelected = c === city;
                const hubsForCity = HUBS[c] || [];

                return (
                  <View key={c} style={s.cityGroupItem}>
                    <TouchableOpacity
                      style={[s.cityRowBtn, isSelected && s.cityRowBtnActive]}
                      onPress={() => {
                        setCity(c);
                        setHub(hubsForCity[0] || 'Main Hub');
                        setCityModalOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.cityPinBox, isSelected && s.cityPinBoxActive]}>
                        <MapPin size={16} color={isSelected ? '#FFF' : '#2D114D'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cityNameText, isSelected && s.cityNameTextActive]}>
                          {c === 'All' ? 'All Gujarat (Statewide)' : c}
                        </Text>
                        <Text style={s.cityHubsPreview} numberOfLines={1}>
                          {hubsForCity.join(' · ')}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={s.checkedCircle}>
                          <CheckCircle2 size={18} color="#2D114D" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          DATE & TIME PICKER MODALS
      ══════════════════════════════════════════════════════════ */}
      <DateTimePickerModal
        visible={startOpen}
        title="Select Pick-up Date & Time"
        selectedDate={startDate}
        selectedTime={startTime}
        onClose={() => setStartOpen(false)}
        onSelect={(d: string, t: string) => {
          setStartDate(d);
          setStartTime(t);
          setStartOpen(false);
        }}
      />

      <DateTimePickerModal
        visible={endOpen}
        title="Select Return Date & Time"
        selectedDate={endDate}
        selectedTime={endTime}
        minDate={startDate}
        onClose={() => setEndOpen(false)}
        onSelect={(d: string, t: string) => {
          setEndDate(d);
          setEndTime(t);
          setEndOpen(false);
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

  /* Hero & Ambient Background */
  hero: {
    paddingBottom: 28,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    position: 'relative',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },

  /* Navigation Bar */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  gujaratBadge: {
    backgroundColor: 'rgba(255, 122, 0, 0.25)',
    borderWidth: 1,
    borderColor: '#FF7A00',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gujaratText: {
    color: '#FFA040',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 11,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  citySelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  citySelectorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 90,
  },
  loginPill: {
    backgroundColor: '#FF7A00',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#FF7A00',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  loginPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  /* Mode Switcher Tabs */
  modeSwitcherWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C4B5FD',
  },
  modeTabTextActive: {
    color: '#240B3B',
  },
  privatePill: {
    backgroundColor: 'rgba(255, 122, 0, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  privatePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6000',
  },

  /* Hero Headings */
  heroHeadingWrap: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFA040',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  highlightText: {
    color: '#FF8A3D',
  },

  /* Trip Planner Glassmorphism Card */
  plannerCardWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  plannerGlass: {
    padding: 16,
    backgroundColor: 'rgba(28, 9, 48, 0.65)',
  },
  plannerHubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hubPinIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 122, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C4B5FD',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  plannerValueMain: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  changeHubBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  changeHubText: {
    fontSize: 11,
    color: '#FFA040',
    fontWeight: '700',
  },
  plannerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  plannerDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCell: {
    flex: 1,
  },
  dateCellMain: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  timeBadgeText: {
    fontSize: 11,
    color: '#D8B4FE',
    fontWeight: '600',
  },
  durationIndicator: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  durationLine: {
    width: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  durationPill: {
    backgroundColor: '#FF7A00',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  durationPillNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  durationPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  deliveryToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  deliveryOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deliveryOptionActive: {
    backgroundColor: 'rgba(255, 122, 0, 0.12)',
    borderColor: 'rgba(255, 122, 0, 0.35)',
  },
  deliveryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C4B5FD',
  },
  deliveryTextActive: {
    color: '#FFA040',
    fontWeight: '700',
  },
  findCarsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#FF6000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findCarsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  findCarsSub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },

  /* Trust Badges Strip */
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E9DDF7',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  /* Spotlight Showcase Section */
  spotlightSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.8,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1235',
    letterSpacing: -0.3,
  },
  viewDetailsSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewDetailsSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D114D',
  },
  spotlightCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },
  spotlightGradient: {
    padding: 18,
    borderRadius: 24,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  spotlightBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFB580',
    letterSpacing: 0.5,
  },
  spotlightModel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  spotlightRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  spotlightRatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  spotlightTripsText: {
    color: '#D8B4FE',
    fontSize: 10,
  },
  spotlightImageContainer: {
    height: 155,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  spotlightImage: {
    width: '92%',
    height: '100%',
  },
  spotlightSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 10,
  },
  spotlightSpecPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spotlightSpecText: {
    fontSize: 11,
    color: '#E9DDF7',
    fontWeight: '600',
  },
  spotlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  spotlightPricePerDay: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  spotlightPriceUnit: {
    fontSize: 12,
    color: '#C4B5FD',
    fontWeight: '600',
  },
  spotlightTotalPrice: {
    fontSize: 11,
    color: '#FFB580',
    fontWeight: '600',
  },
  spotlightCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  spotlightCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* Collections Section */
  collectionsSection: {
    marginTop: 26,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  searchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE9F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInputField: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    padding: 0,
  },
  collectionsScroll: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 4,
  },
  collectionCard: {
    width: 132,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EFEBF5',
    shadowColor: '#2D114D',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  collectionCardActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  collectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  collectionIconBoxActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  collectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  collectionTitleActive: {
    color: '#FFFFFF',
  },
  collectionSubtitle: {
    fontSize: 10,
    color: '#8A8F98',
    marginTop: 2,
  },
  collectionSubtitleActive: {
    color: '#D8B4FE',
  },

  /* Fleet Cards Feed */
  fleetSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  fleetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fleetCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  fleetSortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fleetSortText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  resetFilterBtn: {
    backgroundColor: '#2D114D',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Car Card Item */
  carCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  carCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  instantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 96, 0, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  instantTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6000',
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceTagText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  carImageWrap: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8FC',
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 16,
    position: 'relative',
  },
  carImage: {
    width: '90%',
    height: '92%',
  },
  platePill: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  platePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
  },
  carDetailsBox: {
    padding: 16,
  },
  carTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carMakeText: {
    fontSize: 11,
    color: '#8A8F98',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  carModelText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1235',
    marginTop: 1,
  },
  carRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  carRatingNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  specsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F3FA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  specChipText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  carCardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  carPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceMainText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1F1235',
  },
  priceUnitText: {
    fontSize: 12,
    color: '#8A8F98',
    fontWeight: '600',
  },
  tripTotalText: {
    fontSize: 11,
    color: '#FF6000',
    fontWeight: '700',
    marginTop: 2,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D114D',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#2D114D',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Roadtrips Carousel Section */
  roadtripsSection: {
    marginTop: 28,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D114D',
  },
  roadtripsScroll: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 4,
  },
  roadtripCard: {
    width: ROADTRIP_W,
    height: 190,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#2D114D',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  roadtripImage: {
    width: '100%',
    height: '100%',
  },
  roadtripGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  roadtripTagPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FF7A00',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roadtripTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  roadtripContent: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  roadtripTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  roadtripSubtitle: {
    fontSize: 11,
    color: '#E9DDF7',
    marginTop: 2,
  },
  roadtripMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  roadtripMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roadtripMetaText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* Host Banner */
  hostSection: {
    marginTop: 26,
    paddingHorizontal: 20,
  },
  hostBannerWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  hostBanner: {
    padding: 20,
    borderRadius: 24,
    position: 'relative',
  },
  hostHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  hostHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF7A00',
    letterSpacing: 0.8,
  },
  hostTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  hostDescription: {
    fontSize: 11,
    color: '#D8B4FE',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  hostActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hostActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* Helpline Row */
  helplineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 12,
  },
  helplineIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helplineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F1235',
  },
  helplineSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  /* City & Hub Sheet Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetMainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1235',
  },
  sheetSubTitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeSheetBtn: {
    padding: 4,
  },
  cityGroupItem: {
    marginBottom: 8,
  },
  cityRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  cityRowBtnActive: {
    backgroundColor: '#F3EEFA',
    borderColor: '#2D114D',
  },
  cityPinBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityPinBoxActive: {
    backgroundColor: '#2D114D',
  },
  cityNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  cityNameTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
  cityHubsPreview: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  checkedCircle: {
    paddingLeft: 4,
  },
});
