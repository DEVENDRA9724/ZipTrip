import React, { useState, useEffect, useMemo } from 'react';
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
import { apiRequest, getVehicleImageSource, getCarDistance } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  MapPin,
  ChevronDown,
  Search,
  Star,
  ShieldCheck,
  Car,
  Heart,
  ArrowRight,
  Check,
  Award,
  Zap,
  Calendar,
  User,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const POPULAR_HUBS: Record<string, string[]> = {
  Ahmedabad: [
    'SVP International Airport (T1)',
    'SG Highway Hub, Prahlad Nagar',
    'Swami Vivekanand Bridge, Riverfront',
    'Sabarmati Bullet Train Hub',
  ],
  Surat: [
    'Surat International Airport (STV)',
    'Vesu VIP Road Executive Hub',
    'Adajan Riverfront Hub',
  ],
  Vadodara: [
    'Vadodara Airport (BDQ)',
    'Alkapuri Railway Station Hub',
  ],
  Gandhinagar: [
    'GIFT City Tower 1 Hub',
    'Mahatma Mandir Sector 13',
  ],
  Rajkot: [
    'Hirasar International Airport',
    'Kalawad Road Crystal Hub',
  ],
};

const QUICK_CATEGORIES = [
  { key: 'ALL', label: 'All Cars' },
  { key: 'SUV', label: 'SUVs' },
  { key: 'AUTOMATIC', label: 'Automatic' },
  { key: 'SEDAN', label: 'Sedans' },
  { key: 'BUDGET', label: 'Under ₹2,500' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();

  // Search state
  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('SVP International Airport (T1)');
  const [startDate, setStartDate] = useState('2026-11-13');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState('2026-11-14');
  const [endTime, setEndTime] = useState('10:00 AM');
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');
  const [activeTier, setActiveTier] = useState<'daily' | 'lease'>('daily');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // Fleet data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const favs = await apiRequest('/favorites');
          if (alive && Array.isArray(favs)) {
            const map: Record<string, boolean> = {};
            favs.forEach((f: any) => {
              if (f.vehicleId) map[String(f.vehicleId)] = true;
            });
            setFavorites(map);
          }
        } catch {
          // Guest
        }
      })();
      return () => {
        alive = false;
      };
    }, [user])
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const endpoint = city === 'All' ? '/vehicles' : `/vehicles?city=${encodeURIComponent(city)}`;
        const data = await apiRequest(endpoint);
        if (alive) {
          const clean = (Array.isArray(data) ? data : []).filter(
            (v: any) => !String(v.model || '').toLowerCase().includes('taxi')
          );
          setVehicles(clean);
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
  }, [city]);

  const toggleFavorite = async (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!user) return;
    try {
      await apiRequest('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ vehicleId: id }),
      });
    } catch {
      // ignore
    }
  };

  const days = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 1;
    return Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate]);

  const formatShortDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime())
      ? s
      : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

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
        tier: activeTier,
        bodyFilter: selectedCategory,
      },
    });
  };

  const openCar = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, hub: hubAddress, city },
    });
  };

  const displayedVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const cat = String(v.category || '').toUpperCase();
      const trans = String(v.transmission || '').toLowerCase();
      const price = Number(v.pricePerDay || 2500);
      if (selectedCategory === 'SUV') return cat.includes('SUV') || cat.includes('MUV');
      if (selectedCategory === 'AUTOMATIC') return trans.includes('auto');
      if (selectedCategory === 'SEDAN') return cat.includes('SEDAN');
      if (selectedCategory === 'BUDGET') return price <= 2500;
      return true;
    });
  }, [vehicles, selectedCategory]);

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 50) : Math.max(insets.top, 20);

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── MINIMALIST HEADER (NO OVERFLOW) ────────── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.brandLocationBtn}
          onPress={() => setCityModalOpen(true)}
          activeOpacity={0.75}
        >
          <View style={s.logoBox}>
            <Image
              source={require('../../assets/images/safar-logo.jpeg')}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={s.brandTitle}>Safar</Text>
            <View style={s.citySelectorRow}>
              <MapPin size={11} color="#FF6000" />
              <Text style={s.cityText}>{city}</Text>
              <ChevronDown size={12} color="#64748B" />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.accountBtn}
          onPress={() => router.push(user ? '/wallet' : '/auth/login')}
          activeOpacity={0.8}
        >
          {user ? (
            <View style={s.userAvatar}>
              <Text style={s.userAvatarText}>
                {(user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={s.signInChip}>
              <User size={14} color="#0F172A" />
              <Text style={s.signInChipText}>Sign In</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── CLEAN GREETING & SEARCH CARD ────────── */}
        <View style={s.heroSection}>
          <Text style={s.heroHeading}>Find your next drive</Text>
          <Text style={s.heroSubheading}>
            Private white-plate cars in {city} • ₹0 security deposit
          </Text>

          {/* Clean Light Search Card */}
          <View style={s.searchCard}>
            {/* 1. Location Selector */}
            <TouchableOpacity
              style={s.locationInputRow}
              onPress={() => setCityModalOpen(true)}
              activeOpacity={0.75}
            >
              <View style={s.iconCircle}>
                <MapPin size={16} color="#FF6000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Pickup & Return Hub</Text>
                <Text style={s.inputValue} numberOfLines={1}>
                  {hubAddress}
                </Text>
              </View>
              <Text style={s.changeLink}>Change</Text>
            </TouchableOpacity>

            <View style={s.divider} />

            {/* 2. Dates Row */}
            <View style={s.datesRow}>
              <TouchableOpacity
                style={s.dateCol}
                onPress={() => setStartPickerOpen(true)}
                activeOpacity={0.75}
              >
                <View style={s.dateLabelRow}>
                  <Calendar size={12} color="#64748B" />
                  <Text style={s.inputLabel}>Pick-up</Text>
                </View>
                <Text style={s.dateValue}>{formatShortDate(startDate)}</Text>
                <Text style={s.timeValue}>{startTime}</Text>
              </TouchableOpacity>

              <View style={s.durationPill}>
                <Text style={s.durationPillText}>
                  {days} {days === 1 ? 'Day' : 'Days'}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.dateCol, { alignItems: 'flex-end' }]}
                onPress={() => setEndPickerOpen(true)}
                activeOpacity={0.75}
              >
                <View style={s.dateLabelRow}>
                  <Calendar size={12} color="#64748B" />
                  <Text style={s.inputLabel}>Return</Text>
                </View>
                <Text style={s.dateValue}>{formatShortDate(endDate)}</Text>
                <Text style={s.timeValue}>{endTime}</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Simple KM Toggle */}
            <View style={s.kmSegment}>
              <TouchableOpacity
                style={[s.kmOption, kmPackage === 'standard' && s.kmOptionActive]}
                onPress={() => setKmPackage('standard')}
                activeOpacity={0.8}
              >
                <Text style={[s.kmOptionText, kmPackage === 'standard' && s.kmOptionTextActive]}>
                  300 km/day
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.kmOption, kmPackage === 'unlimited' && s.kmOptionActive]}
                onPress={() => setKmPackage('unlimited')}
                activeOpacity={0.8}
              >
                <Text style={[s.kmOptionText, kmPackage === 'unlimited' && s.kmOptionTextActive]}>
                  Unlimited KMs
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4. Primary Search Button */}
            <TouchableOpacity
              style={s.searchButton}
              onPress={handleSearchCars}
              activeOpacity={0.88}
            >
              <Search size={17} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={s.searchButtonText}>Search Cars</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 2 COMPACT RENTAL PROGRAMS (SIDE BY SIDE) ────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Driving Programs</Text>
          <View style={s.programsRow}>
            {/* Program 1: Daily & Weekend Drive */}
            <TouchableOpacity
              style={[s.programCard, activeTier === 'daily' && s.programCardActive]}
              onPress={() => {
                setActiveTier('daily');
                router.push({
                  pathname: '/cars',
                  params: { city, hub: hubAddress, startDate, endDate, tier: 'daily' },
                });
              }}
              activeOpacity={0.85}
            >
              <View style={s.programTopRow}>
                <View style={[s.programIconWrap, { backgroundColor: '#FFF7ED' }]}>
                  <Zap size={16} color="#FF6000" />
                </View>
                <View style={s.programTag}>
                  <Text style={s.programTagText}>1–6 DAYS</Text>
                </View>
              </View>
              <Text style={s.programName}>Daily Drive</Text>
              <Text style={s.programDesc}>Hourly & weekend self-drive rentals</Text>
            </TouchableOpacity>

            {/* Program 2: Safar Reserve™ (Extended Lease) */}
            <TouchableOpacity
              style={[s.programCard, activeTier === 'lease' && s.programCardActive]}
              onPress={() => {
                setActiveTier('lease');
                router.push({
                  pathname: '/cars',
                  params: { city, hub: hubAddress, startDate, endDate: '2026-11-20', tier: 'lease' },
                });
              }}
              activeOpacity={0.85}
            >
              <View style={s.programTopRow}>
                <View style={[s.programIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <Award size={16} color="#059669" />
                </View>
                <View style={[s.programTag, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={[s.programTagText, { color: '#059669' }]}>SAVE 35%</Text>
                </View>
              </View>
              <Text style={s.programName}>Safar Reserve™</Text>
              <Text style={s.programDesc}>7 to 90 days all-inclusive lease</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── AVAILABLE CARS SECTION ────────── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Available in {city}</Text>
            <TouchableOpacity onPress={handleSearchCars} style={s.seeAllBtn}>
              <Text style={s.seeAllText}>See all</Text>
              <ArrowRight size={14} color="#FF6000" />
            </TouchableOpacity>
          </View>

          {/* Clean Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoriesScroll}
          >
            {QUICK_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.categoryPill, active && s.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.categoryPillText, active && s.categoryPillTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="small" color="#0F172A" />
              <Text style={s.loadingText}>Loading cars…</Text>
            </View>
          ) : displayedVehicles.length === 0 ? (
            <View style={s.emptyBox}>
              <Car size={32} color="#CBD5E1" />
              <Text style={s.emptyText}>No cars found in this category.</Text>
              <TouchableOpacity onPress={() => setSelectedCategory('ALL')}>
                <Text style={s.resetLink}>Show all cars</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.carsList}>
              {displayedVehicles.slice(0, 6).map((car) => {
                const price = Number(car.pricePerDay || 2500);
                const isFav = !!favorites[car.id];
                const dist = getCarDistance(car);

                return (
                  <TouchableOpacity
                    key={car.id}
                    style={s.carCard}
                    onPress={() => openCar(String(car.id))}
                    activeOpacity={0.9}
                  >
                    <View style={s.carImageWrap}>
                      <Image
                        source={getVehicleImageSource(car)}
                        style={s.carImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={s.favBtn}
                        onPress={() => toggleFavorite(String(car.id))}
                        activeOpacity={0.8}
                      >
                        <Heart
                          size={15}
                          color={isFav ? '#FF6000' : '#0F172A'}
                          fill={isFav ? '#FF6000' : 'transparent'}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={s.carCardBody}>
                      <View style={s.carCardTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.carTitle} numberOfLines={1}>
                            {car.make} {car.model}
                          </Text>
                          <Text style={s.carMeta}>
                            {car.transmission || 'Automatic'} • {car.fuelType || 'Petrol'} • {car.seats || 5} Seats
                          </Text>
                        </View>
                        <View style={s.ratingRow}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <Text style={s.ratingText}>4.9</Text>
                        </View>
                      </View>

                      <View style={s.carCardFooter}>
                        <Text style={s.distanceText}>📍 {dist} km away</Text>
                        <Text style={s.priceText}>
                          ₹{price.toLocaleString('en-IN')}
                          <Text style={s.priceSub}> / day</Text>
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ────────── MINIMAL TRUST SUMMARY ────────── */}
        <View style={s.trustCard}>
          <View style={s.trustItem}>
            <ShieldCheck size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={s.trustTitle}>Zero Security Deposit</Text>
              <Text style={s.trustSub}>Instant verification via DigiLocker in Account</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ────────── CITY & HUB SELECTION MODAL ────────── */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setCityModalOpen(false)}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select City & Pickup Hub</Text>

            <View style={s.cityPillsWrap}>
              {CITIES.map((c) => {
                const active = c === city;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[s.cityModalPill, active && s.cityModalPillActive]}
                    onPress={() => {
                      setCity(c);
                      const firstHub = (POPULAR_HUBS[c] || [])[0] || `${c} Main Hub`;
                      setHubAddress(firstHub);
                    }}
                  >
                    <Text style={[s.cityModalPillText, active && s.cityModalPillTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.hubListLabel}>Pickup Hubs in {city}</Text>
            {(POPULAR_HUBS[city] || POPULAR_HUBS.Ahmedabad).map((hub) => {
              const selected = hubAddress === hub;
              return (
                <TouchableOpacity
                  key={hub}
                  style={[s.hubOption, selected && s.hubOptionSelected]}
                  onPress={() => {
                    setHubAddress(hub);
                    setCityModalOpen(false);
                  }}
                >
                  <MapPin size={15} color={selected ? '#FF6000' : '#64748B'} />
                  <Text style={[s.hubOptionText, selected && s.hubOptionTextSelected]}>
                    {hub}
                  </Text>
                  {selected && <Check size={16} color="#FF6000" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Pickers */}
      <DateTimePickerModal
        visible={startPickerOpen}
        title="Pick-up Date & Time"
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
        title="Return Date & Time"
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
    backgroundColor: '#FFFFFF',
  },

  /* Minimal Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  citySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  cityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  accountBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  signInChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signInChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  scrollContent: {
    paddingBottom: 32,
  },

  /* Hero & Search Card */
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  heroSubheading: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  changeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  datesRow: {
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
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3,
  },
  timeValue: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  durationPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  kmSegment: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  kmOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  kmOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  kmOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  kmOptionTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 14,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6000',
  },

  /* 2 Side-by-Side Programs */
  programsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  programCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  programCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
  },
  programTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  programIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programTag: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  programTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#EA580C',
  },
  programName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  programDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },

  /* Categories Scroll */
  categoriesScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Clean Car Cards */
  carsList: {
    gap: 14,
  },
  carCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  carImageWrap: {
    height: 175,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  favBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carCardBody: {
    padding: 14,
  },
  carCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  carMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  carCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  distanceText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },

  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6000',
    marginTop: 4,
  },

  /* Minimal Trust Card */
  trustCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trustTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  trustSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },

  /* City Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  cityPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  cityModalPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityModalPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  cityModalPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  cityModalPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hubListLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  hubOptionSelected: {
    backgroundColor: '#FFF7ED',
  },
  hubOptionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: '#334155',
  },
  hubOptionTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
