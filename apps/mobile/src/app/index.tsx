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
  Platform,
  Dimensions,
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
  Filter,
  Star,
  Shield,
  ArrowRight,
  Car,
  Compass,
  Check,
  Building2,
  Plane,
} from 'lucide-react-native';

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const CATEGORIES = [
  { key: 'All', label: 'All' },
  { key: 'SUV', label: 'SUVs & 4x4' },
  { key: 'Sedan', label: 'Sedans' },
  { key: 'Hatchback', label: 'Hatchbacks' },
  { key: '7Seater', label: '7-Seater' },
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

  const [bookingType, setBookingType] = useState<'self' | 'taxi'>('self');
  const [selectedCity, setSelectedCity] = useState('Ahmedabad');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<'hub' | 'doorstep'>('hub');

  // Vehicles
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  // Dates: Tomorrow 10 AM to Day after tomorrow 10 AM
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
          const endpoint = selectedCity === 'All' ? '/vehicles' : `/vehicles?city=${encodeURIComponent(selectedCity)}`;
          const data = await apiRequest(endpoint);
          if (alive) {
            setVehicles(Array.isArray(data) ? data : []);
          }
        } catch (e) {
          console.error('Error fetching vehicles:', e);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [selectedCity])
  );

  const totalDays = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 1;
    return Math.max(1, Math.ceil((b - a) / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  // Filtered fleet
  const filteredFleet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      const isTaxi = String(v.model || '').toLowerCase().includes('taxi') || String(v.category || '').toLowerCase().includes('taxi');
      if (bookingType === 'self' && isTaxi) return false;
      if (bookingType === 'taxi' && !isTaxi) return false;

      const cat = String(v.category || '').toLowerCase();
      const model = String(v.model || '').toLowerCase();
      const make = String(v.make || '').toLowerCase();
      const seats = Number(v.seats || 5);

      if (selectedCategory === 'SUV') {
        const isSuv = cat.includes('suv') || cat.includes('muv') || model.includes('thar') || model.includes('scorpio') || model.includes('creta');
        if (!isSuv) return false;
      } else if (selectedCategory === 'Sedan') {
        if (!cat.includes('sedan') && !model.includes('city') && !model.includes('dzire') && !model.includes('verna')) return false;
      } else if (selectedCategory === 'Hatchback') {
        if (!cat.includes('hatch') && !model.includes('swift') && !model.includes('i20') && !model.includes('baleno')) return false;
      } else if (selectedCategory === '7Seater') {
        if (seats < 7 && !cat.includes('7') && !model.includes('innova') && !model.includes('carens') && !model.includes('ertiga')) return false;
      }

      if (q && !`${make} ${model} ${cat} ${v.fuelType} ${v.transmission}`.toLowerCase().includes(q)) {
        return false;
      }

      return true;
    });
  }, [vehicles, bookingType, selectedCategory, searchQuery]);

  const openCarDetails = (id: string) => {
    router.push({
      pathname: '/details/[id]',
      params: { id, startDate, endDate, startTime, endTime, city: selectedCity },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ────────── 1. TOP HEADER (CLEAN & PROFESSIONAL) ────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/safar-logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>Safar Self Drive</Text>
            <TouchableOpacity
              style={styles.cityPickerBtn}
              onPress={() => setCityModalVisible(true)}
              activeOpacity={0.7}
            >
              <MapPin size={12} color="#FF6000" />
              <Text style={styles.cityName}>{selectedCity}</Text>
              <ChevronDown size={12} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRight}>
          {user ? (
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push('/wallet')}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarLetter}>
                {(user.firstName || user.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Log In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ────────── 2. RENTAL MODE TABS (SELF DRIVE VS CHAUFFEUR) ────────── */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, bookingType === 'self' && styles.modeTabActive]}
            onPress={() => setBookingType('self')}
            activeOpacity={0.8}
          >
            <Car size={15} color={bookingType === 'self' ? '#2D114D' : '#6B7280'} />
            <Text style={[styles.modeTabText, bookingType === 'self' && styles.modeTabTextActive]}>
              Self Drive Cars
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, bookingType === 'taxi' && styles.modeTabActive]}
            onPress={() => setBookingType('taxi')}
            activeOpacity={0.8}
          >
            <Compass size={15} color={bookingType === 'taxi' ? '#2D114D' : '#6B7280'} />
            <Text style={[styles.modeTabText, bookingType === 'taxi' && styles.modeTabTextActive]}>
              Taxi with Driver
            </Text>
          </TouchableOpacity>
        </View>

        {/* ────────── 3. TRIP DATES & LOCATION SEARCH CARD ────────── */}
        <View style={styles.searchCard}>
          {/* Pickup City & Hub */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => setCityModalVisible(true)}
            activeOpacity={0.7}
          >
            <MapPin size={18} color="#2D114D" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Pick-up Location</Text>
              <Text style={styles.fieldValueMain}>{selectedCity} (Airport & City Hubs)</Text>
            </View>
            <Text style={styles.changeActionText}>Change</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Dates Row */}
          <View style={styles.datesRow}>
            {/* Start Date */}
            <TouchableOpacity
              style={styles.dateBlock}
              onPress={() => setStartPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.fieldLabel}>TRIP START</Text>
              <Text style={styles.dateValue}>{shortDate(startDate)}</Text>
              <Text style={styles.timeValue}>{weekday(startDate)}, {startTime}</Text>
            </TouchableOpacity>

            {/* Days Duration Indicator */}
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
              <Text style={styles.durationKm}>{totalDays * 300} km</Text>
            </View>

            {/* End Date */}
            <TouchableOpacity
              style={[styles.dateBlock, { alignItems: 'flex-end' }]}
              onPress={() => setEndPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.fieldLabel}>TRIP END</Text>
              <Text style={styles.dateValue}>{shortDate(endDate)}</Text>
              <Text style={styles.timeValue}>{weekday(endDate)}, {endTime}</Text>
            </TouchableOpacity>
          </View>

          {/* Delivery Option Selection */}
          <View style={styles.deliveryRow}>
            <TouchableOpacity
              style={[styles.deliveryBtn, deliveryOption === 'hub' && styles.deliveryBtnActive]}
              onPress={() => setDeliveryOption('hub')}
              activeOpacity={0.8}
            >
              <Building2 size={13} color={deliveryOption === 'hub' ? '#2D114D' : '#6B7280'} />
              <Text style={[styles.deliveryBtnText, deliveryOption === 'hub' && styles.deliveryBtnTextActive]}>
                Pick up at Hub (Free)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deliveryBtn, deliveryOption === 'doorstep' && styles.deliveryBtnActive]}
              onPress={() => setDeliveryOption('doorstep')}
              activeOpacity={0.8}
            >
              <Plane size={13} color={deliveryOption === 'doorstep' ? '#2D114D' : '#6B7280'} />
              <Text style={[styles.deliveryBtnText, deliveryOption === 'doorstep' && styles.deliveryBtnTextActive]}>
                Airport / Doorstep Delivery
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ────────── 4. SEARCH & CATEGORY FILTER ROW ────────── */}
        <View style={styles.filterSection}>
          {/* Quick Search Field */}
          <View style={styles.searchBar}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              placeholder="Search by model (Thar, Swift, Creta...)"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const active = cat.key === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ────────── 5. VEHICLE LISTINGS FEED ────────── */}
        <View style={styles.fleetHeader}>
          <Text style={styles.fleetTitle}>
            {loading ? 'Checking availability...' : `${filteredFleet.length} Cars Available in ${selectedCity}`}
          </Text>
          <Text style={styles.fleetSub}>
            Private number plates • 300 km/day included
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2D114D" />
            <Text style={styles.loadingText}>Fetching available vehicles...</Text>
          </View>
        ) : filteredFleet.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Car size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No cars found</Text>
            <Text style={styles.emptySub}>
              Try clearing filters or selecting another city.
            </Text>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
            >
              <Text style={styles.resetBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredFleet.map((car) => {
            const terms = getVehicleTerms(car);
            const price = Number(car.pricePerDay || 2500);
            const distance = getCarDistance(car);
            const tripTotal = price * totalDays;

            return (
              <TouchableOpacity
                key={car.id}
                style={styles.carCard}
                onPress={() => openCarDetails(String(car.id))}
                activeOpacity={0.88}
              >
                {/* Image Stage */}
                <View style={styles.cardImageStage}>
                  <Image
                    source={getVehicleImageSource(car)}
                    style={styles.carImg}
                    resizeMode="contain"
                  />
                  <View style={styles.ratingBadge}>
                    <Star size={11} color="#FFB800" fill="#FFB800" />
                    <Text style={styles.ratingText}>4.9</Text>
                  </View>
                  <View style={styles.plateTag}>
                    <Text style={styles.plateTagText}>White Plate (Self Drive)</Text>
                  </View>
                </View>

                {/* Car Details */}
                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.carMake}>{car.make} · {car.year || '2024'}</Text>
                      <Text style={styles.carModel} numberOfLines={1}>{car.model}</Text>
                    </View>
                    <View style={styles.distanceBox}>
                      <MapPin size={11} color="#6B7280" />
                      <Text style={styles.distanceText}>{distance} km away</Text>
                    </View>
                  </View>

                  {/* Specs */}
                  <View style={styles.specsRow}>
                    <Text style={styles.specItem}>{car.transmission || 'Automatic'}</Text>
                    <Text style={styles.specDot}>•</Text>
                    <Text style={styles.specItem}>{car.fuelType || 'Diesel'}</Text>
                    <Text style={styles.specDot}>•</Text>
                    <Text style={styles.specItem}>{car.seats || 5} Seats</Text>
                    <Text style={styles.specDot}>•</Text>
                    <Text style={[styles.specItem, { color: '#059669', fontWeight: '700' }]}>Zero Dep</Text>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Pricing and Book Button */}
                  <View style={styles.pricingRow}>
                    <View>
                      <Text style={styles.dailyPrice}>
                        ₹{price.toLocaleString('en-IN')}
                        <Text style={styles.dailyPriceUnit}> /day</Text>
                      </Text>
                      <Text style={styles.totalPrice}>
                        ₹{tripTotal.toLocaleString('en-IN')} for {totalDays} {totalDays === 1 ? 'day' : 'days'}
                      </Text>
                    </View>

                    <View style={styles.bookBtn}>
                      <Text style={styles.bookBtnText}>Book Now</Text>
                      <ArrowRight size={14} color="#FFF" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ────────── 6. HOST CALLOUT CARD ────────── */}
        <TouchableOpacity
          style={styles.hostCard}
          onPress={() => router.push('/host')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.hostCardTitle}>Have a car in Gujarat?</Text>
            <Text style={styles.hostCardSub}>
              Earn up to ₹45,000/month by listing your car on Safar with full insurance coverage.
            </Text>
          </View>
          <View style={styles.hostCardBtn}>
            <Text style={styles.hostCardBtnText}>Host & Earn</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ────────── CITY SELECTOR MODAL ────────── */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCityModalVisible(false)}
        >
          <View style={styles.citySheet}>
            <Text style={styles.citySheetTitle}>Select City in Gujarat</Text>
            {CITIES.map((c) => {
              const active = c === selectedCity;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.cityItem, active && styles.cityItemActive]}
                  onPress={() => {
                    setSelectedCity(c);
                    setCityModalVisible(false);
                  }}
                >
                  <MapPin size={16} color={active ? '#FF6000' : '#6B7280'} />
                  <Text style={[styles.cityItemText, active && styles.cityItemTextActive]}>{c}</Text>
                  {active && <Check size={16} color="#FF6000" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date & Time Picker Modals */}
      <DateTimePickerModal
        visible={startPickerVisible}
        title="Select Pick-up Date & Time"
        selectedDate={startDate}
        selectedTime={startTime}
        onClose={() => setStartPickerVisible(false)}
        onSelect={(d, t) => {
          setStartDate(d);
          setStartTime(t);
          setStartPickerVisible(false);
        }}
      />

      <DateTimePickerModal
        visible={endPickerVisible}
        title="Select Return Date & Time"
        selectedDate={endDate}
        selectedTime={endTime}
        minDate={startDate}
        onClose={() => setEndPickerVisible(false)}
        onSelect={(d, t) => {
          setEndDate(d);
          setEndTime(t);
          setEndPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
  },
  cityPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  cityName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  headerRight: {},
  loginBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2D114D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  scrollContent: {
    paddingBottom: 36,
  },

  /* Mode Tabs */
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeTabTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },

  /* Search Card */
  searchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fieldValueMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1235',
    marginTop: 1,
  },
  changeActionText: {
    fontSize: 12,
    color: '#FF6000',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dateBlock: {
    flex: 1,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 2,
  },
  timeValue: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  durationPill: {
    backgroundColor: '#F3EEFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
  },
  durationKm: {
    fontSize: 9,
    color: '#6B7280',
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  deliveryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deliveryBtnActive: {
    backgroundColor: '#F3EEFA',
    borderColor: '#2D114D',
  },
  deliveryBtnText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  deliveryBtnTextActive: {
    color: '#2D114D',
    fontWeight: '700',
  },

  /* Filter Section */
  filterSection: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F1235',
    padding: 0,
  },
  categoryScroll: {
    gap: 8,
    marginTop: 10,
    paddingBottom: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Fleet Feed */
  fleetHeader: {
    marginTop: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  fleetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
  },
  fleetSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  carCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardImageStage: {
    height: 160,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  carImg: {
    width: '85%',
    height: '85%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1F1235',
  },
  plateTag: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  plateTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
  },
  cardBody: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carMake: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  carModel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 1,
  },
  distanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    color: '#6B7280',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  specItem: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  specDot: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1F1235',
  },
  dailyPriceUnit: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  totalPrice: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D114D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Host Callout Card */
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  hostCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1235',
  },
  hostCardSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  hostCardBtn: {
    backgroundColor: '#F3EEFA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  hostCardBtnText: {
    color: '#2D114D',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Empty & Loading */
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1235',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 12,
  },
  resetBtn: {
    backgroundColor: '#2D114D',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* City Sheet Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  citySheet: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  citySheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1235',
    marginBottom: 12,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityItemActive: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  cityItemText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  cityItemTextActive: {
    color: '#FF6000',
    fontWeight: '800',
  },
});
