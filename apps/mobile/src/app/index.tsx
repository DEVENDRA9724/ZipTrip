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
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
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
  Zap,
  Percent,
  Coins,
  Wallet,
  Gift,
  ArrowUpRight,
  ArrowRight,
  Plane,
  Compass,
  Truck,
  IndianRupee,
  Calculator,
  Clock,
} from 'lucide-react-native';

const CITIES = ['All', 'Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const QUICK_CHIPS = [
  { id: 'all', label: 'All Verified Cars' },
  { id: 'suv', label: 'SUV & 4×4' },
  { id: 'sedan', label: 'Sedan & Luxury' },
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
  const [driveMode, setDriveMode] = useState<'daily' | 'subscription' | 'weekday'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [kmPlan, setKmPlan] = useState<'300' | 'unlimited'>('300');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [pickupPickerOpen, setPickupPickerOpen] = useState(false);
  const [dropoffPickerOpen, setDropoffPickerOpen] = useState(false);

  // Advanced Filters
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedTransmission, setSelectedTransmission] = useState<'All' | 'Automatic' | 'Manual'>('All');
  const [selectedFuel, setSelectedFuel] = useState<'All' | 'Petrol' | 'Diesel'>('All');
  const [maxBudget, setMaxBudget] = useState<number>(15000);

  // Date & Time booking states
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(() => dateInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000)));
  const [endTime, setEndTime] = useState('10:00 AM');

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
    setDriveMode('daily');
    setSearchQuery('');
    setSelectedBrand('All Brands');
    setSelectedTransmission('All');
    setSelectedFuel('All');
    setMaxBudget(15000);
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
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
    if (!reviews || reviews.length === 0) return '4.9';
    const sum = reviews.reduce((acc, curr) => acc + Number(curr.rating || 5), 0);
    return (sum / reviews.length).toFixed(1);
  };

  const renderVehicleCard = (item: any) => {
    const rating = getAverageRating(item.reviews);
    const distance = getCarDistance(item);
    const terms = getVehicleTerms(item);
    const baseRate = Number(item.pricePerDay || 2500);
    const modeMultiplier = driveMode === 'weekday' ? 0.85 : driveMode === 'subscription' ? 0.78 : 1;
    const displayRate = Math.round((kmPlan === 'unlimited' ? baseRate * 1.25 : baseRate) * modeMultiplier);
    const hourlyRate = Math.max(99, Math.round(displayRate / 24));
    const hubAddress =
      item.pickupAddress ||
      HUB_ADDRESSES[item.locationCity] ||
      `${item.locationCity || 'Ahmedabad'}, Gujarat`;

    return (
      <TouchableOpacity
        key={String(item.id)}
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

          {/* Top-Left Verified Listing Pill */}
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={13} color="#0D9488" strokeWidth={2.5} />
            <Text style={styles.verifiedBadgeText}>Verified Listing</Text>
          </View>

          {/* Bottom-Right Rating Badge */}
          <View style={styles.imageRatingBadge}>
            <Star size={12} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.imageRatingText}>{rating} • Excellent</Text>
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
            <View style={styles.hourlyPill}>
              <Text style={styles.hourlyPillText}>₹{hourlyRate}/hr</Text>
            </View>
          </View>

          {/* Clean Spec Row */}
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
            <MapPin size={14} color="#FF6000" style={{ marginTop: 2 }} />
            <Text style={styles.locationText} numberOfLines={2}>
              {hubAddress} • <Text style={styles.distanceBold}>{distance} km away</Text>
            </Text>
          </View>

          {/* Available Status */}
          <View style={styles.availableRow}>
            <CheckCircle2 size={13} color="#0D9488" />
            <Text style={styles.availableText}>
              Hub Pickup & Doorstep Delivery Available
            </Text>
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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky Brand & Menu Header */}
      <SafarHeader
        selectedCity={selectedCity}
        onPressCity={() => setCityModalOpen(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. SUPER-APP HERO STAGE BANNER */}
        <View style={styles.heroStage}>
          {/* Top Search Pill + Coins + Wallet Row */}
          <View style={styles.heroTopSearchRow}>
            <View style={styles.heroSearchPill}>
              <Search size={17} color="#1E1B2E" />
              <TextInput
                style={styles.heroSearchInput}
                placeholder='Search for "Self drive cars"'
                placeholderTextColor="#475569"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.rewardMiniCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={styles.coinCircle}>
                <Coins size={13} color="#92400E" />
              </View>
              <Text style={styles.rewardMiniVal}>1500</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rewardMiniCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={[styles.coinCircle, { backgroundColor: '#DCFCE7' }]}>
                <Wallet size={13} color="#065F46" />
              </View>
              <Text style={styles.rewardMiniVal}>₹0</Text>
            </TouchableOpacity>
          </View>

          {/* Festive Roadtrip Sale Promo Artwork */}
          <View style={styles.heroPromoRow}>
            <View style={styles.festivalBadgeBox}>
              <Text style={styles.festivalBadgeTop}>GUJARAT</Text>
              <Text style={styles.festivalBadgeMid}>ROADTRIP</Text>
              <View style={styles.festivalSaleRibbon}>
                <Text style={styles.festivalSaleText}>FESTIVAL</Text>
              </View>
            </View>

            <View style={styles.heroVertDivider} />

            <View style={styles.heroDiscountCol}>
              <Text style={styles.heroGetLabel}>Get Flat</Text>
              <Text style={styles.heroBigOff}>25% OFF</Text>
              <View style={styles.promoCodeBox}>
                <View style={styles.promoCodeLeft}>
                  <Text style={styles.promoCodeLeftText}>Use Code</Text>
                </View>
                <View style={styles.promoCodeRight}>
                  <Text style={styles.promoCodeRightText}>SAFAR25</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Applicable Cities Lime Pill */}
          <TouchableOpacity
            style={styles.citiesLimePill}
            activeOpacity={0.9}
            onPress={() => setCityModalOpen(true)}
          >
            <MapPin size={13} color="#0F172A" />
            <Text style={styles.citiesLimeText} numberOfLines={1}>
              Ahmedabad  |  Surat  |  Vadodara  |  Gandhinagar  |  Rajkot
            </Text>
          </TouchableOpacity>

          {/* Interactive Trip Schedule & Date/Time Picker Bar */}
          <View style={styles.scheduleFloatingCard}>
            <View style={styles.schedulePickersRow}>
              <TouchableOpacity
                style={styles.datePickerTrigger}
                activeOpacity={0.85}
                onPress={() => setPickupPickerOpen(true)}
              >
                <Text style={styles.pickerLabel}>PICK-UP DATE & TIME</Text>
                <View style={styles.pickerValRow}>
                  <Calendar size={13} color="#FF6000" />
                  <Text style={styles.pickerDateText}>{startDate}</Text>
                </View>
                <View style={styles.pickerTimeRow}>
                  <Clock size={11} color="#64748B" />
                  <Text style={styles.pickerTimeText}>{startTime}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.scheduleArrowCircle}>
                <ArrowRight size={14} color="#2D114D" />
              </View>

              <TouchableOpacity
                style={styles.datePickerTrigger}
                activeOpacity={0.85}
                onPress={() => setDropoffPickerOpen(true)}
              >
                <Text style={styles.pickerLabel}>RETURN DATE & TIME</Text>
                <View style={styles.pickerValRow}>
                  <Calendar size={13} color="#2D114D" />
                  <Text style={styles.pickerDateText}>{endDate}</Text>
                </View>
                <View style={styles.pickerTimeRow}>
                  <Clock size={11} color="#64748B" />
                  <Text style={styles.pickerTimeText}>{endTime}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.scheduleActionsRow}>
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

              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setFilterModalOpen(true)}
              >
                <SlidersHorizontal size={15} color="#2D114D" />
                <Text style={styles.filterBtnText}>Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.mainBody}>
          {/* 2. "SELF DRIVE" BENTO GRID (Matches Screenshot 1!) */}
          <Text style={styles.sectionHeading}>Self Drive</Text>
          <View style={styles.selfDriveBento}>
            {/* Left Tall Card: Daily Drive */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.bentoLeftTall,
                driveMode === 'daily' && styles.bentoCardSelected,
              ]}
              onPress={() => setDriveMode('daily')}
            >
              <View style={{ padding: 14 }}>
                <Text style={styles.bentoTitle}>Daily Drive</Text>
                <Text style={styles.bentoSub}>4+ Hours • 300 Kms</Text>
              </View>

              <View style={styles.bentoDailyStage}>
                <View style={styles.bentoBoltCircle}>
                  <Zap size={22} color="#FFFFFF" fill="#FFFFFF" />
                </View>
                <Image
                  source={require('../../assets/cars/thar.jpg')}
                  style={styles.bentoTallCarImg}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>

            {/* Right Column: Subscription + Weekday Pass */}
            <View style={styles.bentoRightCol}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.bentoRightCard,
                  driveMode === 'subscription' && styles.bentoCardSelected,
                ]}
                onPress={() => setDriveMode('subscription')}
              >
                <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
                  <Text style={styles.bentoTitleSm}>SUBSCRIPTION</Text>
                  <Text style={styles.bentoSub}>7+ days • Save 22%</Text>
                </View>
                <View style={styles.bentoRightBottomRow}>
                  <View style={[styles.bentoMiniIconBox, { backgroundColor: '#DDD6FE' }]}>
                    <Calendar size={18} color="#4C1D95" />
                  </View>
                  <Image
                    source={require('../../assets/cars/bmw.jpg')}
                    style={styles.bentoRightCarImg}
                    resizeMode="cover"
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.bentoRightCard,
                  driveMode === 'weekday' && styles.bentoCardSelected,
                ]}
                onPress={() => setDriveMode('weekday')}
              >
                <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
                  <Text style={styles.bentoTitleSm}>Weekday Pass</Text>
                  <Text style={styles.bentoSub}>Mon to Fri • 15% Off</Text>
                </View>
                <View style={styles.bentoRightBottomRow}>
                  <View style={[styles.bentoMiniIconBox, { backgroundColor: '#FECDD3' }]}>
                    <Percent size={18} color="#BE123C" />
                  </View>
                  <Image
                    source={require('../../assets/cars/swift.jpg')}
                    style={styles.bentoRightCarImg}
                    resizeMode="cover"
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. EXPLORE SERVICES 3-COLUMN BENTO (Matches Screenshot 1!) */}
          <Text style={styles.sectionHeading}>Explore</Text>
          <View style={styles.exploreRow}>
            <TouchableOpacity
              style={styles.exploreCard}
              activeOpacity={0.88}
              onPress={() => {
                setSelectedCity('Ahmedabad');
              }}
            >
              <View style={styles.newOrangeTag}>
                <Text style={styles.newOrangeTagText}>NEW</Text>
              </View>
              <Text style={styles.exploreCardTitle}>Airport{'\n'}Pickup</Text>
              <View style={styles.exploreIconStage}>
                <Plane size={28} color="#2D114D" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exploreCard}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/guides' as any, params: { section: 'guides' } })}
            >
              <Text style={styles.exploreCardTitle}>Gujarat{'\n'}Guides</Text>
              <View style={[styles.exploreIconStage, { backgroundColor: '#FEF3C7' }]}>
                <Compass size={28} color="#D97706" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exploreCard}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/guides' as any, params: { section: 'how' } })}
            >
              <View style={styles.newOrangeTag}>
                <Text style={styles.newOrangeTagText}>NEW</Text>
              </View>
              <Text style={styles.exploreCardTitle}>Doorstep{'\n'}Delivery</Text>
              <View style={[styles.exploreIconStage, { backgroundColor: '#DCFCE7' }]}>
                <Truck size={28} color="#0D9488" />
              </View>
            </TouchableOpacity>
          </View>

          {/* 4. LIVE VERIFIED FLEET SECTION */}
          <View style={styles.fleetSectionHeader}>
            <View>
              <Text style={styles.sectionHeading}>Verified Fleet ({filteredVehicles.length})</Text>
              <Text style={styles.fleetSubText}>
                100% Pre-Inspected • Instant Digital Lease Agreement
              </Text>
            </View>
            {selectedCity !== 'All' && (
              <TouchableOpacity onPress={resetAllFilters}>
                <Text style={styles.resetFilterLink}>Show All</Text>
              </TouchableOpacity>
            )}
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

          {loading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#FF6000" />
              <Text style={styles.loaderText}>Loading verified Safar fleet...</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
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
          ) : (
            <View>{filteredVehicles.map((item) => renderVehicleCard(item))}</View>
          )}

          {/* 5. SAFAR BENEFITS + GRADIENT PROMO BANNER (Matches Screenshot 2!) */}
          <Text style={[styles.sectionHeading, { marginTop: 10 }]}>Benefits</Text>
          <View style={styles.benefitsRow}>
            <TouchableOpacity
              style={styles.benefitMiniCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={[styles.benefitIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <Wallet size={18} color="#0D9488" />
              </View>
              <View>
                <Text style={styles.benefitTitle}>S Cash</Text>
                <Text style={styles.benefitVal}>₹0</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.benefitMiniCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={[styles.benefitIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Coins size={18} color="#D97706" />
              </View>
              <View>
                <Text style={styles.benefitTitle}>S Credits</Text>
                <Text style={styles.benefitVal}>1500</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.benefitMiniCard}
              onPress={() => router.push('/trips')}
            >
              <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Gift size={18} color="#2D114D" />
              </View>
              <View>
                <Text style={styles.benefitTitle}>GST Claim</Text>
                <Text style={styles.benefitVal}>80/20</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Warm Coral-Orange Promo Card */}
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.creditsBannerCard}
            onPress={() => router.push('/verification')}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.creditsBannerTitle}>
                Instant Handover & Credits are waiting for you!
              </Text>
              <Text style={styles.creditsBannerSub}>
                Complete your DigiLocker Aadhaar & Driving Licence e-KYC in 60 seconds.
              </Text>
              <View style={styles.proceedRow}>
                <Text style={styles.proceedText}>PROCEED</Text>
                <ArrowUpRight size={15} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.goldBagCircle}>
              <ShieldCheck size={42} color="#B45309" />
            </View>
          </TouchableOpacity>

          {/* 6. HOST AND EARN 3-COLUMN CARDS (Matches Screenshot 2 & 3!) */}
          <View style={styles.hostEarnBox}>
            <View style={styles.hostEarnHeader}>
              <Text style={styles.hostEarnTitle}>Host and Earn</Text>
              <TouchableOpacity
                style={styles.registerNowBtn}
                onPress={() => router.push('/host')}
              >
                <Text style={styles.registerNowText}>Register now →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.hostCardsRow}>
              <TouchableOpacity
                style={[styles.hostFeatureCard, { backgroundColor: '#E0F2FE' }]}
                onPress={() => router.push('/host')}
              >
                <Text style={styles.hostFeatureText}>Earn 80% Share from your Car</Text>
                <View style={styles.hostFeatureIconCircle}>
                  <IndianRupee size={24} color="#0284C7" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.hostFeatureCard, { backgroundColor: '#DCFCE7' }]}
                onPress={() => router.push('/host')}
              >
                <Text style={styles.hostFeatureText}>8-Angle Inspected Protection</Text>
                <View style={styles.hostFeatureIconCircle}>
                  <ShieldCheck size={24} color="#0D9488" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.hostFeatureCard, { backgroundColor: '#FEF3C7' }]}
                onPress={() => router.push('/host')}
              >
                <Text style={styles.hostFeatureText}>Calculate your future earning</Text>
                <View style={styles.hostFeatureIconCircle}>
                  <Calculator size={24} color="#D97706" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* 7. 2x2 TRUST MATRIX + SIGNATURE BRAND FOOTER (Matches Screenshot 3!) */}
          <View style={styles.trustGridCard}>
            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <ShieldCheck size={20} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>100% Secured trip</Text>
                <Text style={styles.trustSub}>8-Angle Pre-Inspected</Text>
              </View>
            </View>

            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <MapPin size={20} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>Delivery</Text>
                <Text style={styles.trustSub}>Anywhere Anytime</Text>
              </View>
            </View>

            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <Star size={20} color="#F59E0B" fill="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>4.9★ Top Rated</Text>
                <Text style={styles.trustSub}>Cars across Gujarat</Text>
              </View>
            </View>

            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <IndianRupee size={20} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>Best Value</Text>
                <Text style={styles.trustSub}>Dual 80/20 GST Invoice</Text>
              </View>
            </View>
          </View>

          {/* Signature Brand Footer */}
          <View style={styles.brandFooter}>
            <Text style={styles.footerBrandMain}>safar</Text>
            <Text style={styles.footerBrandSub}>- SELF DRIVE -</Text>
            <Text style={styles.footerSlogan}>Driving Gujarat Forward!</Text>
            <Text style={styles.footerCrafted}>
              Safar Cars LLP • Ahmedabad • Surat • Vadodara • Gandhinagar • Rajkot
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Interactive Pick-up Date & Time Picker Modal */}
      <DateTimePickerModal
        visible={pickupPickerOpen}
        title="Select Pick-up Date & Time"
        selectedDate={startDate}
        selectedTime={startTime}
        onClose={() => setPickupPickerOpen(false)}
        onSelect={(d, t) => {
          setStartDate(d);
          setStartTime(t);
        }}
      />

      {/* Interactive Return Date & Time Picker Modal */}
      <DateTimePickerModal
        visible={dropoffPickerOpen}
        title="Select Return Date & Time"
        selectedDate={endDate}
        selectedTime={endTime}
        onClose={() => setDropoffPickerOpen(false)}
        onSelect={(d, t) => {
          setEndDate(d);
          setEndTime(t);
        }}
      />

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

      {/* Filters Drawer Modal */}
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
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
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingBottom: 115,
  },
  heroStage: {
    backgroundColor: '#1E0B36',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  heroTopSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  heroSearchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
  },
  heroSearchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  rewardMiniCard: {
    width: 48,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  coinCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardMiniVal: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  heroPromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  festivalBadgeBox: {
    flex: 1,
    alignItems: 'center',
  },
  festivalBadgeTop: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FDE047',
    letterSpacing: 1.5,
  },
  festivalBadgeMid: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF8833',
    letterSpacing: 0.5,
  },
  festivalSaleRibbon: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 3,
  },
  festivalSaleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroVertDivider: {
    width: 1,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginHorizontal: 12,
  },
  heroDiscountCol: {
    flex: 1.2,
  },
  heroGetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  heroBigOff: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4ADE80',
    fontStyle: 'italic',
    lineHeight: 32,
  },
  promoCodeBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  promoCodeLeft: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promoCodeLeftText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  promoCodeRight: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoCodeRightText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  citiesLimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#BEF264',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 14,
  },
  citiesLimeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  scheduleFloatingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  schedulePickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  datePickerTrigger: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 9,
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  pickerValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pickerDateText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  pickerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pickerTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6000',
  },
  scheduleArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kmToggleWrap: {
    flex: 1,
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
    backgroundColor: '#2D114D',
  },
  kmToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  kmToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },
  mainBody: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1E1B2E',
    marginBottom: 10,
  },
  selfDriveBento: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  bentoLeftTall: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 230,
  },
  bentoCardSelected: {
    borderColor: '#FF6000',
    backgroundColor: '#FFFDFB',
  },
  bentoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  bentoTitleSm: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  bentoSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  bentoDailyStage: {
    backgroundColor: '#ECFDF5',
    paddingTop: 12,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 135,
  },
  bentoBoltCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoTallCarImg: {
    width: 112,
    height: 92,
    borderTopLeftRadius: 12,
  },
  bentoRightCol: {
    flex: 1,
    gap: 10,
  },
  bentoRightCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 110,
  },
  bentoRightBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingBottom: 8,
  },
  bentoMiniIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoRightCarImg: {
    width: 96,
    height: 58,
    borderTopLeftRadius: 10,
  },
  exploreRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  exploreCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    minHeight: 125,
    justifyContent: 'space-between',
    position: 'relative',
  },
  newOrangeTag: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: '#FF6000',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newOrangeTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  exploreCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    lineHeight: 18,
  },
  exploreIconStage: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fleetSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -6,
    marginBottom: 10,
  },
  resetFilterLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6000',
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 14,
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
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
  imageRatingBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageRatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
  hourlyPill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hourlyPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2D114D',
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
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
  },
  pricePerDay: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  kmTermsText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  viewDetailsBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  benefitMiniCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  benefitVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  creditsBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6000',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
  },
  creditsBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 23,
  },
  creditsBannerSub: {
    fontSize: 12,
    color: '#FFEDD5',
    marginTop: 6,
    lineHeight: 17,
  },
  proceedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  proceedText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  goldBagCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FDE047',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostEarnBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 18,
  },
  hostEarnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostEarnTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E1B2E',
  },
  registerNowBtn: {
    paddingVertical: 4,
  },
  registerNowText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0D9488',
  },
  hostCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hostFeatureCard: {
    flex: 1,
    borderRadius: 16,
    padding: 11,
    minHeight: 135,
    justifyContent: 'space-between',
  },
  hostFeatureText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 16,
  },
  hostFeatureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  trustGridCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    marginBottom: 24,
  },
  trustItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 6,
  },
  trustIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  trustSub: {
    fontSize: 10.5,
    color: '#475569',
    marginTop: 1,
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerBrandMain: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#2D114D',
    letterSpacing: -0.5,
  },
  footerBrandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 2.2,
    marginTop: 1,
  },
  footerSlogan: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 8,
  },
  footerCrafted: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  loaderCenter: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
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
    marginBottom: 16,
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
