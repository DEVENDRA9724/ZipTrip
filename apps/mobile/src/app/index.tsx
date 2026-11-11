import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
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
  Compass,
  Check,
  Heart,
  Navigation,
  Sparkles,
  Zap,
  Tag,
  Gift,
  Building2,
  Plane,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 42) / 2;

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const BOOKING_TILES = [
  {
    id: 'daily',
    title: 'Daily Drive',
    sub: '4+ Hours',
    badge: 'Flexible KMs',
    image: require('../../assets/cars/swift.jpg'),
  },
  {
    id: 'subscription',
    title: 'SUBSCRIPTION',
    sub: '7+ days',
    badge: 'Save 25%',
    image: require('../../assets/cars/creta.jpg'),
  },
  {
    id: 'pass',
    title: 'Weekday Pass',
    sub: 'Mon to Fri',
    badge: 'Limited Kms',
    image: require('../../assets/cars/dzire.jpg'),
  },
];

const OUR_BENEFITS = [
  { icon: ShieldCheck, title: '100% Secured Trip', sub: 'Hassle Free' },
  { icon: MapPin, title: 'Doorstep Delivery', sub: 'Airport & Citywide' },
  { icon: Star, title: '25k+ Top Rated', sub: 'Cars Across Gujarat' },
  { icon: Tag, title: 'Zero Security Deposit', sub: 'On DigiLocker KYC' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatShortDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

export default function HomeScreen() {
  const { user } = require('@/context/AuthContext').useAuth();

  const [bookingMode, setBookingMode] = useState<'self' | 'taxi'>('self');
  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('Swami Vivekanand Bridge, Ahmedabad');
  const [deliveryAnywhere, setDeliveryAnywhere] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Dates
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
  const [filterQuery, setFilterQuery] = useState('');

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

  const fleet = useMemo(() => {
    return vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi');
      if (bookingMode === 'self' && isTaxi) return false;
      if (bookingMode === 'taxi' && !isTaxi) return false;

      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        const text = `${v.make} ${v.model} ${v.category} ${v.fuelType} ${v.transmission}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, bookingMode, filterQuery]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* ────────── TOP APP BAR ────────── */}
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

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ────────── TOP MINT HERO BANNER (FROM SCREENSHOT) ────────── */}
        <View style={s.heroBanner}>
          <Text style={s.heroSub}>Book Self-drive Cars Now</Text>
          <View style={s.titleDecorationRow}>
            <View style={s.titleLine} />
            <Text style={s.heroMainTitle}>Drive Daily{'\n'}Anywhere - Anytime</Text>
            <View style={s.titleLine} />
          </View>
        </View>

        {/* ────────── MAIN SEARCH & CALENDAR CARD (FROM SCREENSHOT) ────────── */}
        <View style={s.searchCard}>
          {/* Location Search Bar with GPS Icon */}
          <TouchableOpacity
            style={s.locationInputBox}
            onPress={() => setCityModalOpen(true)}
            activeOpacity={0.85}
          >
            <Search size={16} color="#4B5563" />
            <Text style={s.locationInputText} numberOfLines={1}>
              {hubAddress}
            </Text>
            <TouchableOpacity onPress={() => setCityModalOpen(true)}>
              <Navigation size={16} color="#2D114D" />
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

          {/* Delivery & Pick-up from Anywhere Checkbox */}
          <TouchableOpacity
            style={s.checkboxRow}
            onPress={() => setDeliveryAnywhere((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, deliveryAnywhere && s.checkboxActive]}>
              {deliveryAnywhere && <Check size={12} color="#FFF" strokeWidth={3} />}
            </View>
            <Text style={s.checkboxLabel}>Delivery & Pick-up, from anywhere</Text>
          </TouchableOpacity>

          {/* Big Green Search Car CTA Button */}
          <TouchableOpacity
            style={s.searchCarBtn}
            onPress={() => {
              // Filters or jumps to car feed
            }}
            activeOpacity={0.88}
          >
            <Text style={s.searchCarBtnText}>Search Car</Text>
          </TouchableOpacity>
        </View>

        {/* ────────── FLEXI PICKUP & DROP NOTICE CARD (FROM SCREENSHOT) ────────── */}
        <View style={s.flexiCard}>
          <View style={s.flexiBadge}>
            <Text style={s.flexiBadgeText}>⇄ Flexi Pickup & Drop</Text>
          </View>
          <Text style={s.flexiText}>
            Hosts can now deliver and collect the car from your chosen pickup and drop locations.
          </Text>
        </View>

        {/* ────────── 1. BOOKING TYPE TILES (DAILY DRIVE / SUBSCRIPTION / PASS) ────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionMainTitle}>Self Drive Options</Text>
        </View>

        <View style={s.bentoGrid}>
          {/* Daily Drive Big Card (Left) */}
          <TouchableOpacity
            style={s.bentoBigCard}
            onPress={() => setBookingMode('self')}
            activeOpacity={0.85}
          >
            <View style={s.bentoTag}>
              <Text style={s.bentoTagText}>DAILY DRIVE</Text>
            </View>
            <Text style={s.bentoBigTitle}>Daily Drive</Text>
            <Text style={s.bentoBigSub}>4+ Hours • Flexible KMs</Text>
            <Image
              source={BOOKING_TILES[0].image}
              style={s.bentoBigImg}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Right Stack: Subscription & Weekday Pass */}
          <View style={s.bentoRightCol}>
            <TouchableOpacity
              style={s.bentoSmallCard}
              onPress={() => setBookingMode('self')}
              activeOpacity={0.85}
            >
              <View>
                <Text style={s.bentoSmallTitle}>SUBSCRIPTION</Text>
                <Text style={s.bentoSmallSub}>7+ days • Save 25%</Text>
              </View>
              <Image
                source={BOOKING_TILES[1].image}
                style={s.bentoSmallImg}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.bentoSmallCard}
              onPress={() => setBookingMode('self')}
              activeOpacity={0.85}
            >
              <View>
                <Text style={s.bentoSmallTitle}>Weekday Pass</Text>
                <Text style={s.bentoSmallSub}>Mon to Fri • City Pass</Text>
              </View>
              <Image
                source={BOOKING_TILES[2].image}
                style={s.bentoSmallImg}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── OUR BENEFITS SECTION ────────── */}
        <View style={s.benefitsRow}>
          {OUR_BENEFITS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <View key={idx} style={s.benefitCard}>
                <Icon size={16} color="#15803D" />
                <Text style={s.benefitTitle}>{item.title}</Text>
                <Text style={s.benefitSub}>{item.sub}</Text>
              </View>
            );
          })}
        </View>

        {/* ────────── "UNMATCHED SELECTION" HEADER (EXACT FROM SCREENSHOT) ────────── */}
        <View style={s.selectionHeaderCard}>
          <Text style={s.selectionTitle}>Unmatched Selection</Text>
          <Text style={s.selectionSub}>Our Finest Cars for Your Next Adventure</Text>
          <Text style={s.selectionDates}>
            For your trip on {formatShortDate(startDate)} - {formatShortDate(endDate)} ({days} {days === 1 ? 'day' : 'days'})
          </Text>
        </View>

        {/* ────────── 2-COLUMN CAR BOX GRID (EXACT FROM SCREENSHOT) ────────── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#15803D" />
            <Text style={s.loadingText}>Loading available cars…</Text>
          </View>
        ) : fleet.length === 0 ? (
          <View style={s.emptyBox}>
            <Car size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>No cars available for selected dates</Text>
            <Text style={s.emptySub}>Try adjusting dates or city location.</Text>
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
                      <Text style={s.carBoxRatingText}>4.5★</Text>
                    </View>

                    {/* Wishlist Heart on Top-Right */}
                    <TouchableOpacity
                      style={s.carBoxHeart}
                      onPress={() => toggleFavorite(String(car.id))}
                      activeOpacity={0.8}
                    >
                      <Heart
                        size={14}
                        color={isFav ? '#DC2626' : '#FFFFFF'}
                        fill={isFav ? '#DC2626' : 'transparent'}
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

                      <View style={s.carBoxBookBtn}>
                        <Text style={s.carBoxBookText}>Book</Text>
                      </View>
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
            <ArrowRight size={14} color="#15803D" />
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
                  <MapPin size={16} color={active ? '#15803D' : '#6B7280'} />
                  <Text style={[s.cityRowText, active && s.cityRowTextActive]}>{c}</Text>
                  {active && <Check size={16} color="#15803D" />}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAF9',
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
    borderBottomColor: '#E5E7EB',
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
    color: '#1F1235',
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
    backgroundColor: '#15803D',
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
    backgroundColor: '#15803D',
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

  /* Hero Mint Banner (Matching Screenshot) */
  heroBanner: {
    backgroundColor: '#EDFAF1',
    paddingTop: 18,
    paddingBottom: 22,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  titleDecorationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  titleLine: {
    width: 36,
    height: 3,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  heroMainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#14532D',
    textAlign: 'center',
    lineHeight: 24,
  },

  /* Search Card (Exact from Screenshot) */
  searchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  locationInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
    color: '#111827',
    marginTop: 3,
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
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  searchCarBtn: {
    backgroundColor: '#15803D',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    padding: 12,
  },
  flexiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#6D28D9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  flexiBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  flexiText: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 16,
    fontWeight: '500',
  },

  /* Booking Bento Tiles */
  sectionHeader: {
    marginTop: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  bentoGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 10,
  },
  bentoBigCard: {
    flex: 1.1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-between',
    minHeight: 180,
  },
  bentoTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bentoTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#15803D',
  },
  bentoBigTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  bentoBigSub: {
    fontSize: 10,
    color: '#6B7280',
  },
  bentoBigImg: {
    width: '100%',
    height: 90,
  },
  bentoRightCol: {
    flex: 1,
    gap: 10,
  },
  bentoSmallCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bentoSmallTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  bentoSmallSub: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 1,
  },
  bentoSmallImg: {
    width: 60,
    height: 40,
  },

  /* Benefits Row */
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 8,
    marginTop: 16,
  },
  benefitCard: {
    width: (W - 40) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 3,
  },
  benefitTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  benefitSub: {
    fontSize: 9,
    color: '#6B7280',
  },

  /* Unmatched Selection Header */
  selectionHeaderCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#E8F0F8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  selectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  selectionSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  selectionDates: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },

  /* 2-Column Car Box Grid (Exact from Screenshot) */
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  carBoxImageWrap: {
    height: 115,
    backgroundColor: '#F3F4F6',
    position: 'relative',
    overflow: 'hidden',
  },
  carBoxImage: {
    width: '100%',
    height: '100%',
  },
  carBoxRating: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  carBoxRatingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  carBoxHeart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBoxBody: {
    padding: 10,
  },
  carBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  carBoxSpecs: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  carBoxDistance: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '500',
    marginTop: 4,
  },
  carBoxPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  carBoxPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  carBoxUnit: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '500',
  },
  carBoxTripTotal: {
    fontSize: 9,
    color: '#059669',
    fontWeight: '600',
  },
  carBoxBookBtn: {
    backgroundColor: '#15803D',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  carBoxBookText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Host Banner */
  hostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  hostBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  hostBannerSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  hostBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hostBannerActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  /* Empty & Loading */
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  /* City Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  citySheet: {
    width: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  citySheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityRowActive: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  cityRowText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  cityRowTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
