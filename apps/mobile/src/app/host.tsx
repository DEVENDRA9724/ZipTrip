import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { Landmark, LogIn, Plus, Sparkles, Car, IndianRupee, Layers, ChevronRight, Check } from 'lucide-react-native';

const CAR_TEMPLATES = [
  { name: 'Red SUV Offroad', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600' },
  { name: 'Sleek Black Sedan', url: 'https://images.unsplash.com/photo-1605558158359-18c1480b868e?auto=format&fit=crop&q=80&w=600' },
  { name: 'Vibrant Blue Hatchback', url: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&q=80&w=600' },
  { name: 'Luxury Sports Sedan', url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=600' },
  { name: 'White Electric SUV', url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=600' },
];

export default function HostScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const authContext = require('@/context/AuthContext');
  const { user } = authContext.useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [hostCars, setHostCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);

  // Form States
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2024');
  const [category, setCategory] = useState('SUV');
  const [transmission, setTransmission] = useState('Automatic');
  const [fuelType, setFuelType] = useState('Petrol');
  const [seats, setSeats] = useState('5');
  const [pricePerDay, setPricePerDay] = useState('');
  const [locationCity, setLocationCity] = useState('Mumbai');
  const [selectedPhoto, setSelectedPhoto] = useState(CAR_TEMPLATES[0].url);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchHostData();
      }
    }, [user])
  );

  const fetchHostData = async () => {
    setLoading(true);
    try {
      // Fetch host bookings
      const bookingsData = await apiRequest('/bookings/host-bookings');
      setBookings(bookingsData);

      // Fetch all cars in the city to filter host's cars
      // (Alternative would be a dedicated host endpoint, but since all listings return hostId, we can filter locally!)
      const allVehicles = await apiRequest(`/vehicles?city=Mumbai`);
      const allDelhi = await apiRequest(`/vehicles?city=Delhi`);
      const allBlr = await apiRequest(`/vehicles?city=Bangalore`);
      
      const combined = [...allVehicles, ...allDelhi, ...allBlr];
      const filtered = combined.filter((car: any) => car.hostId === user.id);
      
      // Remove duplicates just in case
      const uniqueCars = filtered.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setHostCars(uniqueCars);
    } catch (error) {
      console.error('Error fetching host data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCar = async () => {
    if (!make || !model || !pricePerDay) {
      Alert.alert('Error', 'Please fill in make, model, and price per day');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          make,
          model,
          year,
          category,
          transmission,
          fuelType,
          seats,
          pricePerDay,
          locationCity,
          images: selectedPhoto,
        }),
      });

      Alert.alert('Success', 'Your vehicle has been listed and is now ACTIVE!');
      setWizardVisible(false);
      
      // Reset form
      setMake('');
      setModel('');
      setPricePerDay('');
      
      fetchHostData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to list car');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate statistics
  const totalEarnings = bookings
    .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
    .reduce((acc, curr) => acc + Number(curr.totalAmount), 0);

  // Guest State
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">Host Center</ThemedText>
        </View>
        <View style={styles.center}>
          <Car size={48} color={colors.textSecondary} style={{ marginBottom: Spacing.three }} />
          <ThemedText style={styles.promptTitle}>Earn with Your Car</ThemedText>
          <ThemedText type="small" style={[styles.promptDesc, { color: colors.textSecondary }]}>
            Sign in to list your idle cars, track bookings, and manage host payouts.
          </ThemedText>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <LogIn size={18} color="#FFFFFF" />
            <ThemedText style={styles.loginBtnText}>Sign In</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title">Host Center</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>Earn money on your vehicles</ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.addVehicleBtn, { backgroundColor: colors.primary }]}
            onPress={() => setWizardVisible(true)}
          >
            <Plus size={16} color="#FFFFFF" />
            <ThemedText style={styles.addVehicleBtnText}>List Car</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <IndianRupee size={20} color={colors.primary} style={{ marginBottom: 4 }} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>Total Earnings</ThemedText>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={styles.statVal}>₹{totalEarnings.toLocaleString('en-IN')}</ThemedText>
            )}
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Car size={20} color={colors.secondary} style={{ marginBottom: 4 }} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>My Fleet</ThemedText>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={styles.statVal}>{hostCars.length} Cars</ThemedText>
            )}
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Layers size={20} color={colors.accent} style={{ marginBottom: 4 }} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>Bookings Recd</ThemedText>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={styles.statVal}>{bookings.length} Bookings</ThemedText>
            )}
          </View>
        </View>

        {/* List of Host's Cars */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>My Vehicles ({hostCars.length})</ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: Spacing.four }} />
        ) : hostCars.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Sparkles size={24} color={colors.textSecondary} style={{ marginBottom: 8 }} />
            <ThemedText style={{ color: colors.textSecondary, textAlign: 'center' }}>
              You haven't listed any cars yet. Tap 'List Car' above to start earning!
            </ThemedText>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {hostCars.map(car => {
              const rating = car.reviews?.length > 0 
                ? (car.reviews.reduce((a: number, c: any) => a + c.rating, 0) / car.reviews.length).toFixed(1)
                : 'New';

              return (
                <View key={car.id} style={[styles.carItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <Image source={{ uri: car.images.split(',')[0] }} style={styles.carItemImage} />
                  <View style={styles.carItemContent}>
                    <ThemedText style={styles.carItemTitle}>{car.make} {car.model}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary }}>
                      {car.locationCity} • {car.category} • ₹{Number(car.pricePerDay).toLocaleString('en-IN')}/day
                    </ThemedText>
                    <View style={styles.badgeRow}>
                      <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                        <ThemedText type="small" style={{ color: colors.success, fontWeight: 'bold', fontSize: 10 }}>
                          {car.status}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" style={{ color: colors.accent, fontWeight: 'bold' }}>
                        ★ {rating}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Host Bookings Received */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Bookings Received ({bookings.length})</ThemedText>
        </View>

        {bookings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Landmark size={24} color={colors.textSecondary} style={{ marginBottom: 8 }} />
            <ThemedText style={{ color: colors.textSecondary, textAlign: 'center' }}>
              No rental bookings received for your cars yet.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.bookingsContainer}>
            {bookings.map(booking => (
              <View key={booking.id} style={[styles.bookingItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.bookingHeader}>
                  <ThemedText style={styles.bookingRef}>{booking.bookingRef}</ThemedText>
                  <ThemedText type="small" style={{ 
                    color: booking.status === 'CONFIRMED' ? colors.success : booking.status === 'CANCELLED' ? colors.error : colors.text 
                  }}>
                    {booking.status}
                  </ThemedText>
                </View>
                
                <ThemedText style={styles.bookingCarName}>
                  {booking.vehicle.make} {booking.vehicle.model}
                </ThemedText>
                
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Customer: {booking.customer.firstName} {booking.customer.lastName}
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Phone: {booking.customer.phone}
                </ThemedText>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.bookingFooter}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText style={[styles.bookingAmount, { color: colors.primary }]}>
                    ₹{Number(booking.totalAmount).toLocaleString()}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* List Car Wizard Modal */}
      <Modal visible={wizardVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Host Your Car</ThemedText>
              <TouchableOpacity onPress={() => setWizardVisible(false)}>
                <ThemedText style={{ color: colors.error, fontWeight: 'bold' }}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Car Make</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    placeholder="e.g. Maruti, Honda"
                    placeholderTextColor={colors.textSecondary}
                    value={make}
                    onChangeText={setMake}
                  />
                </View>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Car Model</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    placeholder="e.g. Swift, City"
                    placeholderTextColor={colors.textSecondary}
                    value={model}
                    onChangeText={setModel}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Year</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Price Per Day (₹)</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    placeholder="e.g. 2500"
                    placeholderTextColor={colors.textSecondary}
                    value={pricePerDay}
                    onChangeText={setPricePerDay}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Category</ThemedText>
                  <View style={[styles.selectContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    {/* Simplified selector logic */}
                    <TextInput
                      style={[styles.selectInput, { color: colors.text }]}
                      value={category}
                      onChangeText={setCategory}
                      placeholder="SUV, Sedan, Electric..."
                    />
                  </View>
                </View>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>City</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    value={locationCity}
                    onChangeText={setLocationCity}
                    placeholder="Mumbai, Delhi..."
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Transmission</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    value={transmission}
                    onChangeText={setTransmission}
                    placeholder="Manual / Automatic"
                  />
                </View>
                <View style={styles.formCol}>
                  <ThemedText style={styles.formLabel}>Fuel Type</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    value={fuelType}
                    onChangeText={setFuelType}
                    placeholder="Petrol/Diesel/Electric"
                  />
                </View>
              </View>

              {/* Photo Selector Templates */}
              <ThemedText style={styles.formLabel}>Select Car Cover Image</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoTemplates}>
                {CAR_TEMPLATES.map(template => {
                  const isSelected = selectedPhoto === template.url;
                  return (
                    <TouchableOpacity
                      key={template.name}
                      style={[styles.photoTemplateCard, isSelected && [styles.photoSelected, { borderColor: colors.primary }]]}
                      onPress={() => setSelectedPhoto(template.url)}
                    >
                      <Image source={{ uri: template.url }} style={styles.templateImage} />
                      <ThemedText type="small" style={styles.templateName} numberOfLines={1}>{template.name}</ThemedText>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                          <Check size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSubmitCar}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>List Vehicle Now</ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  promptDesc: {
    textAlign: 'center',
    marginBottom: Spacing.four,
    lineHeight: 20,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: 10,
    gap: Spacing.two,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 8,
    gap: Spacing.one,
  },
  addVehicleBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two + 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statVal: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionHeader: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyBox: {
    marginHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  listContainer: {
    marginHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  carItem: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
    alignItems: 'center',
  },
  carItemImage: {
    width: 64,
    height: 48,
    borderRadius: 6,
    resizeMode: 'cover',
  },
  carItemContent: {
    flex: 1,
    marginLeft: Spacing.three,
  },
  carItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bookingsContainer: {
    marginHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  bookingItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookingRef: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  bookingCarName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingAmount: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalForm: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  formCol: {
    flex: 1,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  selectContainer: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
  },
  selectInput: {
    height: '100%',
    fontSize: 14,
  },
  photoTemplates: {
    gap: Spacing.two,
    marginTop: 4,
    marginBottom: Spacing.four,
    paddingRight: Spacing.three,
  },
  photoTemplateCard: {
    width: 100,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoSelected: {
    // border set dynamically
  },
  templateImage: {
    width: '100%',
    height: 60,
    resizeMode: 'cover',
  },
  templateName: {
    fontSize: 10,
    padding: 4,
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
