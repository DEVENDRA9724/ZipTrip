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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest, getVehicleImageSource, getCarDistance } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  Search,
  Star,
  ShieldCheck,
  ArrowRight,
  Car,
  Check,
  Heart,
  Navigation,
  Sparkles,
  KeyRound,
  PhoneCall,
  Compass,
  Users,
  Fuel,
  Gauge,
  CheckCircle2,
  Award,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 42) / 2;

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const POPULAR_HUBS: Record<string, string[]> = {
  Ahmedabad: [
    'Swami Vivekanand Bridge, Ashram Road',
    'SVP International Airport (T1/T2)',
    'SG Highway — Iscon Cross Road',
    'Sabarmati High-Speed Rail Hub',
  ],
  Surat: [
    'Surat Airport (STV) Terminal',
    'Vesu VIP Road Hub',
    'Adajan Riverfront Hub',
  ],
  Vadodara: [
    'Vadodara Airport (BDQ) Hub',
    'Alkapuri Railway Station Hub',
    'Sayajigunj Central Hub',
  ],
  Gandhinagar: [
    'GIFT City Tower 1 Hub',
    'Mahatma Mandir Sector 13',
    'Infocity Circle Hub',
  ],
  Rajkot: [
    'Kalawad Road Crystal Hub',
    'Hirasar International Airport',
    'Race Course Ring Road',
  ],
};

// The 2 Flagship Luxury Rental Formats (Removed Outstation & Airport; Upgraded Long Lease -> Safar Reserve)
const RENTAL_PROGRAMS = [
  {
    id: 'daily',
    eyebrow: 'CHAUFFEUR-FREE DAILY',
    title: 'Daily & Weekend Drive',
    badge: 'MOST POPULAR',
    headline: '4 Hours to 6 Days • City & Highway',
    sub: 'Flexible hourly & daily rentals with 300 km/day or Unlimited KMs.',
    perks: ['Zero Security Deposit on KYC', '100% Private White Plates'],
    sampleCar: { make: 'Hyundai', model: 'Creta SX(O)', category: 'SUV' },
    priceFrom: '₹1,499/day',
    accentColor: '#FF6000',
    badgeBg: '#FFF7ED',
    badgeBorder: '#FED7AA',
  },
  {
    id: 'subscription',
    eyebrow: 'EXTENDED PRIVATE LEASE',
    title: 'Safar Reserve™',
    badge: 'SAVE UP TO 35%',
    headline: '7 to 90 Days • All-Inclusive Subscription',
    sub: 'Bespoke multi-week & monthly car subscription with zero maintenance.',
    perks: ['Free Insurance & Servicing', 'Complimentary Car Swap'],
    sampleCar: { make: 'Mahindra', model: 'Thar 4x4', category: 'SUV' },
    priceFrom: '₹32,900/mo',
    accentColor: '#0F172A',
    badgeBg: '#F1F5F9',
    badgeBorder: '#CBD5E1',
  },
];

const BODY_STYLE_FILTERS = [
  { key: 'ALL', label: 'All Fleet' },
  { key: 'SUV', label: 'SUVs & 4x4' },
  { key: 'AUTOMATIC', label: 'Automatic' },
  { key: 'SEDAN', label: 'Executive Sedans' },
  { key: 'BUDGET', label: 'Under ₹2,500' },
];

const ROADTRIP_SPOTLIGHTS = [
  {
    id: 'sou',
    title: 'Statue of Unity Expressway',
    route: 'Ahmedabad → Kevadia (198 km)',
    tag: 'Weekend Favourite',
    car: 'Hyundai Creta / Thar 4x4',
  },
  {
    id: 'gir',
    title: 'Sasan Gir & Somnath Trail',
    route: 'Rajkot / Ahmedabad → Gir (365 km)',
    tag: 'SUV Wildlife Drive',
    car: 'Mahindra Scorpio-N / Thar',
  },
  {
    id: 'kutch',
    title: 'White Rann — Road to Heaven',
    route: 'Ahmedabad → Dholavira (400 km)',
    tag: 'Signature Expedition',
    car: 'Toyota Fortuner / Innova',
  },
];

const TRUST_PILLARS = [
  { text: 'Govt. DigiLocker KYC' },
  { text: '₹0 Security Deposit' },
  { text: 'Private White Plates' },
  { text: '8-Angle Inspection' },
  { text: '24×7 Gujarat SOS' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatShortDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('Swami Vivekanand Bridge, Ashram Road');
  const [deliveryAnywhere, setDeliveryAnywhere] = useState(true);
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');
  const [selectedTier, setSelectedTier] = useState<string>('daily');
  const [activeBodyFilter, setActiveBodyFilter] = useState<string>('ALL');
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
          const endpoint =
            city === 'All' ? '/vehicles' : `/vehicles?city=${encodeURIComponent(city)}`;
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

  // Filter fleet based on body style filter
  const fleet = useMemo(() => {
    return vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi');
      if (isTaxi) return false;

      const cat = String(v.category || '').toUpperCase();
      const trans = String(v.transmission || '').toLowerCase();
      const price = Number(v.pricePerDay || 2500);

      if (activeBodyFilter === 'SUV') {
        return (
          cat.includes('SUV') ||
          cat.includes('MUV') ||
          String(v.model || '').toLowerCase().includes('thar')
        );
      }
      if (activeBodyFilter === 'AUTOMATIC') {
        return trans.includes('auto');
      }
      if (activeBodyFilter === 'SEDAN') {
        return cat.includes('SEDAN');
      }
      if (activeBodyFilter === 'BUDGET') {
        return price <= 2500;
      }
      return true;
    });
  }, [vehicles, activeBodyFilter]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  const topPadding =
    Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

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

  const handleSelectProgram = (programId: string) => {
    setSelectedTier(programId);
    let targetEnd = endDate;
    let targetKm = kmPackage;

    if (programId === 'subscription') {
      const startD = new Date(startDate);
      const newEnd = new Date(startD.getTime() + 7 * 864e5);
      targetEnd = ymd(newEnd);
      targetKm = 'unlimited';
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
        tier: programId,
        deliveryAnywhere: String(deliveryAnywhere),
      },
    });
  };

  const cityHubs = POPULAR_HUBS[city] || POPULAR_HUBS.Ahmedabad;

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── EXECUTIVE LUXURY TOP NAVBAR ────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.brandGroup}
          activeOpacity={0.85}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <View style={s.logoFrame}>
            <Image
              source={require('../../assets/safar-logo.png')}
              style={s.brandLogo}
              resizeMode="contain"
            />
          </View>
          <View>
            <View style={s.brandTitleRow}>
              <Text style={s.brandName}>SAFAR</Text>
              <View style={s.liveDot} />
            </View>
            <Text style={s.brandTagline}>SELF DRIVE • GUJARAT</Text>
          </View>
        </TouchableOpacity>

        {/* Center/Right Interactive Location Pill + Account */}
        <View style={s.topBarRight}>
          <TouchableOpacity
            style={s.citySelectorPill}
            onPress={() => setCityModalOpen(true)}
            activeOpacity={0.8}
          >
            <MapPin size={12} color="#FF6000" strokeWidth={2.5} />
            <Text style={s.cityNameText}>{city}</Text>
            <ChevronDown size={12} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.helplineIconBtn}
            onPress={() => Linking.openURL('tel:+919909031177')}
            activeOpacity={0.8}
          >
            <PhoneCall size={14} color="#059669" />
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity
              style={s.userAvatar}
              onPress={() => router.push('/wallet')}
              activeOpacity={0.85}
            >
              <Text style={s.userInitial}>
                {(user.firstName || user.name || 'U').charAt(0).toUpperCase()}
              </Text>
              <View style={s.verifiedDot} />
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
        {/* ────────── CLEAN EDITORIAL LUXURY HERO ────────── */}
        <View style={[s.heroContainer, { backgroundColor: '#FFFFFF' }]}>
          <View style={s.heroTopRow}>
            <View style={s.heroPill}>
              <View style={s.heroLiveDot} />
              <Text style={s.heroPillText}>
                {vehicles.length || 12} VERIFIED PRIVATE CARS IN {city.toUpperCase()}
              </Text>
            </View>
            <View style={s.ratingHeroBadge}>
              <Star size={11} color="#F59E0B" fill="#F59E0B" />
              <Text style={s.ratingHeroText}>4.9★ Rated</Text>
            </View>
          </View>

          <Text style={s.heroTitle}>Drive Luxury on Your Terms.</Text>
          <Text style={s.heroSub}>
            100% private white-plate cars • Instant DigiLocker e-KYC • Zero security deposit
          </Text>

          {/* ────────── CONCIERGE BOOKING WIDGET ────────── */}
          <View style={s.searchCard}>
            {/* Location Selector */}
            <TouchableOpacity
              style={s.locationRow}
              onPress={() => setCityModalOpen(true)}
              activeOpacity={0.8}
            >
              <View style={s.locationIconBox}>
                <MapPin size={17} color="#FF6000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>PICKUP & RETURN HUB ({city.toUpperCase()})</Text>
                <Text style={s.inputValue} numberOfLines={1}>
                  {hubAddress}
                </Text>
              </View>
              <View style={s.changeCityChip}>
                <Text style={s.changeCityChipText}>Change</Text>
              </View>
            </TouchableOpacity>

            {/* Quick Hub Selector Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hubsChipRow}
            >
              {cityHubs.map((hub) => {
                const active = hubAddress === hub;
                return (
                  <TouchableOpacity
                    key={hub}
                    style={[s.hubChip, active && s.hubChipActive]}
                    onPress={() => setHubAddress(hub)}
                    activeOpacity={0.75}
                  >
                    <Navigation
                      size={10}
                      color={active ? '#FF6000' : '#64748B'}
                    />
                    <Text
                      style={[s.hubChipText, active && s.hubChipTextActive]}
                      numberOfLines={1}
                    >
                      {hub.split(',')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.divider} />

            {/* Date & Time Selector with Duration Pill */}
            <View style={s.datesContainer}>
              <TouchableOpacity
                style={s.dateCol}
                onPress={() => setStartPickerOpen(true)}
                activeOpacity={0.75}
              >
                <View style={s.dateLabelRow}>
                  <Calendar size={11} color="#64748B" />
                  <Text style={s.inputLabel}>TRIP STARTS</Text>
                </View>
                <Text style={s.dateValueText}>{formatShortDate(startDate)}</Text>
                <Text style={s.timeValueText}>{startTime}</Text>
              </TouchableOpacity>

              <View style={s.durationCenterWrap}>
                <View style={s.durationLine} />
                <View style={s.durationPill}>
                  <Text style={s.durationPillText}>
                    {days} {days === 1 ? 'Day' : 'Days'}
                  </Text>
                </View>
                <View style={s.durationLine} />
              </View>

              <TouchableOpacity
                style={[s.dateCol, { alignItems: 'flex-end' }]}
                onPress={() => setEndPickerOpen(true)}
                activeOpacity={0.75}
              >
                <View style={s.dateLabelRow}>
                  <Clock size={11} color="#64748B" />
                  <Text style={s.inputLabel}>TRIP ENDS</Text>
                </View>
                <Text style={s.dateValueText}>{formatShortDate(endDate)}</Text>
                <Text style={s.timeValueText}>{endTime}</Text>
              </TouchableOpacity>
            </View>

            {/* KM Allowance & Doorstep Row */}
            <View style={s.kmPackageRow}>
              <TouchableOpacity
                style={[s.kmSegment, kmPackage === 'standard' && s.kmSegmentActive]}
                onPress={() => setKmPackage('standard')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.kmSegmentText,
                    kmPackage === 'standard' && s.kmSegmentTextActive,
                  ]}
                >
                  300 km/day Included
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.kmSegment, kmPackage === 'unlimited' && s.kmSegmentActive]}
                onPress={() => setKmPackage('unlimited')}
                activeOpacity={0.8}
              >
                <Sparkles
                  size={12}
                  color={kmPackage === 'unlimited' ? '#FF6000' : '#64748B'}
                />
                <Text
                  style={[
                    s.kmSegmentText,
                    kmPackage === 'unlimited' && s.kmSegmentTextActive,
                  ]}
                >
                  Unlimited KMs Pass
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
              <View style={s.expressBadge}>
                <Text style={s.expressBadgeText}>EXPRESS</Text>
              </View>
            </TouchableOpacity>

            {/* Primary Search CTA */}
            <TouchableOpacity
              style={s.searchBtn}
              onPress={handleSearchCars}
              activeOpacity={0.9}
            >
              <View style={[s.searchBtnGradient, { backgroundColor: '#FF6000' }]}>
                <Search size={17} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={s.searchBtnText}>
                  Explore Available Cars ({vehicles.length || 12})
                </Text>
                <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
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
                <ShieldCheck size={13} color="#059669" />
                <Text style={s.trustText}>{item.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ────────── THE 2 FLAGSHIP RENTAL PROGRAMS ────────── */}
        <View style={s.sectionHeaderWrap}>
          <View>
            <Text style={s.sectionEyebrow}>TAILORED MOBILITY PROGRAMS</Text>
            <Text style={s.sectionTitle}>Choose Your Driving Format</Text>
          </View>
        </View>

        <View style={s.programsContainer}>
          {RENTAL_PROGRAMS.map((prog) => {
            const isSelected = selectedTier === prog.id;
            return (
              <TouchableOpacity
                key={prog.id}
                style={[s.programCard, isSelected && s.programCardActive]}
                onPress={() => handleSelectProgram(prog.id)}
                activeOpacity={0.88}
              >
                <View style={s.programTopRow}>
                  <View>
                    <Text style={s.programEyebrow}>{prog.eyebrow}</Text>
                    <Text style={s.programTitle}>{prog.title}</Text>
                  </View>
                  <View
                    style={[
                      s.programBadge,
                      {
                        backgroundColor: prog.badgeBg,
                        borderColor: prog.badgeBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[s.programBadgeText, { color: prog.accentColor }]}
                    >
                      {prog.badge}
                    </Text>
                  </View>
                </View>

                <Text style={s.programHeadline}>{prog.headline}</Text>
                <Text style={s.programSub}>{prog.sub}</Text>

                {/* Perks & Studio Car Preview Row */}
                <View style={s.programBottomSplit}>
                  <View style={s.programPerksCol}>
                    {prog.perks.map((p, i) => (
                      <View key={i} style={s.programPerkRow}>
                        <CheckCircle2 size={13} color="#059669" />
                        <Text style={s.programPerkText}>{p}</Text>
                      </View>
                    ))}
                    <View style={s.programCtaRow}>
                      <Text style={s.programPriceTag}>From {prog.priceFrom}</Text>
                      <View style={s.programArrowCircle}>
                        <ArrowRight size={13} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>

                  <View style={s.programImageBox}>
                    <Image
                      source={getVehicleImageSource(prog.sampleCar)}
                      style={s.programCarImg}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ────────── VERIFIED FLEET SHOWCASE WITH BODY FILTERS ────────── */}
        <View style={s.fleetSectionHeader}>
          <View>
            <Text style={s.sectionEyebrow}>STUDIO INSPECTED FLEET</Text>
            <Text style={s.sectionTitle}>Available Cars in {city}</Text>
          </View>

          <TouchableOpacity
            style={s.viewAllFleetBtn}
            onPress={handleSearchCars}
            activeOpacity={0.8}
          >
            <Text style={s.viewAllFleetBtnText}>See All ({vehicles.length})</Text>
            <ArrowRight size={13} color="#FF6000" />
          </TouchableOpacity>
        </View>

        {/* Body Style Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bodyFiltersScroll}
        >
          {BODY_STYLE_FILTERS.map((f) => {
            const active = activeBodyFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.bodyFilterChip, active && s.bodyFilterChipActive]}
                onPress={() => setActiveBodyFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.bodyFilterChipText,
                    active && s.bodyFilterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────── CAR GRID ────────── */}
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={s.loadingText}>Loading verified vehicles in {city}…</Text>
          </View>
        ) : fleet.length === 0 ? (
          <View style={s.emptyContainer}>
            <Car size={36} color="#94A3B8" />
            <Text style={s.emptyTitle}>No cars match this filter</Text>
            <Text style={s.emptySub}>
              Try selecting All Fleet or switching to another Gujarat hub.
            </Text>
            <TouchableOpacity
              style={s.emptyResetBtn}
              onPress={() => setActiveBodyFilter('ALL')}
            >
              <Text style={s.emptyResetText}>Show All Cars</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.carGrid}>
            {fleet.map((car) => {
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

                    {/* White Plate Tag */}
                    <View style={s.plateBadge}>
                      <Text style={s.plateBadgeText}>WHITE PLATE</Text>
                    </View>
                  </View>

                  {/* Body Content */}
                  <View style={s.carBody}>
                    <Text style={s.carMakeText}>{car.make}</Text>
                    <Text style={s.carModelText} numberOfLines={1}>
                      {car.model}
                    </Text>

                    <View style={s.carSpecsMiniRow}>
                      <Text style={s.carSpecsText} numberOfLines={1}>
                        {car.transmission || 'Manual'} • {car.fuelType || 'Petrol'} •{' '}
                        {car.seats || 5} Seats
                      </Text>
                    </View>

                    <Text style={s.carDistanceText}>📍 {dist} km from hub</Text>

                    <View style={s.cardDivider} />

                    <View style={s.pricingRow}>
                      <View>
                        <Text style={s.priceNumber}>
                          ₹{price.toLocaleString('en-IN')}
                          <Text style={s.priceUnit}>/day</Text>
                        </Text>
                        <Text style={s.totalPriceText}>
                          ₹{(price * days).toLocaleString('en-IN')} for {days}d
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

        {/* ────────── CURATED GUJARAT ROAD TRIP SPOTLIGHTS ────────── */}
        <View style={s.sectionHeaderWrap}>
          <View>
            <Text style={s.sectionEyebrow}>WEEKEND & HERITAGE DRIVES</Text>
            <Text style={s.sectionTitle}>Signature Gujarat Road Trips</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/guides', params: { section: 'guides' } })}
          >
            <Text style={s.viewAllFleetBtnText}>All Guides →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.spotlightsScroll}
        >
          {ROADTRIP_SPOTLIGHTS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={s.spotlightCard}
              onPress={() =>
                router.push({ pathname: '/guides', params: { section: 'guides' } })
              }
              activeOpacity={0.85}
            >
              <View style={s.spotlightTagPill}>
                <Compass size={11} color="#FF6000" />
                <Text style={s.spotlightTagText}>{item.tag}</Text>
              </View>
              <Text style={s.spotlightTitle}>{item.title}</Text>
              <Text style={s.spotlightRoute}>{item.route}</Text>
              <View style={s.spotlightFooter}>
                <Text style={s.spotlightCarText}>Best in: {item.car}</Text>
                <ArrowRight size={13} color="#0F172A" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ────────── SAFAR PRIVILEGE HOST BANNER ────────── */}
        <TouchableOpacity
          style={s.hostCard}
          onPress={() => router.push('/host')}
          activeOpacity={0.9}
        >
          <View style={{ flex: 1 }}>
            <View style={s.hostPill}>
              <Sparkles size={11} color="#FF6000" />
              <Text style={s.hostPillText}>SAFAR FLEET PARTNER PROGRAM</Text>
            </View>
            <Text style={s.hostTitle}>List Your Car & Earn 80% Revenue</Text>
            <Text style={s.hostSub}>
              Turn your idle car into ₹45,000+ monthly income with 8-angle handover security & comprehensive insurance.
            </Text>
          </View>
          <View style={s.hostCta}>
            <Text style={s.hostCtaText}>Host Car</Text>
            <ArrowRight size={13} color="#FFFFFF" />
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
            <Text style={s.cityDialogTitle}>Select Gujarat City Hub</Text>
            <Text style={s.cityDialogSub}>
              24×7 doorstep & hub handovers across major Gujarat cities
            </Text>
            {CITIES.map((c) => {
              const active = c === city;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.cityOption, active && s.cityOptionActive]}
                  onPress={() => {
                    setCity(c);
                    const defaultHub =
                      (POPULAR_HUBS[c] && POPULAR_HUBS[c][0]) ||
                      `${c}, Gujarat (Airport & City Hubs)`;
                    setHubAddress(defaultHub);
                    setCityModalOpen(false);
                  }}
                >
                  <MapPin size={15} color={active ? '#FF6000' : '#64748B'} />
                  <Text
                    style={[s.cityOptionText, active && s.cityOptionTextActive]}
                  >
                    {c}
                  </Text>
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
    backgroundColor: '#F8FAFC',
  },

  /* Executive Top Navbar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoFrame: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 30,
    height: 30,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandName: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  brandTagline: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.1,
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  citySelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cityNameText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  helplineIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPill: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  loginPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  userInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  scrollContent: {
    paddingBottom: 44,
  },

  /* Hero Section */
  heroContainer: {
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  heroPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.6,
  },
  ratingHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ratingHeroText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },

  /* Search Card */
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  changeCityChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeCityChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FF6000',
  },
  hubsChipRow: {
    gap: 6,
    marginTop: 10,
    paddingBottom: 2,
  },
  hubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hubChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  hubChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  hubChipTextActive: {
    color: '#C2410C',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  datesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCol: {
    flex: 1,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateValueText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 3,
  },
  timeValueText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FF6000',
    marginTop: 1,
  },
  durationCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  durationLine: {
    width: 1,
    height: 10,
    backgroundColor: '#E2E8F0',
  },
  durationPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginVertical: 2,
  },
  durationPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  kmPackageRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kmSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  kmSegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kmSegmentText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  kmSegmentTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  deliveryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  deliveryToggleLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  expressBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expressBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#059669',
  },
  searchBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  searchBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  /* Trust Ribbon */
  trustRibbon: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  trustRibbonScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  /* Section Headers */
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },

  /* The 2 Flagship Rental Programs */
  programsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  programCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  programCardActive: {
    borderColor: '#FF6000',
    borderWidth: 1.5,
  },
  programTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  programEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  programBadge: {
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  programBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  programHeadline: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    marginTop: 6,
  },
  programSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  programBottomSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  programPerksCol: {
    flex: 1,
    gap: 5,
  },
  programPerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  programPerkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  programCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  programPriceTag: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  programArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programImageBox: {
    width: 115,
    height: 72,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  programCarImg: {
    width: '94%',
    height: '94%',
  },

  /* Fleet Section */
  fleetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  viewAllFleetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllFleetBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6000',
  },
  bodyFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  bodyFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bodyFilterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  bodyFilterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  bodyFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Car Grid */
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  carCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  carPhotoCanvas: {
    height: 118,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plateBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  carBody: {
    padding: 11,
  },
  carMakeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  carModelText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  carSpecsMiniRow: {
    marginTop: 3,
  },
  carSpecsText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  carDistanceText: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  priceUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  totalPriceText: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 1,
  },
  viewDetailsBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  viewDetailsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Roadtrip Spotlights */
  spotlightsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  spotlightCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  spotlightTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  spotlightTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C2410C',
  },
  spotlightTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  spotlightRoute: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  spotlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  spotlightCarText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },

  /* Host Banner */
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginTop: 22,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  hostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255, 96, 0, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  hostPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF7A1A',
    letterSpacing: 0.7,
  },
  hostTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hostSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 16,
  },
  hostCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6000',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  hostCtaText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyResetText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* City Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cityDialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 6,
  },
  cityDialogTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  cityDialogSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 8,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  cityOptionActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  cityOptionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  cityOptionTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
});
