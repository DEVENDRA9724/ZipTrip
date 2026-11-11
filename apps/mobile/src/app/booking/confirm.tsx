import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { apiRequest, getVehicleImageSource, getVehicleTerms } from '@/services/api';
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building2,
  FileText,
  MessageCircle,
  Phone,
  Camera,
} from 'lucide-react-native';

export default function BookingConfirmScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  const { vehicleId, startDate, endDate } = useLocalSearchParams<{
    vehicleId: string;
    startDate: string;
    endDate: string;
  }>();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [successBooking, setSuccessBooking] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [vehicleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const vData = await apiRequest(`/vehicles/${vehicleId}`);
      setVehicle(vData);
    } catch (error) {
      console.error('Error fetching checkout data:', error);
      Alert.alert('Error', 'Could not load vehicle checkout details.');
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
    if (!acceptedTerms) {
      Alert.alert('Lease Agreement Required', 'Please accept the Digital Car Sharing Lease Agreement before paying.');
      return;
    }
    setBookingLoading(true);
    try {
      const requestKey = 'mob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      const created = await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          requestKey,
          startDate,
          endDate,
        }),
      });

      // Acknowledge Digital Lease Agreement & Confirm Payment
      await apiRequest(`/bookings/${created.id}/agreement/acknowledge`, {
        method: 'POST',
      }).catch(() => {});

      const paid = await apiRequest(`/bookings/${created.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          method: paymentMethod,
          gatewayProvider: 'Razorpay',
        }),
      });

      setSuccessBooking(paid || created);
    } catch (e: any) {
      const msg = e.message || 'An error occurred during booking.';
      if (msg.toLowerCase().includes('verification') || msg.toLowerCase().includes('kyc')) {
        Alert.alert(
          'Driver e-KYC Required',
          msg,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Complete e-KYC Now', onPress: () => router.push('/verification') },
          ]
        );
      } else {
        Alert.alert('Booking Notice', msg);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6000" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#64748B' }}>Vehicle not found</Text>
      </View>
    );
  }

  // Confirmed State
  if (successBooking) {
    const handleShareWhatsApp = () => {
      const text = `🚗 *SAFAR SELF DRIVE - BOOKING CONFIRMED*\n\n• *Booking Ref:* ${successBooking.bookingRef || '#SFR-' + successBooking.id}\n• *Vehicle:* ${vehicle.make} ${vehicle.model}\n• *Trip Dates:* ${formatDateString(startDate)} → ${formatDateString(endDate)}\n• *Pickup Location:* Swami Vivekanand Bridge, Ahmedabad\n• *Total Paid:* ₹${Number(successBooking.totalAmount).toLocaleString('en-IN')}\n• *24x7 Roadside Support:* +91 99000 00001\n\n*Verified by Govt. DigiLocker e-KYC. Present Driving Licence at Handover.*`;
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
      });
    };

    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <ScrollView contentContainerStyle={styles.successWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.successIconCircle}>
            <CheckCircle2 size={54} color="#059669" />
          </View>
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          <Text style={styles.successSub}>
            Booking Reference: <Text style={styles.refBold}>{successBooking.bookingRef || '#SFR-' + successBooking.id}</Text>
          </Text>

          <View style={styles.confirmedCard}>
            <Image
              source={getVehicleImageSource(vehicle)}
              style={styles.confirmedImage}
              resizeMode="cover"
            />
            <View style={{ padding: 14 }}>
              <Text style={styles.confirmedCarTitle}>
                {vehicle.make} {vehicle.model}
              </Text>
              <Text style={styles.confirmedMeta}>
                {formatDateString(startDate)} → {formatDateString(endDate)}
              </Text>
              <Text style={styles.confirmedPaid}>
                Total Paid: ₹{Number(successBooking.totalAmount).toLocaleString('en-IN')} (GST incl.)
              </Text>
            </View>
          </View>

          {/* WhatsApp Pass Button */}
          <TouchableOpacity
            style={styles.whatsAppPassBtn}
            onPress={handleShareWhatsApp}
            activeOpacity={0.88}
          >
            <MessageCircle size={18} color="#FFFFFF" />
            <Text style={styles.whatsAppPassBtnText}>Send Booking Pass to WhatsApp</Text>
          </TouchableOpacity>

          {/* 24x7 Helpline Callout */}
          <TouchableOpacity
            style={styles.rsaHelplineCard}
            onPress={() => Linking.openURL('tel:+919900000001')}
            activeOpacity={0.8}
          >
            <Phone size={15} color="#2D114D" />
            <Text style={styles.rsaHelplineText}>24x7 Gujarat Roadside Helpline: +91 99000 00001</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.replace({
                pathname: '/booking/agreement' as any,
                params: { id: String(successBooking.id) },
              })
            }
          >
            <Text style={styles.primaryBtnText}>View Digital Lease Agreement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/trips')}
          >
            <Text style={styles.secondaryBtnText}>Go to My Trips & Handover</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const terms = getVehicleTerms(vehicle);
  const totalDays = calculateDays();
  const baseFare = Number(vehicle.pricePerDay || 2500) * totalDays;
  const hostLeaseShare = Math.round(baseFare * 0.8);
  const platformFeeShare = baseFare - hostLeaseShare;
  const securityDeposit = terms.securityDeposit;
  const totalAmount = baseFare + securityDeposit;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#1E1B2E" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Review & Checkout</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Vehicle Summary */}
        <View style={styles.vehicleSummary}>
          <Image
            source={getVehicleImageSource(vehicle)}
            style={styles.carThumb}
            resizeMode="cover"
          />
          <View style={styles.carText}>
            <Text style={styles.carTitle}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.carSub}>
              {vehicle.year || 2024} • {vehicle.transmission} • {vehicle.fuelType}
            </Text>
            <Text style={styles.hubText}>{vehicle.locationCity || 'Ahmedabad'} Verified Hub</Text>
          </View>
        </View>

        {/* Trip Schedule */}
        <View style={styles.cardBox}>
          <View style={styles.cardHeaderRow}>
            <Calendar size={16} color="#FF6000" />
            <Text style={styles.cardBoxTitle}>Trip Schedule ({totalDays} {totalDays === 1 ? 'Day' : 'Days'})</Text>
          </View>
          <Text style={styles.scheduleDates}>
            {formatDateString(startDate)} (10:00 AM) → {formatDateString(endDate)} (10:00 AM)
          </Text>
          <Text style={styles.scheduleHint}>
            Includes {terms.kmPerDay * totalDays} km total allowance • ₹{terms.excessKmRate}/km excess
          </Text>
        </View>

        {/* Dual GST Tax Invoice Breakdown (80/20 Split) */}
        <View style={styles.cardBox}>
          <View style={styles.cardHeaderRow}>
            <FileText size={16} color="#2D114D" />
            <Text style={styles.cardBoxTitle}>Fare & Dual GST Invoice Breakdown</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceKey}>
              Base Trip Fare (₹{Number(vehicle.pricePerDay).toLocaleString('en-IN')} × {totalDays}d)
            </Text>
            <Text style={styles.priceVal}>₹{baseFare.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.subSplitBox}>
            <View style={styles.splitLine}>
              <Text style={styles.splitText}>• Part A: Vehicle Lease Invoice (80%)</Text>
              <Text style={styles.splitText}>₹{hostLeaseShare.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.splitLine}>
              <Text style={styles.splitText}>• Part B: Safar Platform Service Fee (20%)</Text>
              <Text style={styles.splitText}>₹{platformFeeShare.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceKey}>Refundable Security Deposit</Text>
            <Text style={[styles.priceVal, { color: '#0D9488' }]}>
              ₹{securityDeposit.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.totalKey}>Total Payable Now</Text>
            <Text style={styles.totalVal}>₹{totalAmount.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.cardBox}>
          <Text style={[styles.cardBoxTitle, { marginBottom: 10 }]}>Select Payment Method</Text>

          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'UPI' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('UPI')}
          >
            <Smartphone size={18} color={paymentMethod === 'UPI' ? '#FF6000' : '#64748B'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payOptionTitle}>UPI Instant Pay</Text>
              <Text style={styles.payOptionSub}>GPay, PhonePe, Paytm, BHIM UPI</Text>
            </View>
            <CheckCircle2 size={18} color={paymentMethod === 'UPI' ? '#FF6000' : '#CBD5E1'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'CARD' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('CARD')}
          >
            <CreditCard size={18} color={paymentMethod === 'CARD' ? '#FF6000' : '#64748B'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payOptionTitle}>Credit / Debit Card</Text>
              <Text style={styles.payOptionSub}>Visa, Mastercard, RuPay</Text>
            </View>
            <CheckCircle2 size={18} color={paymentMethod === 'CARD' ? '#FF6000' : '#CBD5E1'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'NETBANKING' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('NETBANKING')}
          >
            <Building2 size={18} color={paymentMethod === 'NETBANKING' ? '#FF6000' : '#64748B'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payOptionTitle}>NetBanking</Text>
              <Text style={styles.payOptionSub}>All major Indian banks supported</Text>
            </View>
            <CheckCircle2 size={18} color={paymentMethod === 'NETBANKING' ? '#FF6000' : '#CBD5E1'} />
          </TouchableOpacity>
        </View>

        {/* Lease Agreement Consent */}
        <TouchableOpacity
          style={styles.consentRow}
          activeOpacity={0.8}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
        >
          <ShieldCheck size={20} color={acceptedTerms ? '#0D9488' : '#94A3B8'} />
          <Text style={styles.consentText}>
            I agree to the Safar Self-Drive Digital Car Sharing Lease Agreement, 300 km/day limit, and 8-angle handover inspection rules.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Checkout Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total Payable</Text>
          <Text style={styles.footerPrice}>₹{totalAmount.toLocaleString('en-IN')}</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirmBooking}
          disabled={bookingLoading}
        >
          {bookingLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.confirmBtnText}>Pay & Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
    gap: 12,
  },
  vehicleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  carThumb: {
    width: 105,
    height: 74,
    borderRadius: 12,
    backgroundColor: '#EFF2F6',
  },
  carText: {
    flex: 1,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  carSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  hubText: {
    fontSize: 11.5,
    color: '#FF6000',
    fontWeight: '700',
    marginTop: 4,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  cardBoxTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  scheduleDates: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleHint: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  priceKey: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  priceVal: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  subSplitBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    gap: 4,
  },
  splitLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  totalKey: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  totalVal: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FF6000',
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  payOptionActive: {
    borderColor: '#FF6000',
    backgroundColor: '#FFF7ED',
  },
  payOptionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  payOptionSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  footerPrice: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
  },
  confirmBtn: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  successWrap: {
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  successSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 20,
  },
  refBold: {
    fontWeight: '900',
    color: '#2D114D',
  },
  confirmedCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 24,
  },
  confirmedImage: {
    width: '100%',
    height: 185,
    backgroundColor: '#EFF2F6',
  },
  confirmedCarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmedMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  confirmedPaid: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
    marginTop: 8,
  },
  whatsAppPassBtn: {
    width: '100%',
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#25D366',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 2,
  },
  whatsAppPassBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  rsaHelplineCard: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  rsaHelplineText: {
    color: '#2D114D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#FF6000',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#2D114D',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
