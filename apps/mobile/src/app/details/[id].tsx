import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { ArrowLeft, Star, Calendar, MapPin, Gauge, Shield, Users, Fuel } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function VehicleDetailsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  
  const { id, startDate: paramStart, endDate: paramEnd } = useLocalSearchParams<{ id: string; startDate: string; endDate: string }>();

  const authContext = require('@/context/AuthContext');
  const { user } = authContext.useAuth();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Date selection states
  const [startDate, setStartDate] = useState(paramStart || '2026-06-28');
  const [endDate, setEndDate] = useState(paramEnd || '2026-06-29');

  useEffect(() => {
    fetchVehicleDetails();
  }, [id]);

  const fetchVehicleDetails = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/vehicles/${id}`);
      setVehicle(data);
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
      Alert.alert('Error', 'Could not load vehicle details.');
    } finally {
      setLoading(false);
    }
  };

  const getAverageRating = (reviews: any[]) => {
    if (!reviews || reviews.length === 0) return 'New';
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const calculateDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return 1;
    }
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ThemedText style={{ color: colors.textSecondary }}>Vehicle not found</ThemedText>
      </View>
    );
  }

  const images = vehicle.images.split(',');
  const rating = getAverageRating(vehicle.reviews);
  const totalDays = calculateDays();
  const pricePerDay = Number(vehicle.pricePerDay);
  const totalCost = pricePerDay * totalDays;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header Overlays */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.circleBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Car Image Carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carousel}>
          {images.map((imgUrl: string, idx: number) => (
            <Image key={idx} source={{ uri: imgUrl }} style={styles.carouselImage} />
          ))}
        </ScrollView>

        <View style={styles.body}>
          {/* Title & Brand */}
          <View style={styles.mainDetails}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.titleText}>{vehicle.make} {vehicle.model}</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2 }}>
                {vehicle.year} • {vehicle.category} • listed by {vehicle.host.firstName}
              </ThemedText>
            </View>

            <View style={[styles.ratingBadge, { backgroundColor: colors.backgroundElement }]}>
              <Star size={16} color="#FBBF24" fill="#FBBF24" />
              <ThemedText style={styles.ratingText}>{rating}</ThemedText>
            </View>
          </View>

          {/* Quick Specifications list */}
          <View style={styles.specsGrid}>
            <View style={[styles.specItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Gauge size={20} color={colors.primary} />
              <ThemedText type="small" style={styles.specLabel}>Transmission</ThemedText>
              <ThemedText style={styles.specValue}>{vehicle.transmission}</ThemedText>
            </View>

            <View style={[styles.specItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Fuel size={20} color={colors.secondary} />
              <ThemedText type="small" style={styles.specLabel}>Fuel Type</ThemedText>
              <ThemedText style={styles.specValue}>{vehicle.fuelType}</ThemedText>
            </View>

            <View style={[styles.specItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Users size={20} color={colors.accent} />
              <ThemedText type="small" style={styles.specLabel}>Seats</ThemedText>
              <ThemedText style={styles.specValue}>{vehicle.seats} Seats</ThemedText>
            </View>

            <View style={[styles.specItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <MapPin size={20} color={colors.primary} />
              <ThemedText type="small" style={styles.specLabel}>City</ThemedText>
              <ThemedText style={styles.specValue}>{vehicle.locationCity}</ThemedText>
            </View>
          </View>

          {/* Insurance Card */}
          <View style={[styles.insuranceCard, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
            <Shield size={20} color={colors.success} />
            <View style={styles.insuranceText}>
              <ThemedText style={[styles.insuranceTitle, { color: colors.success }]}>Comprehensive Insurance Included</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Zero liability damage policy protects your trip.</ThemedText>
            </View>
          </View>

          {/* Date Selector row */}
          <ThemedText style={styles.sectionTitle}>Rental Duration</ThemedText>
          <View style={[styles.dateSelector, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Calendar size={18} color={colors.primary} style={{ marginRight: Spacing.two }} />
            <View style={styles.dateInputsRow}>
              <View style={styles.dateField}>
                <ThemedText type="small" style={styles.dateLabel}>Start Date</ThemedText>
                <TextInput
                  style={[styles.dateVal, { color: colors.text }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  maxLength={10}
                />
              </View>
              <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
              <View style={styles.dateField}>
                <ThemedText type="small" style={styles.dateLabel}>End Date</ThemedText>
                <TextInput
                  style={[styles.dateVal, { color: colors.text }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* Reviews List */}
          <ThemedText style={styles.sectionTitle}>Reviews ({vehicle.reviews.length})</ThemedText>
          {vehicle.reviews.length === 0 ? (
            <ThemedText type="small" style={{ color: colors.textSecondary, fontStyle: 'italic', marginVertical: Spacing.one }}>
              No reviews listed for this vehicle yet.
            </ThemedText>
          ) : (
            <View style={styles.reviewsList}>
              {vehicle.reviews.map((review: any) => (
                <View key={review.id} style={[styles.reviewItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <ThemedText style={styles.reviewAuthor}>
                      {review.author.firstName} {review.author.lastName}
                    </ThemedText>
                    <View style={styles.starRow}>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          color={i < review.rating ? '#FBBF24' : colors.backgroundElement}
                          fill={i < review.rating ? '#FBBF24' : 'transparent'}
                        />
                      ))}
                    </View>
                  </View>
                  <ThemedText type="small" style={[styles.reviewComment, { color: colors.textSecondary }]}>
                    {review.comment}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Book Now Footer */}
      <View style={[styles.footer, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
        <View>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>Total Rent ({totalDays} days)</ThemedText>
          <ThemedText style={[styles.footerPrice, { color: colors.primary }]}>
            ₹{totalCost.toLocaleString('en-IN')}
          </ThemedText>
        </View>

        {user ? (
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({
              pathname: '/booking/confirm',
              params: { vehicleId: vehicle.id, startDate, endDate }
            })}
          >
            <ThemedText style={styles.bookBtnText}>Book Now</ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/auth/login')}
          >
            <ThemedText style={styles.bookBtnText}>Login to Book</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    zIndex: 10,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  carousel: {
    height: 250,
  },
  carouselImage: {
    width: width,
    height: 250,
    resizeMode: 'cover',
  },
  body: {
    padding: Spacing.three,
  },
  mainDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 8,
    gap: Spacing.half,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  specItem: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: 2,
  },
  specLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
  specValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  insuranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  insuranceText: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  dateInputsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 9,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  dateVal: {
    fontSize: 13,
    fontWeight: 'bold',
    padding: 0,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 30,
    marginHorizontal: Spacing.three,
  },
  reviewsList: {
    gap: Spacing.two,
  },
  reviewItem: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewComment: {
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    borderTopWidth: 1,
    zIndex: 10,
  },
  footerPrice: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  bookBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
