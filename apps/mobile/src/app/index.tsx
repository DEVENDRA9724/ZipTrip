import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, FlatList, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { Search, MapPin, Calendar, Map, List, LogIn, User, Star, SlidersHorizontal, Eye } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CITIES = ['All', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];
const CATEGORIES = ['All', 'Self Drive', 'Taxi', 'SUV', 'Luxury', 'Sedan', 'Hatchback'];

export default function SearchScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const authContext = require('@/context/AuthContext');
  const { user } = authContext.useAuth();

  // Search & Filter States
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Date booking states
  const [startDate, setStartDate] = useState('2026-06-28');
  const [endDate, setEndDate] = useState('2026-06-29');

  // Selected Pin on Map
  const [activePin, setActivePin] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchVehicles();
    }, [selectedCity, selectedCategory, searchQuery])
  );

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      let endpoint = `/vehicles?city=${selectedCity}`;
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Self Drive') {
          endpoint += `&search=Self Drive`;
        } else if (selectedCategory === 'Taxi') {
          endpoint += `&search=Taxi`;
        } else {
          endpoint += `&category=${selectedCategory}`;
        }
      }
      if (searchQuery) {
        endpoint += `&search=${searchQuery}`;
      }
      const data = await apiRequest(endpoint);
      setVehicles(data);
      if (data.length > 0) {
        setActivePin(data[0]); // default active pin on map
      } else {
        setActivePin(null);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAverageRating = (reviews: any[]) => {
    if (!reviews || reviews.length === 0) return 'New';
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const renderVehicleCard = ({ item }: { item: any }) => {
    const images = item.images.split(',');
    const rating = getAverageRating(item.reviews);
    const isTaxi = item.model.includes('Taxi') || item.category === 'Luxury';
    
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => router.push({
          pathname: `/details/${item.id}`,
          params: { startDate, endDate }
        })}
      >
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: images[0] }} style={styles.cardImage} />
          <View style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backgroundColor: isTaxi ? '#5B1F7C' : '#F47B20',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3,
            elevation: 4,
          }}>
            <ThemedText style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>
              {isTaxi ? '🚖 Taxi with Driver' : '🔑 Private Plate Self-Drive'}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <ThemedText style={styles.carName}>{item.make} {item.model}</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {item.locationCity}, Gujarat • {item.category} • {item.transmission} • {item.fuelType}
              </ThemedText>
            </View>
            <View style={[styles.ratingBadge, { backgroundColor: colors.backgroundElement }]}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" />
              <ThemedText style={styles.ratingText}>{rating}</ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.cardFooter}>
            <View>
              <ThemedText style={[styles.price, { color: isTaxi ? '#5B1F7C' : colors.primary }]}>
                ₹{Number(item.pricePerDay).toLocaleString('en-IN')}
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {isTaxi ? '/day (or per KM)' : '/day'}
                </ThemedText>
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {isTaxi ? 'All Gujarat Taxi Service' : 'Private No. • Excl. fuel'}
              </ThemedText>
            </View>
            <View style={[styles.detailsBtn, { backgroundColor: isTaxi ? '#5B1F7C' : colors.primary }]}>
              <ThemedText style={styles.detailsBtnText}>View Details</ThemedText>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Premium Mock Map View
  const renderMapView = () => {
    return (
      <View style={[styles.mapContainer, { backgroundColor: colors.backgroundElement }]}>
        {/* Mock Map Vector Grid Background */}
        <View style={styles.mapGrid}>
          {/* Mock Roads */}
          <View style={[styles.mapRoad, styles.roadH1, { backgroundColor: colors.border }]} />
          <View style={[styles.mapRoad, styles.roadH2, { backgroundColor: colors.border }]} />
          <View style={[styles.mapRoad, styles.roadV1, { backgroundColor: colors.border }]} />
          <View style={[styles.mapRoad, styles.roadV2, { backgroundColor: colors.border }]} />

          {/* Map Pins representing car locations */}
          {vehicles.map((car, index) => {
            // Mock some offsets based on car index for map positioning
            const topOffset = 150 + (index * 80) % 250;
            const leftOffset = 40 + (index * 110) % 280;
            const isSelected = activePin?.id === car.id;

            return (
              <TouchableOpacity
                key={car.id}
                style={[
                  styles.mapPin,
                  { top: topOffset, left: leftOffset },
                  isSelected && [styles.mapPinSelected, { shadowColor: colors.primary }]
                ]}
                onPress={() => setActivePin(car)}
              >
                <View style={[
                  styles.pinBubble, 
                  { backgroundColor: isSelected ? colors.primary : colors.cardBg, borderColor: colors.border }
                ]}>
                  <ThemedText style={[styles.pinText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                    ₹{(Number(car.pricePerDay) / 1000).toFixed(1)}k
                  </ThemedText>
                </View>
                <View style={[styles.pinTail, { borderTopColor: isSelected ? colors.primary : colors.cardBg }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Floating Selected Car Card at bottom of Map */}
        {activePin && (
          <View style={[styles.mapFloatingCardContainer, { maxWidth: MaxContentWidth }]}>
            <TouchableOpacity
              style={[styles.floatingCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => router.push({
                pathname: `/details/${activePin.id}`,
                params: { startDate, endDate }
              })}
            >
              <Image source={{ uri: activePin.images.split(',')[0] }} style={styles.floatingCardImage} />
              <View style={styles.floatingCardContent}>
                <ThemedText style={styles.floatingCarName}>{activePin.make} {activePin.model}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {activePin.transmission} • {activePin.fuelType}
                </ThemedText>
                <View style={styles.floatingCardFooter}>
                  <ThemedText style={[styles.floatingPrice, { color: colors.primary }]}>
                    ₹{Number(activePin.pricePerDay).toLocaleString('en-IN')}/day
                  </ThemedText>
                  <View style={styles.ratingRow}>
                    <Star size={12} color="#FBBF24" fill="#FBBF24" />
                    <ThemedText style={styles.floatingRatingText}>
                      {getAverageRating(activePin.reviews)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={{ width: 48, height: 48, resizeMode: 'contain' }} 
          />
          <View>
            <ThemedText type="title" style={styles.logoText}>Safar Self Drive</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {user ? `Welcome, ${user.firstName}!` : 'Your Journey. Your Rules.'}
            </ThemedText>
          </View>
        </View>
        {user ? (
          <TouchableOpacity 
            style={[styles.profileBtn, { backgroundColor: colors.backgroundElement }]}
            onPress={() => router.push('/wallet')}
          >
            <User size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <LogIn size={18} color="#FFFFFF" />
            <ThemedText style={styles.loginBtnText}>Login</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Gujarat Dual Services Announcement Card */}
        <View style={{
          marginHorizontal: Spacing.three,
          marginTop: Spacing.one,
          marginBottom: Spacing.two,
          padding: Spacing.three,
          borderRadius: 16,
          backgroundColor: colors.cardBg,
          borderColor: colors.border,
          borderWidth: 1,
        }}>
          <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#F47B20', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Gujarat's Premier Car Portal
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <View style={{ flex: 1, backgroundColor: '#F47B2015', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#F47B2040' }}>
              <ThemedText style={{ fontWeight: 'bold', fontSize: 12, color: '#F47B20' }}>🔑 Self Drive</ThemedText>
              <ThemedText style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Private Number Vehicles</ThemedText>
            </View>
            <View style={{ flex: 1, backgroundColor: '#5B1F7C15', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#5B1F7C40' }}>
              <ThemedText style={{ fontWeight: 'bold', fontSize: 12, color: '#7B3FA0' }}>🚖 Taxi with Driver</ThemedText>
              <ThemedText style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Per KM Rate Across Gujarat</ThemedText>
            </View>
          </View>
        </View>

        {/* Search Parameters Box */}
        <View style={[styles.searchBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          {/* City Selector */}
          <View style={styles.searchRow}>
            <MapPin size={18} color={colors.primary} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.one }}>
              {CITIES.map(city => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.cityTab,
                    selectedCity === city && [styles.cityTabActive, { backgroundColor: colors.backgroundElement }]
                  ]}
                  onPress={() => setSelectedCity(city)}
                >
                  <ThemedText style={[styles.cityTabText, selectedCity === city && { color: colors.primary, fontWeight: 'bold' }]}>
                    {city}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.subDivider, { backgroundColor: colors.border }]} />

          {/* Date Picker row */}
          <View style={styles.searchRow}>
            <Calendar size={18} color={colors.secondary} />
            <View style={styles.dateInputs}>
              <View style={styles.dateInputWrapper}>
                <ThemedText type="small" style={styles.dateLabel}>Start Date</ThemedText>
                <TextInput
                  style={[styles.dateInput, { color: colors.text }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
              </View>
              <View style={[styles.verLine, { backgroundColor: colors.border }]} />
              <View style={styles.dateInputWrapper}>
                <ThemedText type="small" style={styles.dateLabel}>End Date</ThemedText>
                <TextInput
                  style={[styles.dateInput, { color: colors.text }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Filter bar (Sticky) */}
        <View style={[styles.stickyFilterBar, { backgroundColor: colors.background }]}>
          <View style={styles.searchBarContainer}>
            <Search size={16} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
              placeholder="Search make or model..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterControlsRow}>
            {/* Category pills list */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryPill,
                    { backgroundColor: colors.cardBg, borderColor: colors.border },
                    selectedCategory === category && [styles.categoryPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <ThemedText style={[
                    styles.categoryText, 
                    { color: colors.textSecondary },
                    selectedCategory === category && { color: '#FFFFFF', fontWeight: 'bold' }
                  ]}>
                    {category}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* List/Map View toggle */}
            <TouchableOpacity
              style={[styles.viewToggle, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            >
              {viewMode === 'list' ? (
                <Map size={18} color={colors.primary} />
              ) : (
                <List size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Listings */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : viewMode === 'list' ? (
          vehicles.length === 0 ? (
            <View style={styles.centerContainer}>
              <ThemedText style={{ color: colors.textSecondary }}>No vehicles found in {selectedCity}</ThemedText>
            </View>
          ) : (
            <FlatList
              data={vehicles}
              renderItem={renderVehicleCard}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )
        ) : (
          renderMapView()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  searchBox: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  citySelector: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  cityTab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
  },
  cityTabActive: {
    // shadow applied in JS
  },
  cityTabText: {
    fontSize: 14,
  },
  dateInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateInput: {
    fontSize: 14,
    fontWeight: 'bold',
    padding: 0,
  },
  verLine: {
    width: 1,
    height: 30,
    marginHorizontal: Spacing.two,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  subDivider: {
    height: 1,
  },
  stickyFilterBar: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    zIndex: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.four + 4,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingLeft: Spacing.five + 12,
    paddingRight: Spacing.three,
    fontSize: 14,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  categoryScroll: {
    gap: Spacing.one,
    paddingRight: Spacing.three,
  },
  categoryPill: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillActive: {
    // applied dynamically
  },
  categoryText: {
    fontSize: 13,
  },
  viewToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
    gap: Spacing.half,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailsBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: 8,
  },
  detailsBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  mapContainer: {
    height: 480,
    marginTop: Spacing.two,
    overflow: 'hidden',
    position: 'relative',
  },
  mapGrid: {
    flex: 1,
    position: 'relative',
  },
  mapRoad: {
    position: 'absolute',
    opacity: 0.4,
  },
  roadH1: {
    top: 180,
    left: 0,
    right: 0,
    height: 24,
  },
  roadH2: {
    top: 360,
    left: 0,
    right: 0,
    height: 20,
  },
  roadV1: {
    top: 0,
    bottom: 0,
    left: 120,
    width: 24,
  },
  roadV2: {
    top: 0,
    bottom: 0,
    left: 280,
    width: 20,
  },
  mapPin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  mapPinSelected: {
    zIndex: 5,
    transform: [{ scale: 1.1 }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  pinBubble: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pinText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
    borderRightWidth: 6,
    borderRightColor: 'transparent',
    borderTopWidth: 6,
    marginTop: -1,
  },
  mapFloatingCardContainer: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  floatingCard: {
    flexDirection: 'row',
    width: '100%',
    padding: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  floatingCardImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  floatingCardContent: {
    flex: 1,
    marginLeft: Spacing.two,
    justifyContent: 'center',
  },
  floatingCarName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  floatingCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  floatingPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  floatingRatingText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
