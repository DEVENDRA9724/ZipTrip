import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { apiRequest, getVehicleImageSource, getCarDistance } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  ArrowLeft,
  Search,
  Star,
  Heart,
  MapPin,
  Calendar,
  ShieldCheck,
  Check,
  X,
  Car as CarIcon,
  Award,
  Zap,
  ArrowUpDown,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 42) / 2;

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const FILTER_PILLS = [
  { key: 'ALL', label: 'All Fleet' },
  { key: 'SUV', label: 'SUVs & 4x4' },
  { key: 'SEDAN', label: 'Executive Sedans' },
  { key: 'AUTOMATIC', label: 'Automatic' },
  { key: 'UNLIMITED', label: 'Unlimited KMs' },
  { key: 'BUDGET', label: 'Under ₹2,500' },
];

const SORT_OPTIONS = [
  { key: 'POPULAR', label: 'Recommended' },
  { key: 'PRICE_ASC', label: 'Price: Low → High' },
  { key: 'PRICE_DESC', label: 'Price: High → Low' },
];

export default function CarListingScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    city?: string;
    hub?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    kmPackage?: 'standard' | 'unlimited';
    tier?: string;
    bodyFilter?: string;
    deliveryAnywhere?: string;
  }>();

  // Search Parameters from Home or default
  const [city, setCity] = useState(params.city || 'Ahmedabad');
  const [hubAddress, setHubAddress] = useState(params.hub || 'SVPI Airport Terminal 1, Ahmedabad');
  const [startDate, setStartDate] = useState(params.startDate || '2026-11-13');
  const [startTime, setStartTime] = useState(params.startTime || '10:00 AM');
  const [endDate, setEndDate] = useState(params.endDate || '2026-11-14');
  const [endTime, setEndTime] = useState(params.endTime || '10:00 AM');
  const [activeTier, setActiveTier] = useState<'daily' | 'lease'>(
    params.tier === 'lease' ? 'lease' : 'daily'
  );

  // Filters, Sort & Search
  const [activeFilter, setActiveFilter] = useState(params.bodyFilter || 'ALL');
  const [sortBy, setSortBy] = useState('POPULAR');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Modals
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // Fleet data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  useEffect(() => {
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
        console.error('Error fetching cars:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [city]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const days = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return activeTier === 'lease' ? 7 : 1;
    return Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate, activeTier]);

  const formatShortDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Filtered & Sorted Fleet
  const filteredCars = useMemo(() => {
    const base = vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi');
      if (isTaxi) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${v.make} ${v.model} ${v.fuelType || ''} ${v.transmission || ''}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }

      const cat = String(v.category || '').toUpperCase();
      const trans = String(v.transmission || '').toLowerCase();
      const price = Number(v.pricePerDay || 2500);

      if (activeFilter === 'SUV') {
        return cat.includes('SUV') || cat.includes('MUV') || String(v.model || '').toLowerCase().includes('thar');
      }
      if (activeFilter === 'SEDAN') {
        return cat.includes('SEDAN');
      }
      if (activeFilter === 'AUTOMATIC') {
        return trans.includes('auto');
      }
      if (activeFilter === 'BUDGET') {
        return price <= 2500;
      }
      return true;
    });

    if (sortBy === 'PRICE_ASC') {
      return [...base].sort((a, b) => Number(a.pricePerDay || 2500) - Number(b.pricePerDay || 2500));
    }
    if (sortBy === 'PRICE_DESC') {
      return [...base].sort((a, b) => Number(b.pricePerDay || 2500) - Number(a.pricePerDay || 2500));
    }
    return base;
  }, [vehicles, activeFilter, searchQuery, sortBy]);

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── TOP APP BAR ────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={19} color="#0F172A" />
        </TouchableOpacity>

        {/* Date & Location Capsule */}
        <TouchableOpacity
          style={s.searchSummaryCapsule}
          onPress={() => setStartPickerOpen(true)}
          activeOpacity={0.8}
        >
          <View style={s.capsuleTextCol}>
            <View style={s.capsuleCityRow}>
              <Text style={s.capsuleCityText}>{city}</Text>
              <Text style={s.capsuleDot}>•</Text>
              <Text style={s.capsuleDaysText}>
                {days} {days === 1 ? 'Day' : 'Days'}
              </Text>
            </View>
            <Text style={s.capsuleDatesText} numberOfLines={1}>
              {formatShortDate(startDate)} → {formatShortDate(endDate)}
            </Text>
          </View>

          <View style={s.modifyBtn}>
            <Calendar size={13} color="#0F172A" />
          </View>
        </TouchableOpacity>

        {/* City Switcher */}
        <TouchableOpacity
          style={s.cityIconBtn}
          onPress={() => setCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <MapPin size={17} color="#FF6000" />
        </TouchableOpacity>
      </View>

      {/* ────────── PROGRAM SWITCHER BAR (DAILY DRIVE vs SAFAR RESERVE™) ────────── */}
      <View style={s.programSwitchBar}>
        <TouchableOpacity
          style={[s.programTab, activeTier === 'daily' && s.programTabActive]}
          onPress={() => setActiveTier('daily')}
          activeOpacity={0.85}
        >
          <Zap size={13} color={activeTier === 'daily' ? '#FF6000' : '#64748B'} />
          <Text style={[s.programTabText, activeTier === 'daily' && s.programTabTextActive]}>
            Daily & Weekend Drive
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.programTab, activeTier === 'lease' && s.programTabActive]}
          onPress={() => {
            setActiveTier('lease');
            setEndDate('2026-11-20');
          }}
          activeOpacity={0.85}
        >
          <Award size={13} color={activeTier === 'lease' ? '#FF6000' : '#64748B'} />
          <Text style={[s.programTabText, activeTier === 'lease' && s.programTabTextActive]}>
            Safar Reserve™ (-25% Lease)
          </Text>
        </TouchableOpacity>
      </View>

      {/* ────────── SEARCH INPUT & FILTER PILLS ────────── */}
      <View style={s.filterHeaderWrap}>
        {/* Search Bar */}
        <View style={s.searchBarBox}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search Thar, Creta, Virtus, Diesel, Automatic…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Quick Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterPillsScroll}
        >
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <TouchableOpacity
                key={pill.key}
                style={[s.filterPill, active && s.filterPillActive]}
                onPress={() => setActiveFilter(pill.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ────────── RESULTS STATUS & SORT STRIP ────────── */}
      <View style={s.resultsStrip}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.resultsCountText}>
            {loading ? 'Loading fleet…' : `${filteredCars.length} Private-Plate Cars`}
          </Text>
          <View style={s.trustBadge}>
            <ShieldCheck size={11} color="#059669" />
            <Text style={s.trustBadgeText}>₹0 Deposit</Text>
          </View>
        </View>

        {/* Sort Cycle Button */}
        <TouchableOpacity
          style={s.sortCycleBtn}
          onPress={() => {
            const idx = SORT_OPTIONS.findIndex((o) => o.key === sortBy);
            const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
            setSortBy(next.key);
          }}
          activeOpacity={0.8}
        >
          <ArrowUpDown size={11} color="#0F172A" />
          <Text style={s.sortCycleText}>
            {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ────────── 2-COLUMN CAR GRID ────────── */}
      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={s.loadingText}>Loading verified Gujarat fleet…</Text>
        </View>
      ) : filteredCars.length === 0 ? (
        <View style={s.emptyContainer}>
          <CarIcon size={44} color="#CBD5E1" />
          <Text style={s.emptyTitle}>No cars match your filters</Text>
          <Text style={s.emptySub}>
            Try clearing the search query or selecting All Fleet.
          </Text>
          <TouchableOpacity
            style={s.resetFiltersBtn}
            onPress={() => {
              setActiveFilter('ALL');
              setSearchQuery('');
            }}
          >
            <Text style={s.resetFiltersBtnText}>Show All Available Cars</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.gridScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.carGrid}>
            {filteredCars.map((car) => {
              const rawPrice = Number(car.pricePerDay || 2500);
              const price = activeTier === 'lease' ? Math.round(rawPrice * 0.78) : rawPrice;
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

                    {activeTier === 'lease' && (
                      <View style={s.reserveDiscountTag}>
                        <Text style={s.reserveDiscountText}>RESERVE -22%</Text>
                      </View>
                    )}
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

                    <Text style={s.carDistanceText}>
                      📍 {dist} km • White Plate
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

                      <View style={s.bookBtn}>
                        <Text style={s.bookBtnText}>Book</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

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
                  <MapPin size={15} color={active ? '#FF6000' : '#64748B'} />
                  <Text style={[s.cityOptionText, active && s.cityOptionTextActive]}>{c}</Text>
                  {active && <Check size={16} color="#FF6000" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Pickers */}
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSummaryCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  capsuleTextCol: {
    flex: 1,
  },
  capsuleCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capsuleCityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  capsuleDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  capsuleDaysText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6000',
  },
  capsuleDatesText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  modifyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Program Switch Bar */
  programSwitchBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  programTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  programTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  programTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  programTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Filters */
  filterHeaderWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 10,
    paddingBottom: 10,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginHorizontal: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Results Strip */
  resultsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trustBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
  },
  sortCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortCycleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Grid */
  gridScrollContent: {
    paddingBottom: 40,
  },
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  carCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  carPhotoCanvas: {
    height: 115,
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
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
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
  reserveDiscountTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#059669',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reserveDiscountText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  carBody: {
    padding: 10,
  },
  carMakeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  carModelText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  carSpecsText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
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
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  priceUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  totalPriceText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  bookBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    marginHorizontal: 16,
    marginTop: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    lineHeight: 17,
  },
  resetFiltersBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  resetFiltersBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  cityDialogTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
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
    backgroundColor: '#F8FAFC',
  },
  cityOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  cityOptionTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
});
