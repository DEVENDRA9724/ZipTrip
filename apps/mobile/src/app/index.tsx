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
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest, getVehicleImageSource, getCarDistance } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import { useAuth } from '@/context/AuthContext';
import {
  MapPin,
  ChevronDown,
  ShieldCheck,
  Car,
  Heart,
  ArrowRight,
  Check,
  Calendar,
  User,
  PhoneCall,
} from 'lucide-react-native';

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];

const POPULAR_HUBS: Record<string, string[]> = {
  Ahmedabad: [
    'SVP International Airport (Terminal 1)',
    'SG Highway Hub, Prahlad Nagar',
    'Swami Vivekanand Bridge, Riverfront',
    'Sabarmati Bullet Train Station Hub',
  ],
  Surat: [
    'Surat International Airport (STV)',
    'Vesu VIP Road Hub',
    'Adajan Riverfront Hub',
  ],
  Vadodara: [
    'Vadodara Airport (BDQ)',
    'Alkapuri Station Road Hub',
  ],
  Gandhinagar: [
    'GIFT City Tower 1 Hub',
    'Mahatma Mandir Sector 13',
  ],
  Rajkot: [
    'Hirasar Airport Hub',
    'Kalawad Road Hub',
  ],
};

const FLEET_FILTERS = [
  { key: 'ALL', label: 'All Vehicles' },
  { key: 'SUV', label: 'SUV & 4x4' },
  { key: 'AUTOMATIC', label: 'Automatic' },
  { key: 'SEDAN', label: 'Sedan' },
  { key: 'BUDGET', label: 'Under ₹2,500' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Booking Widget State
  const [city, setCity] = useState('Ahmedabad');
  const [hubAddress, setHubAddress] = useState('SVP International Airport (Terminal 1)');
  const [startDate, setStartDate] = useState('2026-11-13');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState('2026-11-14');
  const [endTime, setEndTime] = useState('10:00 AM');
  const [kmPackage, setKmPackage] = useState<'standard' | 'unlimited'>('standard');
  const [bookingMode, setBookingMode] = useState<'daily' | 'lease'>('daily');
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
    if (isNaN(a) || isNaN(b) || b <= a) return bookingMode === 'lease' ? 7 : 1;
    return Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate, bookingMode]);

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
        tier: bookingMode,
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
      {/* ────────── 1. AUTHORITATIVE TOP HEADER ────────── */}
      <View style={s.topHeader}>
        <TouchableOpacity
          style={s.brandRow}
          onPress={() => setCityModalOpen(true)}
          activeOpacity={0.75}
        >
          <Image
            source={require('../../assets/safar-logo.png')}
            style={s.brandLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={s.brandName}>SAFAR</Text>
            <View style={s.locationRow}>
              <Text style={s.locationCity}>{city}</Text>
              <ChevronDown size={13} color="#475569" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={s.headerActions}>
          <TouchableOpacity
            style={s.helplineBtn}
            onPress={() => Linking.openURL('tel:+919900000001')}
            activeOpacity={0.75}
          >
            <PhoneCall size={14} color="#0F172A" />
            <Text style={s.helplineText}>24x7 Help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => router.push(user ? '/wallet' : '/auth/login')}
            activeOpacity={0.8}
          >
            {user ? (
              <Text style={s.profileInitial}>
                {(user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </Text>
            ) : (
              <User size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ────────── 2. STRUCTURED RESERVATION ENGINE (LIKE SIXT / REVV) ────────── */}
        <View style={s.bookingSection}>
          {/* Mode Tabs Built Directly Into the Reservation Card */}
          <View style={s.reservationCard}>
            <View style={s.modeTabsBar}>
              <TouchableOpacity
                style={[s.modeTab, bookingMode === 'daily' && s.modeTabActive]}
                onPress={() => {
                  setBookingMode('daily');
                  setEndDate('2026-11-14');
                }}
                activeOpacity={0.85}
              >
                <Text style={[s.modeTabTitle, bookingMode === 'daily' && s.modeTabTitleActive]}>
                  Daily & Weekend
                </Text>
                <Text style={s.modeTabSub}>1 to 6 Days Rental</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modeTab, bookingMode === 'lease' && s.modeTabActive]}
                onPress={() => {
                  setBookingMode('lease');
                  setEndDate('2026-11-20');
                }}
                activeOpacity={0.85}
              >
                <View style={s.reserveTitleRow}>
                  <Text style={[s.modeTabTitle, bookingMode === 'lease' && s.modeTabTitleActive]}>
                    Safar Reserve
                  </Text>
                  <View style={s.saveBadge}>
                    <Text style={s.saveBadgeText}>-35%</Text>
                  </View>
                </View>
                <Text style={s.modeTabSub}>7 to 90 Days Subscription</Text>
              </TouchableOpacity>
            </View>

            <View style={s.cardInner}>
              {/* Pickup & Return Location */}
              <TouchableOpacity
                style={s.fieldBox}
                onPress={() => setCityModalOpen(true)}
                activeOpacity={0.75}
              >
                <View style={s.fieldHeaderRow}>
                  <Text style={s.fieldLabel}>PICK-UP & RETURN LOCATION</Text>
                  <Text style={s.changeBtnText}>CHANGE</Text>
                </View>
                <View style={s.locationValueRow}>
                  <MapPin size={15} color="#FF6000" />
                  <Text style={s.fieldMainValue} numberOfLines={1}>
                    {hubAddress}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Pick-up & Drop-off Date Grid */}
              <View style={s.dateGrid}>
                <TouchableOpacity
                  style={s.dateCell}
                  onPress={() => setStartPickerOpen(true)}
                  activeOpacity={0.75}
                >
                  <Text style={s.fieldLabel}>PICK-UP DATE</Text>
                  <Text style={s.dateMainText}>{formatShortDate(startDate)}</Text>
                  <Text style={s.timeSubText}>{startTime}</Text>
                </TouchableOpacity>

                <View style={s.dateDividerWrap}>
                  <View style={s.dateVerticalLine} />
                  <View style={s.daysCountBox}>
                    <Text style={s.daysCountText}>
                      {days} {days === 1 ? 'DAY' : 'DAYS'}
                    </Text>
                  </View>
                  <View style={s.dateVerticalLine} />
                </View>

                <TouchableOpacity
                  style={[s.dateCell, { alignItems: 'flex-end' }]}
                  onPress={() => setEndPickerOpen(true)}
                  activeOpacity={0.75}
                >
                  <Text style={s.fieldLabel}>DROP-OFF DATE</Text>
                  <Text style={s.dateMainText}>{formatShortDate(endDate)}</Text>
                  <Text style={s.timeSubText}>{endTime}</Text>
                </TouchableOpacity>
              </View>

              {/* KM Allowance Selector */}
              <View style={s.kmSelectorRow}>
                <Text style={s.kmRowLabel}>Kilometre Plan:</Text>
                <View style={s.kmToggleGroup}>
                  <TouchableOpacity
                    style={[s.kmPill, kmPackage === 'standard' && s.kmPillActive]}
                    onPress={() => setKmPackage('standard')}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.kmPillText, kmPackage === 'standard' && s.kmPillTextActive]}>
                      300 KM / Day
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.kmPill, kmPackage === 'unlimited' && s.kmPillActive]}
                    onPress={() => setKmPackage('unlimited')}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.kmPillText, kmPackage === 'unlimited' && s.kmPillTextActive]}>
                      Unlimited KM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Search CTA */}
              <TouchableOpacity
                style={s.findCarsBtn}
                onPress={handleSearchCars}
                activeOpacity={0.88}
              >
                <Text style={s.findCarsBtnText}>
                  {bookingMode === 'lease'
                    ? `VIEW SAFAR RESERVE FLEET (${vehicles.length || 6})`
                    : `SEARCH AVAILABLE CARS (${vehicles.length || 6})`}
                </Text>
                <ArrowRight size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ────────── 3. INSTITUTIONAL CUSTOMER PROTECTION BAR ────────── */}
        <View style={s.protectionGrid}>
          <View style={s.protectionCell}>
            <Text style={s.protectionMetric}>₹0 Deposit</Text>
            <Text style={s.protectionLabel}>DigiLocker Verified</Text>
          </View>
          <View style={s.protectionVertDivider} />
          <View style={s.protectionCell}>
            <Text style={s.protectionMetric}>White Plate</Text>
            <Text style={s.protectionLabel}>100% Private Fleet</Text>
          </View>
          <View style={s.protectionVertDivider} />
          <View style={s.protectionCell}>
            <Text style={s.protectionMetric}>8-Point Check</Text>
            <Text style={s.protectionLabel}>Insured & Sanitized</Text>
          </View>
        </View>

        {/* ────────── 4. VERIFIED FLEET IN SELECTED CITY ────────── */}
        <View style={s.fleetSection}>
          <View style={s.sectionTitleBar}>
            <View>
              <Text style={s.sectionTitle}>Verified Fleet in {city}</Text>
              <Text style={s.sectionSubtitle}>
                All vehicles include comprehensive insurance & 24x7 roadside support
              </Text>
            </View>
            <TouchableOpacity onPress={handleSearchCars} style={s.viewAllBtn}>
              <Text style={s.viewAllText}>View All</Text>
              <ArrowRight size={13} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Clean Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterTabsRow}
          >
            {FLEET_FILTERS.map((f) => {
              const active = selectedCategory === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterTab, active && s.filterTabActive]}
                  onPress={() => setSelectedCategory(f.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterTabText, active && s.filterTabTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color="#0F172A" />
              <Text style={s.loadingLabel}>Checking real-time fleet availability…</Text>
            </View>
          ) : displayedVehicles.length === 0 ? (
            <View style={s.emptyWrap}>
              <Car size={30} color="#94A3B8" />
              <Text style={s.emptyLabel}>No vehicles match this filter in {city}.</Text>
              <TouchableOpacity onPress={() => setSelectedCategory('ALL')}>
                <Text style={s.resetFilterText}>Reset Filter</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.vehicleCardsList}>
              {displayedVehicles.slice(0, 6).map((car) => {
                const rawPrice = Number(car.pricePerDay || 2500);
                const price = bookingMode === 'lease' ? Math.round(rawPrice * 0.75) : rawPrice;
                const isFav = !!favorites[car.id];
                const dist = getCarDistance(car);

                return (
                  <TouchableOpacity
                    key={car.id}
                    style={s.vehicleCard}
                    onPress={() => openCar(String(car.id))}
                    activeOpacity={0.92}
                  >
                    {/* Top Image & Registration Series */}
                    <View style={s.vehicleImgContainer}>
                      <Image
                        source={getVehicleImageSource(car)}
                        style={s.vehicleImg}
                        resizeMode="cover"
                      />
                      <View style={s.plateBadge}>
                        <Text style={s.plateBadgeText}>GJ-01 • PRIVATE WHITE PLATE</Text>
                      </View>
                      <TouchableOpacity
                        style={s.wishlistBtn}
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

                    {/* Structured Vehicle Specs & Pricing */}
                    <View style={s.vehicleBody}>
                      <View style={s.vehicleHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.vehicleMakeYear}>
                            {car.make} • {car.year || '2025'} MODEL
                          </Text>
                          <Text style={s.vehicleModelName} numberOfLines={1}>
                            {car.model}
                          </Text>
                        </View>
                        <View style={s.verifiedScoreBox}>
                          <Text style={s.verifiedScoreVal}>4.9 / 5</Text>
                          <Text style={s.verifiedScoreSub}>Verified</Text>
                        </View>
                      </View>

                      {/* Technical Specs Table Strip */}
                      <View style={s.techSpecsRow}>
                        <View style={s.techSpecItem}>
                          <Text style={s.techSpecText}>{car.transmission || 'Automatic'}</Text>
                        </View>
                        <View style={s.techSpecItem}>
                          <Text style={s.techSpecText}>{car.fuelType || 'Diesel'}</Text>
                        </View>
                        <View style={s.techSpecItem}>
                          <Text style={s.techSpecText}>{car.seats || 5} Seats</Text>
                        </View>
                        <View style={s.techSpecItem}>
                          <Text style={s.techSpecText}>{dist} km from hub</Text>
                        </View>
                      </View>

                      <View style={s.vehicleFooterRow}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                            <Text style={s.priceValue}>₹{price.toLocaleString('en-IN')}</Text>
                            <Text style={s.priceUnit}>/ day</Text>
                          </View>
                          <Text style={s.priceIncludedNote}>
                            {kmPackage === 'unlimited' ? 'Unlimited KMs included' : '300 KMs/day included'} • ₹0 Deposit
                          </Text>
                        </View>

                        <View style={s.reserveNowBtn}>
                          <Text style={s.reserveNowBtnText}>Select Car</Text>
                          <ArrowRight size={14} color="#FFFFFF" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ────────── 5. HOW SAFAR SELF DRIVE WORKS (NUMBERED, AUTHORITATIVE) ────────── */}
        <View style={s.processSection}>
          <Text style={s.processSectionTitle}>Standard Handover Protocol</Text>
          <Text style={s.processSectionSub}>
            Every rental is backed by documented inspection and government e-KYC
          </Text>

          <View style={s.processStepsList}>
            <View style={s.processStepRow}>
              <View style={s.stepNumberBox}>
                <Text style={s.stepNumberText}>01</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>Instant DigiLocker or Camera DL Verification</Text>
                <Text style={s.stepDesc}>
                  Verify your Driving Licence in the Account tab to unlock ₹0 security deposit across all vehicles.
                </Text>
              </View>
            </View>

            <View style={s.processStepRow}>
              <View style={s.stepNumberBox}>
                <Text style={s.stepNumberText}>02</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>8-Angle Pre-Trip Camera Walkaround</Text>
                <Text style={s.stepDesc}>
                  Record all 8 vehicle sides and odometer reading in the app at handover for complete transparency.
                </Text>
              </View>
            </View>

            <View style={s.processStepRow}>
              <View style={s.stepNumberBox}>
                <Text style={s.stepNumberText}>03</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>GST Tax Invoice & 24x7 Highway Support</Text>
                <Text style={s.stepDesc}>
                  Receive an official SAC 997311 GST invoice and dedicated roadside assistance across Gujarat.
                </Text>
              </View>
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
            <Text style={s.modalTitle}>Select Operating City & Hub</Text>

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

            <Text style={s.hubListLabel}>AUTHORIZED PICKUP HUBS IN {city.toUpperCase()}</Text>
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
        title="Drop-off Date & Time"
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

  /* 1. Top Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locationCity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helplineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  helplineText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  scrollContent: {
    paddingBottom: 36,
  },

  /* 2. Structured Reservation Engine */
  bookingSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  reservationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  modeTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2.5,
    borderBottomColor: '#FF6000',
  },
  reserveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modeTabTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabTitleActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  modeTabSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  cardInner: {
    padding: 14,
    gap: 12,
  },
  fieldBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  changeBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.3,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldMainValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Date Grid */
  dateGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  dateCell: {
    flex: 1,
  },
  dateMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  timeSubText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  dateDividerWrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dateVerticalLine: {
    width: 1,
    height: 10,
    backgroundColor: '#CBD5E1',
  },
  daysCountBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginVertical: 2,
  },
  daysCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* KM Selector */
  kmSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kmRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  kmToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kmPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  kmPillActive: {
    backgroundColor: '#0F172A',
  },
  kmPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  kmPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Search CTA */
  findCarsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6000',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 2,
  },
  findCarsBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* 3. Protection Grid */
  protectionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  protectionCell: {
    flex: 1,
    alignItems: 'center',
  },
  protectionVertDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  protectionMetric: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  protectionLabel: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },

  /* 4. Fleet Section */
  fleetSection: {
    paddingHorizontal: 16,
    marginTop: 22,
  },
  sectionTitleBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 2,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  filterTabsRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Vehicle Cards */
  vehicleCardsList: {
    gap: 14,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  vehicleImgContainer: {
    height: 180,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  vehicleImg: {
    width: '100%',
    height: '100%',
  },
  plateBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plateBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vehicleBody: {
    padding: 14,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vehicleMakeYear: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleModelName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  verifiedScoreBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  verifiedScoreVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  verifiedScoreSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#059669',
  },
  techSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  techSpecItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  techSpecText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  vehicleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  priceUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  priceIncludedNote: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  reserveNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reserveNowBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  loadingWrap: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  resetFilterText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FF6000',
    marginTop: 4,
  },

  /* 5. Process Section */
  processSection: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  processSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  processSectionSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  processStepsList: {
    gap: 14,
  },
  processStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },

  /* City Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
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
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cityModalPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  cityModalPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  cityModalPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hubListLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  hubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  hubOptionSelected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
