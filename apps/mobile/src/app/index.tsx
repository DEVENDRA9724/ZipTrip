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
  Plane,
  Compass,
  KeyRound,
  FileCheck2,
  CheckCircle2,
  Repeat,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 42) / 2;

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

// Premium Luxury Rental Categories (Institutional & Clean)
const RENTAL_TIERS = [
  {
    id: 'daily',
    title: 'Daily Rental',
    badge: 'Popular',
    headline: 'City & Weekend Drive',
    sub: 'From 4 hrs to 3 days • 300 km/day included',
    perk: 'Zero Security Deposit on KYC',
    Icon: Clock,
  },
  {
    id: 'outstation',
    title: 'Outstation Roadtrip',
    badge: 'Unlimited KMs',
    headline: 'Gujarat & Interstate',
    sub: 'Somnath, Dwarka, Statue of Unity, Gir',
    perk: 'All-Gujarat FASTag Enabled',
    Icon: Compass,
  },
  {
    id: 'subscription',
    title: 'Long-Stay Lease',
    badge: 'Save 35%',
    headline: '7 to 90 Days Extended',
    sub: 'Doorstep vehicle swaps & zero maintenance',
    perk: 'VIP Dedicated Concierge',
    Icon: KeyRound,
  },
  {
    id: 'airport',
    title: 'Airport Handover',
    badge: '24x7 Express',
    headline: 'Terminal Pickup & Drop',
    sub: 'Ahmedabad (AMD) & Surat (STV) airports',
    perk: 'Live Flight Delay Tracking',
    Icon: Plane,
  },
];

// Institutional Trust Pillars
const TRUST_PILLARS = [
  { text: 'Govt. DigiLocker KYC' },
  { text: 'Zero Security Deposit' },
  { text: 'Private White Plates' },
  { text: '24x7 Roadside Assist' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatShortDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('Swami Vivekanand Bridge, Ahmedabad');
  const [deliveryAnywhere, setDeliveryAnywhere] = useState(true);
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');
  const [selectedTier, setSelectedTier] = useState<string>('daily');
  const [isSearching, setIsSearching] = useState(false);
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

  // Filter fleet based on selected tier
  const fleet = useMemo(() => {
    return vehicles.filter((v) => {
      if (selectedTier === 'outstation') {
        // High-ground-clearance tourers and SUVs for road trips
        const cat = String(v.category || '').toUpperCase();
        return cat.includes('SUV') || cat.includes('MUV') || String(v.model || '').toLowerCase().includes('thar');
      }
      if (selectedTier === 'airport') {
        // Executive Sedans & Automatics
        return String(v.transmission || '').toLowerCase().includes('auto') || String(v.category || '').toUpperCase().includes('SEDAN');
      }
      return true;
    });
  }, [vehicles, selectedTier]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  // Safe top padding guaranteeing clearance above the iPhone notch / Dynamic Island
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  // Search Car Action -> Navigates to dedicated Car Listing Page
  const handleSearchCars = () => {
    router.push({
      pathname: '/cars',
      params: {
        city,
        hub: hubAddress,
        startDate,
        endDate,
        startTime,
        endTime,
        kmPackage,
        tier: selectedTier,
        deliveryAnywhere: String(deliveryAnywhere),
      },
    });
  };

  // Select Tier Action -> Navigates to dedicated Car Listing Page with selected tier filter
  const handleSelectTier = (tierId: string) => {
    setSelectedTier(tierId);
    let targetEnd = endDate;
    let targetKm = kmPackage;

    if (tierId === 'outstation') {
      targetKm = 'unlimited';
    } else if (tierId === 'subscription') {
      const startD = new Date(startDate);
      const newEnd = new Date(startD.getTime() + 7 * 864e5);
      targetEnd = ymd(newEnd);
    }

    router.push({
      pathname: '/cars',
      params: {
        city,
        hub: hubAddress,
        startDate,
        endDate: targetEnd,
        startTime,
        endTime,
        kmPackage: targetKm,
        tier: tierId,
        deliveryAnywhere: String(deliveryAnywhere),
      },
    });
  };

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
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
              <Text style={s.loginPillText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── EDITORIAL LUXURY HERO ────────── */}
        <View style={s.heroContainer}>
          <View style={s.heroPill}>
            <Text style={s.heroPillText}>GUJARAT LUXURY MOBILITY</Text>
          </View>
          <Text style={s.heroTitle}>Your Journey. Your Rules.</Text>
          <Text style={s.heroSub}>
            Private number plate self-drive cars • Handover via Govt. DigiLocker
          </Text>
        </View>

        {/* ────────── CONCIERGE SEARCH CARD ────────── */}
        <View style={s.searchCard}>
          {/* Location Selector */}
          <TouchableOpacity
            style={s.locationRow}
            onPress={() => setCityModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={s.locationIconBox}>
              <MapPin size={16} color="#2D114D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Pickup & Return Hub</Text>
              <Text style={s.inputValue} numberOfLines={1}>
                {hubAddress}
              </Text>
            </View>
            <Navigation size={15} color="#FF6000" />
          </TouchableOpacity>

          <View style={s.divider} />

          {/* Date & Time Selector */}
          <View style={s.datesContainer}>
            <TouchableOpacity
              style={s.dateCol}
              onPress={() => setStartPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={s.inputLabel}>Trip Starts</Text>
              <Text style={s.dateValueText}>{formatShortDate(startDate)}</Text>
              <Text style={s.timeValueText}>{startTime}</Text>
            </TouchableOpacity>

            <View style={s.verticalDivider} />

            <TouchableOpacity
              style={s.dateCol}
              onPress={() => setEndPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={s.inputLabel}>Trip Ends</Text>
              <Text style={s.dateValueText}>{formatShortDate(endDate)}</Text>
              <Text style={s.timeValueText}>{endTime}</Text>
            </TouchableOpacity>
          </View>

          {/* KM Allowance Selector */}
          <View style={s.kmPackageRow}>
            <TouchableOpacity
              style={[s.kmSegment, kmPackage === 'standard' && s.kmSegmentActive]}
              onPress={() => setKmPackage('standard')}
              activeOpacity={0.8}
            >
              <Text style={[s.kmSegmentText, kmPackage === 'standard' && s.kmSegmentTextActive]}>
                300 Kms / day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.kmSegment, kmPackage === 'unlimited' && s.kmSegmentActive]}
              onPress={() => setKmPackage('unlimited')}
              activeOpacity={0.8}
            >
              <Text style={[s.kmSegmentText, kmPackage === 'unlimited' && s.kmSegmentTextActive]}>
                Unlimited Kms
              </Text>
            </TouchableOpacity>
          </View>

          {/* Doorstep Delivery Toggle */}
          <TouchableOpacity
            style={s.deliveryToggleRow}
            onPress={() => setDeliveryAnywhere((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[s.checkboxBox, deliveryAnywhere && s.checkboxBoxActive]}>
              {deliveryAnywhere && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={s.deliveryToggleLabel}>
              Doorstep delivery & collection across {city}
            </Text>
          </TouchableOpacity>

          {/* Search Button */}
          <TouchableOpacity
            style={s.searchBtn}
            onPress={handleSearchCars}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6000', '#FF7A1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.searchBtnGradient}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Search size={16} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={s.searchBtnText}>Search Available Cars</Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ────────── HORIZONTAL INSTITUTIONAL TRUST RIBBON ────────── */}
        <View style={s.trustRibbon}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.trustRibbonScroll}
          >
            {TRUST_PILLARS.map((item, idx) => (
              <View key={idx} style={s.trustItem}>
                <ShieldCheck size={13} color="#2D114D" />
                <Text style={s.trustText}>{item.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ────────── PREMIUM RENTAL TIERS ────────── */}
        <View style={s.tierSectionHeader}>
          <Text style={s.tierSectionTitle}>Curated Rental Categories</Text>
          <Text style={s.tierSectionSub}>Select a format tailored to your trip requirements</Text>
        </View>

        <View style={s.tiersGrid}>
          {RENTAL_TIERS.map((tier) => {
            const isSelected = selectedTier === tier.id;
            const Icon = tier.Icon;

            return (
              <TouchableOpacity
                key={tier.id}
                style={[s.tierCard, isSelected && s.tierCardActive]}
                onPress={() => handleSelectTier(tier.id)}
                activeOpacity={0.85}
              >
                <View style={s.tierTopRow}>
                  <View style={[s.tierIconWrap, isSelected && s.tierIconWrapActive]}>
                    <Icon size={16} color={isSelected ? '#FFFFFF' : '#2D114D'} />
                  </View>
                  <View style={[s.tierBadge, isSelected && s.tierBadgeActive]}>
                    <Text style={[s.tierBadgeText, isSelected && s.tierBadgeTextActive]}>
                      {tier.badge}
                    </Text>
                  </View>
                </View>

                <Text style={[s.tierTitle, isSelected && s.tierTitleActive]}>
                  {tier.title}
                </Text>
                <Text style={s.tierHeadline}>{tier.headline}</Text>
                <Text style={s.tierSub}>{tier.sub}</Text>

                <View style={s.tierFooter}>
                  <Text style={[s.tierPerk, isSelected && s.tierPerkActive]}>
                    ✓ {tier.perk}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ────────── VERIFIED FLEET SHOWCASE ────────── */}
        <View style={s.fleetHeaderRow}>
          <View>
            <Text style={s.fleetTitle}>Available Fleet in {city}</Text>
            <Text style={s.fleetCountSub}>
              Showing {fleet.length} verified private vehicles for your dates
            </Text>
          </View>

          <TouchableOpacity
            style={s.viewAllFleetBtn}
            onPress={handleSearchCars}
            activeOpacity={0.8}
          >
            <Text style={s.viewAllFleetBtnText}>View All ({vehicles.length})</Text>
            <ArrowRight size={12} color="#FF6000" />
          </TouchableOpacity>
        </View>

        {/* ────────── CAR GRID ────────── */}
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#2D114D" />
            <Text style={s.loadingText}>Fetching available vehicles…</Text>
          </View>
        ) : fleet.length === 0 ? (
          <View style={s.emptyContainer}>
            <Car size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>No cars currently available</Text>
            <Text style={s.emptySub}>Try switching cities or choosing another rental category.</Text>
            <TouchableOpacity
              style={s.emptyResetBtn}
              onPress={() => setSelectedTier('daily')}
            >
              <Text style={s.emptyResetText}>View All Cars</Text>
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
                  style={s.carCard}
                  onPress={() => openCar(String(car.id))}
                  activeOpacity={0.88}
                >
                  {/* Photo Canvas */}
                  <View style={s.carPhotoCanvas}>
                    <Image
                      source={getVehicleImageSource(car)}
                      style={s.carImage}
                      resizeMode="cover"
                    />

                    {/* Rating Pill */}
                    <View style={s.ratingPill}>
                      <Star size={10} color="#FBBF24" fill="#FBBF24" />
                      <Text style={s.ratingPillText}>4.9</Text>
                    </View>

                    {/* Favorite Heart */}
                    <TouchableOpacity
                      style={s.heartBtn}
                      onPress={() => toggleFavorite(String(car.id))}
                      activeOpacity={0.8}
                    >
                      <Heart
                        size={13}
                        color={isFav ? '#FF6000' : '#FFFFFF'}
                        fill={isFav ? '#FF6000' : 'transparent'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Body Content */}
                  <View style={s.carBody}>
                    <Text style={s.carMakeText}>{car.make}</Text>
                    <Text style={s.carModelText} numberOfLines={1}>
                      {car.model}
                    </Text>

                    <Text style={s.carSpecsText} numberOfLines={1}>
                      {car.fuelType || 'Petrol'} • {car.transmission || 'Manual'}
                    </Text>

                    <View style={s.cardDivider} />

                    <View style={s.pricingRow}>
                      <View>
                        <Text style={s.priceNumber}>
                          ₹{price.toLocaleString('en-IN')}
                          <Text style={s.priceUnit}>/day</Text>
                        </Text>
                        <Text style={s.totalPriceText}>
                          ₹{(price * days).toLocaleString('en-IN')} total
                        </Text>
                      </View>

                      <View style={s.viewDetailsBtn}>
                        <Text style={s.viewDetailsText}>Book</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ────────── HOSTING BANNER ────────── */}
        <TouchableOpacity
          style={s.hostCard}
          onPress={() => router.push('/host')}
          activeOpacity={0.9}
        >
          <View style={{ flex: 1 }}>
            <View style={s.hostPill}>
              <Text style={s.hostPillText}>HOST PARTNER PROGRAM</Text>
            </View>
            <Text style={s.hostTitle}>List Your Car in Gujarat</Text>
            <Text style={s.hostSub}>
              Earn ₹45,000+ monthly with complete insurance & verified guests.
            </Text>
          </View>
          <View style={s.hostCta}>
            <Text style={s.hostCtaText}>Host Now</Text>
            <ArrowRight size={13} color="#2D114D" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ────────── CITY SELECTION MODAL ────────── */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setCityModalOpen(false)}
        >
          <View style={s.cityDialog}>
            <Text style={s.cityDialogTitle}>Select Gujarat Location</Text>
            {CITIES.map((c) => {
              const active = c === city;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.cityOption, active && s.cityOptionActive]}
                  onPress={() => {
                    setCity(c);
                    setHubAddress(`${c}, Gujarat (Airport & City Hubs)`);
                    setCityModalOpen(false);
                  }}
                >
                  <MapPin size={15} color={active ? '#FF6000' : '#6B7280'} />
                  <Text style={[s.cityOptionText, active && s.cityOptionTextActive]}>{c}</Text>
                  {active && <Check size={16} color="#FF6000" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pickers */}
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
    backgroundColor: '#F7F6FA',
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
    borderBottomColor: '#EBE7F3',
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
    letterSpacing: -0.2,
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
    color: '#6B7280',
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

  /* Editorial Hero */
  heroContainer: {
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE7F3',
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  heroPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2D114D',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2D114D',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 17,
  },

  /* Search Card */
  searchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBE7F3',
    shadowColor: '#2D114D',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  locationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2D114D',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  datesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    flex: 1,
  },
  dateValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 2,
  },
  timeValueText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 1,
  },
  verticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  kmPackageRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    padding: 4,
    borderRadius: 10,
  },
  kmSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  kmSegmentActive: {
    backgroundColor: '#2D114D',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  kmSegmentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  kmSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  deliveryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  deliveryToggleLabel: {
    fontSize: 11.5,
    color: '#4B5563',
    fontWeight: '500',
  },
  searchBtn: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF6000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* Trust Ribbon */
  trustRibbon: {
    marginTop: 12,
    paddingVertical: 8,
  },
  trustRibbonScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE7F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },

  /* Curated Rental Categories */
  tierSectionHeader: {
    marginTop: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tierSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D114D',
    letterSpacing: -0.2,
  },
  tierSectionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  tiersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  tierCard: {
    width: (W - 42) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EBE7F3',
    shadowColor: '#2D114D',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  tierCardActive: {
    borderColor: '#2D114D',
    borderWidth: 1.8,
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIconWrapActive: {
    backgroundColor: '#2D114D',
  },
  tierBadge: {
    backgroundColor: '#F3EEFA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierBadgeActive: {
    backgroundColor: '#FFF1E8',
  },
  tierBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#2D114D',
  },
  tierBadgeTextActive: {
    color: '#FF6000',
  },
  tierTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#2D114D',
    marginTop: 6,
  },
  tierTitleActive: {
    color: '#2D114D',
  },
  tierHeadline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6000',
    marginTop: 1,
  },
  tierSub: {
    fontSize: 9.5,
    color: '#6B7280',
    lineHeight: 13,
    marginTop: 2,
  },
  tierFooter: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tierPerk: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  tierPerkActive: {
    color: '#2D114D',
    fontWeight: '800',
  },

  /* Fleet Header */
  fleetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  fleetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D114D',
  },
  fleetCountSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  viewAllFleetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1E8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewAllFleetBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6000',
  },
  datesBadge: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  datesBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* Car Grid */
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 6,
  },
  carCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBE7F3',
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  carPhotoCanvas: {
    height: 115,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  ratingPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(45, 17, 77, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heartBtn: {
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
  carBody: {
    padding: 10,
  },
  carMakeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  carModelText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2D114D',
    marginTop: 1,
  },
  carSpecsText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceNumber: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#2D114D',
  },
  priceUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  totalPriceText: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 1,
  },
  viewDetailsBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  viewDetailsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EBE7F3',
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
  emptyResetBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  emptyResetText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Host Card */
  hostCard: {
    marginHorizontal: 16,
    marginTop: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBE7F3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  hostPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.5,
  },
  hostTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#2D114D',
  },
  hostSub: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 14,
  },
  hostCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EEFA',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  hostCtaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
  },

  /* City Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cityDialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  cityDialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D114D',
    marginBottom: 8,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  cityOptionActive: {
    backgroundColor: '#FAF5FF',
  },
  cityOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cityOptionTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
});
