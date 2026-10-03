import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { ArrowLeft, Wallet, CheckCircle, Info, Calendar, Sparkles } from 'lucide-react-native';

export default function BookingConfirmScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const { vehicleId, startDate, endDate } = useLocalSearchParams<{ vehicleId: string; startDate: string; endDate: string }>();

  const [vehicle, setVehicle] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [successBooking, setSuccessBooking] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [vehicleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const vData = await apiRequest(`/vehicles/${vehicleId}`);
      setVehicle(vData);

      const wData = await apiRequest('/wallet');
      setWalletBalance(Number(wData.balance));
    } catch (error) {
      console.error('Error fetching checkout data:', error);
      Alert.alert('Error', 'Failed to retrieve vehicle or wallet status.');
    } finally {
      setLoading(false);
    }
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

  const handleConfirmBooking = async () => {
    setBookingLoading(true);
    try {
      const res = await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate,
        }),
      });
      setSuccessBooking(res);
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'An error occurred during booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  const formatDateString = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Success State
  if (successBooking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContent}>
          <CheckCircle size={64} color={colors.success} style={{ marginBottom: Spacing.four }} />
          <ThemedText style={styles.successTitle}>Booking Confirmed!</ThemedText>
          <ThemedText type="small" style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            Your ride has been successfully reserved. The reference number is{' '}
            <ThemedText style={{ fontWeight: 'bold', color: colors.text }}>{successBooking.bookingRef}</ThemedText>.
          </ThemedText>

          <View style={[styles.detailsBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Image source={{ uri: successBooking.vehicle.images.split(',')[0] }} style={styles.successCarImage} />
            <ThemedText style={styles.successCarName}>
              {successBooking.vehicle.make} {successBooking.vehicle.model}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Dates: {formatDateString(startDate)} - {formatDateString(endDate)}
            </ThemedText>
            <ThemedText style={[styles.successPrice, { color: colors.primary }]}>
              Paid: ₹{Number(successBooking.totalAmount).toLocaleString('en-IN')}
            </ThemedText>
          </View>

          <View style={styles.btnColumn}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/trips')}
            >
              <ThemedText style={styles.primaryBtnText}>View My Trips</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={() => router.replace('/')}
            >
              <ThemedText style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Back to Search</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const totalDays = calculateDays();
  const rentCost = Number(vehicle.pricePerDay) * totalDays;
  const platformFee = 150;
  const protectionFee = 250;
  const totalAmount = rentCost + platformFee + protectionFee;
  const hasFunds = walletBalance >= totalAmount;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.backgroundElement }]}>
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Trip Checkout</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Vehicle Mini Summary */}
        <View style={[styles.vehicleSummary, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Image source={{ uri: vehicle.images.split(',')[0] }} style={styles.carThumb} />
          <View style={styles.carText}>
            <ThemedText style={styles.carTitle}>{vehicle.make} {vehicle.model}</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {vehicle.category} • {vehicle.transmission} • {vehicle.fuelType}
            </ThemedText>
          </View>
        </View>

        {/* Date Summary */}
        <View style={[styles.rowSection, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Calendar size={18} color={colors.primary} />
          <View style={styles.rowContent}>
            <ThemedText style={styles.rowLabel}>Trip Dates</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {formatDateString(startDate)} - {formatDateString(endDate)} ({totalDays} {totalDays === 1 ? 'day' : 'days'})
            </ThemedText>
          </View>
        </View>

        {/* Price Breakout */}
        <View style={[styles.breakoutBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <ThemedText style={styles.breakoutTitle}>Price Summary</ThemedText>

          <View style={styles.priceRow}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Rental Charge (₹{Number(vehicle.pricePerDay).toLocaleString()}/day)
            </ThemedText>
            <ThemedText type="small" style={{ fontWeight: '600' }}>₹{rentCost.toLocaleString()}</ThemedText>
          </View>

          <View style={styles.priceRow}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>Platform Handling Fee</ThemedText>
            <ThemedText type="small" style={{ fontWeight: '600' }}>₹{platformFee}</ThemedText>
          </View>

          <View style={styles.priceRow}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>Zero Damage Waiver Fee</ThemedText>
            <ThemedText type="small" style={{ fontWeight: '600' }}>₹{protectionFee}</ThemedText>
          </View>

          <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />

          <View style={styles.priceRow}>
            <ThemedText style={{ fontWeight: 'bold' }}>Total Cost</ThemedText>
            <ThemedText style={{ fontWeight: 'bold', fontSize: 18, color: colors.primary }}>
              ₹{totalAmount.toLocaleString('en-IN')}
            </ThemedText>
          </View>
        </View>

        {/* Wallet Status */}
        <View style={[
          styles.walletBox,
          { backgroundColor: colors.cardBg, borderColor: hasFunds ? colors.success : colors.error }
        ]}>
          <Wallet size={20} color={hasFunds ? colors.success : colors.error} />
          <View style={styles.walletText}>
            <ThemedText style={styles.walletTitle}>Safar Wallet Balance</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Available: ₹{walletBalance.toLocaleString('en-IN')}
            </ThemedText>
          </View>
          {hasFunds ? (
            <CheckCircle size={18} color={colors.success} />
          ) : (
            <TouchableOpacity 
              style={[styles.topupBtn, { backgroundColor: colors.error }]}
              onPress={() => router.replace('/wallet')}
            >
              <ThemedText style={styles.topupBtnText}>Top Up</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {!hasFunds && (
          <View style={styles.insufficientWarning}>
            <Info size={14} color={colors.error} />
            <ThemedText type="small" style={{ color: colors.error, marginLeft: 4 }}>
              Add mock funds to your wallet to complete this booking.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Booking confirmation action */}
      <View style={[styles.checkoutFooter, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
        <View>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>Net Payable</ThemedText>
          <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>₹{totalAmount.toLocaleString('en-IN')}</ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmBtn, 
            { backgroundColor: hasFunds ? colors.primary : colors.backgroundSelected }
          ]}
          onPress={handleConfirmBooking}
          disabled={!hasFunds || bookingLoading}
        >
          {bookingLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ThemedText style={styles.confirmBtnText}>Confirm Rent</ThemedText>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 100,
    gap: Spacing.two,
  },
  vehicleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  carThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  carText: {
    marginLeft: Spacing.three,
    flex: 1,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowContent: {
    marginLeft: Spacing.three,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  breakoutBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  breakoutTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceDivider: {
    height: 1,
    marginVertical: 4,
  },
  walletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  walletText: {
    flex: 1,
    marginLeft: Spacing.three,
  },
  walletTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  topupBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 8,
  },
  topupBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  insufficientWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  checkoutFooter: {
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
  confirmBtn: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  successSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  detailsBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.five,
    gap: 4,
  },
  successCarImage: {
    width: 120,
    height: 90,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: Spacing.two,
  },
  successCarName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  successPrice: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: Spacing.one,
  },
  btnColumn: {
    width: '100%',
    gap: Spacing.two,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});
