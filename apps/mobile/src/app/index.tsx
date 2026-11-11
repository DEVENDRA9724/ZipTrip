import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  apiRequest,
  getVehicleImageSource,
  getCarDistance,
  getVehicleTerms,
} from '@/services/api';
import { SafarHeader } from '@/components/safar-header';
import {
  Search,
  MapPin,
  Calendar,
  Star,
  SlidersHorizontal,
  ShieldCheck,
  Gauge,
  Fuel,
  Users,
  CheckCircle2,
  X,
  RotateCcw,
} from 'lucide-react-native';

const CITIES = ['All', 'Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const QUICK_CHIPS = [
  { id: 'all', label: 'All Verified Cars' },
  { id: 'suv', label: 'SUV & 4×4' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'hatchback', label: 'Hatchback' },
  { id: 'auto', label: 'Automatic' },
  { id: 'diesel', label: 'Diesel' },
  { id: '7seat', label: '6/7 Seater' },
  { id: 'near', label: 'Within 5 km' },
  { id: 'new', label: 'Model 2023+' },
];

const BRANDS = ['All Brands', 'Mahindra', 'Toyota', 'Hyundai', 'Maruti Suzuki', 'BMW', 'Honda', 'Kia'];

const HUB_ADDRESSES: Record<string, string> = {
  Ahmedabad: 'SG Highway, Bodakdev, Ahmedabad, Gujarat 380054',
  Gandhinagar: 'Infocity Circle, Gandhinagar, Gujarat 382007',
  Surat: 'Dumas Road, Vesu, Surat, Gujarat 395007',
  Vadodara: 'RC Dutt Road, Alkapuri, Vadodara, Gujarat 390007',
  Rajkot: 'Kalawad Road, Rajkot, Gujarat 360005',
};

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ExploreCarsScreen() {
  const [selectedCity, setSelectedCity] = useState('All');
  const [activeChip, setActiveChip] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [kmPlan, setKmPlan] = useState<'300' | 'unlimited'>('300');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced Filter Modal State (matching website left sidebar)
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedTransmission, setSelectedTransmission] = useState<'All' | 'Automatic' | 'Manual'>('All');
  const [selectedFuel, setSelectedFuel] = useState<'All' | 'Petrol' | 'Diesel'>('All');
  const [maxBudget, setMaxBudget] = useState<number>(15000);

  // Date booking states
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => dateInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000)));

  useFocusEffect(
    React.useCallback(() => {
      fetchVehicles();
    }, [selectedCity])
  );

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const endpoint =
        selectedCity === 'All'
          ? '/vehicles'
          : `/vehicles?city=${encodeURIComponent(selectedCity)}`;
      const data = await apiRequest(endpoint);
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetAllFilters = () => {
    setSelectedCity('All');
    setActiveChip('all');
    setSearchQuery('');
    setSelectedBrand('All Brands');
    setSelectedTransmission('All');
    setSelectedFuel('All');
    setMaxBudget(15000);
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Remove legacy taxi records if any so only pure self-drive fleet shows
      if (String(v.model || '').toLowerCase().includes('taxi')) return false;

      const text = `${v.make || ''} ${v.model || ''} ${v.category || ''} ${v.locationCity || ''} ${v.transmission || ''} ${v.fuelType || ''}`.toLowerCase();
      if (searchQuery.trim() && !text.includes(searchQuery.trim().toLowerCase())) {
        return false;
      }

      if (selectedBrand !== 'All Brands' && !String(v.make || '').toLowerCase().includes(selectedBrand.toLowerCase())) {
        return false;
      }

      if (selectedTransmission !== 'All' && String(v.transmission || '').toLowerCase() !== selectedTransmission.toLowerCase()) {
        return false;
      }

      if (selectedFuel !== 'All' && String(v.fuelType || '').toLowerCase() !== selectedFuel.toLowerCase()) {
        return false;
      }

      if (Number(v.pricePerDay || 0) > maxBudget) {
        return false;
      }

      // Quick Chip Filters
      const cat = String(v.category || '').toLowerCase();
      const trans = String(v.transmission || '').toLowerCase();
      const fuel = String(v.fuelType || '').toLowerCase();
      const seats = Number(v.seats || 5);
      const year = Number(v.year || 2024);
      const dist = getCarDistance(v);

      if (activeChip === 'suv' && !cat.includes('suv') && !cat.includes('muv') && !text.includes('thar')) return false;
      if (activeChip === 'sedan' && !cat.includes('sedan') && !cat.includes('luxury')) return false;
      if (activeChip === 'hatchback' && !cat.includes('hatchback')) return false;
      if (activeChip === 'auto' && !trans.includes('auto')) return false;
      if (activeChip === 'diesel' && !fuel.includes('diesel')) return false;
      if (activeChip === '7seat' && seats < 6) return false;
      if (activeChip === 'near' && dist > 5.0) return false;
      if (activeChip === 'new' && year < 2023) return false;

      return true;
    });
  }, [vehicles, searchQuery, selectedBrand, selectedTransmission, selectedFuel, maxBudget, activeChip]);

  const getAverageRating = (reviews: any[]) => {
    if (!reviews || reviews.length === 0) return null;
    const sum = reviews.reduce((acc, curr) => acc + Number(curr.rating || 5), 0);
    return (sum / reviews.length).toFixed(1);
  };

  const renderVehicleCard = ({ item }: { item: any }) => {
    const rating = getAverageRating(item.reviews);
    const distance = getCarDistance(item);
    const terms = getVehicleTerms(item);
    const baseRate = Number(item.pricePerDay || 2500);
    const displayRate = kmPlan === 'unlimited' ? Math.round(baseRate * 1.25) : baseRate;
    const hubAddress =
      item.pickupAddress ||
      HUB_ADDRESSES[item.locationCity] ||
      `${item.locationCity || 'Ahmedabad'}, Gujarat`;

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/details/[id]',
            params: { id: String(item.id), startDate, endDate },
          })
        }
      >
        {/* Studio Car Image Stage */}
        <View style={styles.imageStage}>
          <Image
            source={getVehicleImageSource(item)}
            style={styles.carStudioImage}
            resizeMode="cover"
          />

          {/* Top-Left Verified Listing Pill (Matches Website) */}
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={13} color="#0D9488" strokeWidth={2.5} />
            <Text style={styles.verifiedBadgeText}>Verified Listing</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.carTitle} numberOfLines={1}>
                {item.make} {item.model}
              </Text>
              <Text style={styles.carSubMeta}>
                {item.year || 2024} • {item.category || 'SUV'}
              </Text>
            </View>
            {rating ? (
              <View style={styles.ratingPill}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.ratingPillText}>{rating}</Text>
              </View>
            ) : (
              <Text style={styles.newListingTag}>New listing</Text>
            )}
          </View>

          {/* Clean Spec Row (Vector Icons - Zero Emojis) */}
          <View style={styles.specRow}>
            <View style={styles.specItem}>
              <Gauge size={13} color="#475569" />
              <Text style={styles.specText}>{item.transmission || 'Automatic'}</Text>
            </View>
            <View style={styles.specItem}>
              <Fuel size={13} color="#475569" />
              <Text style={styles.specText}>{item.fuelType || 'Petrol'}</Text>
            </View>
            <View style={styles.specItem}>
              <Users size={13} color="#475569" />
              <Text style={styles.specText}>{item.seats || 5} Seats</Text>
            </View>
          </View>

          {/* Hub Address & Distance */}
          <View style={styles.locationRow}>
            <MapPin size={14} color="#64748B" style={{ marginTop: 2 }} />
            <Text style={styles.locationText} numberOfLines={2}>
              {hubAddress} • <Text style={styles.distanceBold}>{distance} km away</Text>
            </Text>
          </View>

          {/* Available Status */}
          <View style={styles.availableRow}>
            <CheckCircle2 size={13} color="#0D9488" />
            <Text style={styles.availableText}>Available for selected dates</Text>
          </View>

          <View style={styles.divider} />

          {/* Price & CTA Footer */}
          <View style={styles.priceFooter}>
            <View>
              <View style={styles.priceLine}>
                <Text style={styles.priceAmount}>
                  ₹{displayRate.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.pricePerDay}> / day</Text>
              </View>
              <Text style={styles.kmTermsText}>
                {kmPlan === 'unlimited'
                  ? 'Unlimited kms incl. • Fastag active'
                  : `${terms.kmPerDay} km/day incl. • ₹${terms.excessKmRate}/km extra`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.viewDetailsBtn}
            onPress={() =>
              router.push({
                pathname: '/details/[id]',
                params: { id: String(item.id), startDate, endDate },
              })
            }
          >
            <Text style={styles.viewDetailsBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.listHeaderWrap}>
      {/* Website Promo Banner */}
      <View style={styles.promoBanner}>
        <View style={styles.promoTopRow}>
          <Text style={styles.promoEyebrow}>BOOK VERIFIED SELF-DRIVE CARS</Text>
          <View style={styles.verifiedFleetPill}>
            <ShieldCheck size={12} color="#0D9488" strokeWidth={2.5} />
            <Text style={styles.verifiedFleetPillText}>100% Verified Fleet</Text>
          </View>
        </View>
        <Text style={styles.promoHeadline}>Drive Daily Anywhere — Anytime</Text>
      </View>

      {/* Trip Schedule & Pickup Hub Card */}
      <View style={styles.scheduleCard}>
        <View style={styles.scheduleHeaderRow}>
          <View>
            <Text style={styles.scheduleTitle}>Trip Schedule & Pickup Hub</Text>
            <Text style={styles.scheduleSub}>
              Transparent Pricing • Digital Lease Agreement • Verified Handover
            </Text>
          </View>
        </View>

        {/* City Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityTabsRow}
        >
          {CITIES.map((city) => {
            const active = selectedCity === city;
            return (
              <TouchableOpacity
                key={city}
                style={[styles.cityTab, active && styles.cityTabActive]}
                onPress={() => setSelectedCity(city)}
              >
                <Text style={[styles.cityTabText, active && styles.cityTabTextActive]}>
                  {city === 'All' ? 'All Cities (Gujarat)' : city}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Pick-up & Drop-off Date Row */}
        <View style={styles.dateRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateBoxLabel}>PICK-UP DATE</Text>
            <View style={styles.dateInputRow}>
              <Calendar size={14} color="#FF6000" />
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.dateBox}>
            <Text style={styles.dateBoxLabel}>DROP-OFF DATE</Text>
            <View style={styles.dateInputRow}>
              <Calendar size={14} color="#2D114D" />
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* Search Input + Filter Sidebar Button */}
        <View style={styles.searchFilterRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search make, model, transmission, fuel..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.filterTriggerBtn}
            activeOpacity={0.85}
            onPress={() => setFilterModalOpen(true)}
          >
            <SlidersHorizontal size={16} color="#2D114D" />
            <Text style={styles.filterTriggerText}>Filters</Text>
          </TouchableOpacity>
        </View>

        {/* KM Plan Toggle (300 Kms incl. / Unlimited kms) */}
        <View style={styles.kmToggleWrap}>
          <TouchableOpacity
            style={[styles.kmToggleBtn, kmPlan === '300' && styles.kmToggleBtnActive]}
            onPress={() => setKmPlan('300')}
          >
            <Text style={[styles.kmToggleText, kmPlan === '300' && styles.kmToggleTextActive]}>
              300 Kms incl.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.kmToggleBtn, kmPlan === 'unlimited' && styles.kmToggleBtnActive]}
            onPress={() => setKmPlan('unlimited')}
          >
            <Text style={[styles.kmToggleText, kmPlan === 'unlimited' && styles.kmToggleTextActive]}>
              Unlimited kms
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {QUICK_CHIPS.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.chipPill, active && styles.chipPillActive]}
              onPress={() => setActiveChip(chip.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results Count Bar */}
      <View style={styles.resultsCountBar}>
        <Text style={styles.resultsCountTitle}>
          Showing {filteredVehicles.length} Verified Cars Available for Your Trip
        </Text>
        <Text style={styles.resultsCountSub}>
          Base fare includes 300 km/day • Refundable deposit shown at checkout
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky Website-Identical Brand Navbar */}
      <SafarHeader
        selectedCity={selectedCity}
        onPressCity={() => setCityModalOpen(true)}
      />

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#FF6000" />
          <Text style={styles.loaderText}>Loading verified Safar fleet...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVehicleCard}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matching vehicles found</Text>
              <Text style={styles.emptySub}>
                Try resetting your filters or selecting All Cities (Gujarat).
              </Text>
              <TouchableOpacity style={styles.resetBtn} onPress={resetAllFilters}>
                <RotateCcw size={14} color="#FFFFFF" />
                <Text style={styles.resetBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* City Selection Modal */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cityModalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gujarat Pickup Hub</Text>
              <TouchableOpacity onPress={() => setCityModalOpen(false)}>
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            {CITIES.map((city) => {
              const active = selectedCity === city;
              return (
                <TouchableOpacity
                  key={city}
                  style={[styles.cityOptionRow, active && styles.cityOptionRowActive]}
                  onPress={() => {
                    setSelectedCity(city);
                    setCityModalOpen(false);
                  }}
                >
                  <MapPin size={16} color={active ? '#FF6000' : '#64748B'} />
                  <Text style={[styles.cityOptionText, active && styles.cityOptionTextActive]}>
                    {city === 'All' ? 'All Cities (Gujarat)' : `${city} Hub`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Filters Drawer Modal (Matches Website Left Sidebar) */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.filterSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={resetAllFilters}>
                  <Text style={styles.resetLinkText}>Reset All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                  <X size={22} color="#1E1B2E" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Daily Rate Budget */}
              <Text style={styles.filterGroupTitle}>Daily Rate Budget</Text>
              <View style={styles.filterOptionsWrap}>
                {[3000, 5000, 8000, 15000].map((budget) => (
                  <TouchableOpacity
                    key={budget}
                    style={[
                      styles.filterOptionPill,
                      maxBudget === budget && styles.filterOptionPillActive,
                    ]}
                    onPress={() => setMaxBudget(budget)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        maxBudget === budget && styles.filterOptionTextActive,
                      ]}
                    >
                      {budget === 15000 ? 'Any Budget' : `Up to ₹${budget.toLocaleString('en-IN')}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Car Brand / Make */}
              <Text style={styles.filterGroupTitle}>Car Brand / Make</Text>
              <View style={styles.filterOptionsWrap}>
                {BRANDS.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    style={[
                      styles.filterOptionPill,
                      selectedBrand === brand && styles.filterOptionPillActive,
                    ]}
                    onPress={() => setSelectedBrand(brand)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedBrand === brand && styles.filterOptionTextActive,
                      ]}
                    >
                      {brand}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Transmission */}
              <Text style={styles.filterGroupTitle}>Transmission</Text>
              <View style={styles.filterOptionsWrap}>
                {(['All', 'Automatic', 'Manual'] as const).map((tr) => (
                  <TouchableOpacity
                    key={tr}
                    style={[
                      styles.filterOptionPill,
                      selectedTransmission === tr && styles.filterOptionPillActive,
                    ]}
                    onPress={() => setSelectedTransmission(tr)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedTransmission === tr && styles.filterOptionTextActive,
                      ]}
                    >
                      {tr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fuel Type */}
              <Text style={styles.filterGroupTitle}>Fuel Type</Text>
              <View style={styles.filterOptionsWrap}>
                {(['All', 'Petrol', 'Diesel'] as const).map((fl) => (
                  <TouchableOpacity
                    key={fl}
                    style={[
                      styles.filterOptionPill,
                      selectedFuel === fl && styles.filterOptionPillActive,
                    ]}
                    onPress={() => setSelectedFuel(fl)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedFuel === fl && styles.filterOptionTextActive,
                      ]}
                    >
                      {fl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyFiltersBtn}
              onPress={() => setFilterModalOpen(false)}
            >
              <Text style={styles.applyFiltersBtnText}>
                Show {filteredVehicles.length} Verified Cars
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 28,
  },
  listHeaderWrap: {
    paddingTop: 12,
    marginBottom: 8,
  },
  promoBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  promoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  promoEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.1,
  },
  verifiedFleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedFleetPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
  },
  promoHeadline: {
    fontSize: 19,
    fontWeight: '900',
    color: '#2D114D',
    letterSpacing: -0.3,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleHeaderRow: {
    marginBottom: 10,
  },
  scheduleTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  scheduleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cityTabsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  cityTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityTabActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  cityTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  cityTabTextActive: {
    color: '#FFFFFF',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dateBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateBoxLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B2E',
    padding: 0,
  },
  searchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 11,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E1B2E',
    padding: 0,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 13,
    height: 42,
    borderRadius: 12,
  },
  filterTriggerText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2D114D',
  },
  kmToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    padding: 3,
  },
  kmToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 999,
  },
  kmToggleBtnActive: {
    backgroundColor: '#FF6000',
  },
  kmToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  kmToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 12,
  },
  chipPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipPillActive: {
    backgroundColor: '#FF6000',
    borderColor: '#FF6000',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  resultsCountBar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 8,
  },
  resultsCountTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  resultsCountSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  imageStage: {
    width: '100%',
    height: 205,
    backgroundColor: '#EFF2F6',
    position: 'relative',
  },
  carStudioImage: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  verifiedBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065F46',
  },
  cardBody: {
    padding: 15,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  carTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  carSubMeta: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  newListingTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  specText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  distanceBold: {
    fontWeight: '800',
    color: '#1E1B2E',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  priceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  pricePerDay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  kmTermsText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  viewDetailsBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  cityModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 34,
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E1B2E',
  },
  resetLinkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6000',
  },
  cityOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  cityOptionRowActive: {
    backgroundColor: '#FFF7ED',
  },
  cityOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  cityOptionTextActive: {
    color: '#FF6000',
    fontWeight: '800',
  },
  filterGroupTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E1B2E',
    marginTop: 12,
    marginBottom: 8,
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  filterOptionPill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterOptionPillActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  filterOptionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  applyFiltersBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyFiltersBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
