import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  apiRequest,
  getVehicleImageSource,
  getCarDistance,
  getVehicleTerms,
} from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Gauge,
  ShieldCheck,
  Users,
  Fuel,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react-native';

export default function VehicleDetailsScreen() {
  const { id, startDate: paramStart, endDate: paramEnd } = useLocalSearchParams<{
    id: string;
    startDate: string;
    endDate: string;
  }>();

  const { user } = require('@/context/AuthContext').useAuth();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(paramStart || '2026-11-12');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(paramEnd || '2026-11-13');
  const [endTime, setEndTime] = useState('10:00 AM');
  const [pickupPickerOpen, setPickupPickerOpen] = useState(false);
  const [dropoffPickerOpen, setDropoffPickerOpen] = useState(false);

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

  const terms = getVehicleTerms(vehicle);
  const distance = getCarDistance(vehicle);
  const totalDays = calculateDays();
  const pricePerDay = Number(vehicle.pricePerDay || 2500);
  const baseRent = pricePerDay * totalDays;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#1E1B2E" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {vehicle.make} {vehicle.model}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Studio Image Stage */}
        <View style={styles.imageStage}>
          <Image
            source={getVehicleImageSource(vehicle)}
            style={styles.studioImage}
            resizeMode="cover"
          />
          <View style={styles.verifiedPill}>
            <ShieldCheck size={14} color="#0D9488" strokeWidth={2.5} />
            <Text style={styles.verifiedPillText}>Verified Fleet • Pre-Inspected</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title & Category */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>
                {vehicle.make} {vehicle.model}
              </Text>
              <Text style={styles.subText}>
                {vehicle.year || 2024} • {vehicle.category || 'SUV'} • {vehicle.locationCity || 'Ahmedabad'} Hub
              </Text>
            </View>
            <View style={styles.rateBox}>
              <Text style={styles.rateAmount}>₹{pricePerDay.toLocaleString('en-IN')}</Text>
              <Text style={styles.rateUnit}>per day</Text>
            </View>
          </View>

          {/* Interactive Trip Schedule Selector */}
          <Text style={styles.sectionHeading}>Trip Schedule (Tap to Change)</Text>
          <View style={styles.scheduleRow}>
            <TouchableOpacity
              style={styles.dateSelectorBtn}
              activeOpacity={0.85}
              onPress={() => setPickupPickerOpen(true)}
            >
              <Text style={styles.dateLabel}>PICK-UP DATE & TIME</Text>
              <View style={styles.dateValRow}>
                <Calendar size={14} color="#FF6000" />
                <Text style={styles.dateVal}>{startDate}</Text>
              </View>
              <View style={styles.timeValRow}>
                <Clock size={12} color="#64748B" />
                <Text style={styles.timeVal}>{startTime}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateSelectorBtn}
              activeOpacity={0.85}
              onPress={() => setDropoffPickerOpen(true)}
            >
              <Text style={styles.dateLabel}>RETURN DATE & TIME</Text>
              <View style={styles.dateValRow}>
                <Calendar size={14} color="#2D114D" />
                <Text style={styles.dateVal}>{endDate}</Text>
              </View>
              <View style={styles.timeValRow}>
                <Clock size={12} color="#64748B" />
                <Text style={styles.timeVal}>{endTime}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 4-Spec Grid */}
          <View style={styles.specsGrid}>
            <View style={styles.specCard}>
              <Gauge size={18} color="#2D114D" />
              <Text style={styles.specLabel}>Transmission</Text>
              <Text style={styles.specValue}>{vehicle.transmission || 'Automatic'}</Text>
            </View>
            <View style={styles.specCard}>
              <Fuel size={18} color="#FF6000" />
              <Text style={styles.specLabel}>Fuel Type</Text>
              <Text style={styles.specValue}>{vehicle.fuelType || 'Petrol'}</Text>
            </View>
            <View style={styles.specCard}>
              <Users size={18} color="#2D114D" />
              <Text style={styles.specLabel}>Capacity</Text>
              <Text style={styles.specValue}>{vehicle.seats || 5} Seats</Text>
            </View>
            <View style={styles.specCard}>
              <MapPin size={18} color="#FF6000" />
              <Text style={styles.specLabel}>Hub Distance</Text>
              <Text style={styles.specValue}>{distance} km away</Text>
            </View>
          </View>

          {/* Pickup Hub Location Box */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <MapPin size={16} color="#FF6000" />
              <Text style={styles.infoCardTitle}>Pickup & Return Hub</Text>
            </View>
            <Text style={styles.infoCardBody}>
              {vehicle.pickupAddress || `${vehicle.locationCity || 'Ahmedabad'} Verified Hub, Gujarat`}
            </Text>
            <View style={styles.greenRow}>
              <CheckCircle2 size={14} color="#0D9488" />
              <Text style={styles.greenText}>8-Angle Photo Inspection performed at handover</Text>
            </View>
          </View>

          {/* Transparent Rental Terms */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <FileText size={16} color="#2D114D" />
              <Text style={styles.infoCardTitle}>Rental Package & Policies</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termKey}>Included Kilometres</Text>
              <Text style={styles.termVal}>{terms.kmPerDay} km / day</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termKey}>Extra Km Charge</Text>
              <Text style={styles.termVal}>₹{terms.excessKmRate} / km</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termKey}>Refundable Security Deposit</Text>
              <Text style={styles.termVal}>₹{terms.securityDeposit.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termKey}>Tax Invoicing</Text>
              <Text style={styles.termVal}>Dual GST Invoice (80/20 Split)</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Bar */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>
            Base Fare ({totalDays} {totalDays === 1 ? 'Day' : 'Days'})
          </Text>
          <Text style={styles.footerPrice}>₹{baseRent.toLocaleString('en-IN')}</Text>
          <Text style={styles.footerSub}>+ ₹{terms.securityDeposit.toLocaleString('en-IN')} refundable deposit</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.bookBtn}
          onPress={() => {
            if (!user) {
              router.push('/auth/login');
              return;
            }
            router.push({
              pathname: '/booking/confirm',
              params: { vehicleId: String(vehicle.id), startDate, endDate },
            });
          }}
        >
          <Text style={styles.bookBtnText}>{user ? 'Proceed to Book' : 'Log In to Book'}</Text>
        </TouchableOpacity>
      </View>

      {/* Date & Time Modals */}
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
    </SafeAreaView>
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
    maxWidth: '72%',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageStage: {
    width: '100%',
    height: 245,
    backgroundColor: '#EFF2F6',
    position: 'relative',
  },
  studioImage: {
    width: '100%',
    height: '100%',
  },
  verifiedPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  verifiedPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065F46',
  },
  body: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },
  rateBox: {
    alignItems: 'flex-end',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rateAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6000',
  },
  rateUnit: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9A3412',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B2E',
    marginBottom: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dateSelectorBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  dateLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '800',
    marginBottom: 4,
  },
  dateValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E1B2E',
  },
  timeValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  timeVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FF6000',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  specCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  specLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  infoCardBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 8,
  },
  greenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  greenText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  termKey: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  termVal: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '800',
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
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  footerSub: {
    fontSize: 10.5,
    color: '#0D9488',
    fontWeight: '700',
  },
  bookBtn: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
