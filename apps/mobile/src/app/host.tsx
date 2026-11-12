import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { apiRequest, getVehicleImageSource } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  Car,
  Plus,
  Calendar,
  TrendingUp,
  Camera,
  Upload,
  X,
  Settings,
  Power,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const HOST_TABS = [
  { key: 'FLEET', label: 'My Listed Cars' },
  { key: 'MANAGE', label: 'Manage Car' },
  { key: 'EARNINGS', label: 'Bookings & Payouts' },
];

export const CAR_IMAGE_SLOTS = [
  { key: 'FRONT', label: '1. Front View', hint: 'Bumper, Grille & Plate' },
  { key: 'REAR', label: '2. Rear View', hint: 'Tailgate & Rear Plate' },
  { key: 'LEFT_SIDE', label: '3. Left Side', hint: 'Left Doors & Tyres' },
  { key: 'RIGHT_SIDE', label: '4. Right Side', hint: 'Driver Side Doors' },
  { key: 'FRONT_LEFT', label: '5. Front-Left Corner', hint: 'Front Left Fender' },
  { key: 'FRONT_RIGHT', label: '6. Front-Right Corner', hint: 'Front Right Fender' },
  { key: 'ODOMETER', label: '7. Odometer & Fuel', hint: 'Live KM & Fuel Cluster' },
  { key: 'INTERIOR', label: '8. Interior Cabin', hint: 'Front & Rear Seats' },
];

export default function HostDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'FLEET' | 'MANAGE' | 'EARNINGS'>('FLEET');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selected car for the "Manage Car" tab
  const [managedCarId, setManagedCarId] = useState<string | null>(null);
  const [managePrice, setManagePrice] = useState('3200');
  const [manageHub, setManageHub] = useState('SVP International Airport (T1)');
  const [manageCity, setManageCity] = useState('Ahmedabad');
  const [manageRegNo, setManageRegNo] = useState('GJ-01-WK-4590');
  const [manageKmLimit, setManageKmLimit] = useState('300');

  // Add New Car Modal
  const [addCarModalOpen, setAddCarModalOpen] = useState(false);
  const [carMake, setCarMake] = useState('Hyundai');
  const [carModel, setCarModel] = useState('Creta SX (O) AT');
  const [carYear, setCarYear] = useState('2025');
  const [carCity, setCarCity] = useState('Ahmedabad');
  const [carRate, setCarRate] = useState('2800');
  const [carRegNo, setCarRegNo] = useState('GJ-01-WK-8821');
  const [carAnglePhotos, setCarAnglePhotos] = useState<Record<string, string>>({});

  // Car Images Modal (For updating an existing car's images)
  const [imagesModalOpen, setImagesModalOpen] = useState(false);
  const [imagesTargetCar, setImagesTargetCar] = useState<any | null>(null);
  const [inspectPhotos, setInspectPhotos] = useState<Record<string, string>>({});

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 50) : Math.max(insets.top, 20);

  const loadHostData = useCallback(async () => {
    setLoading(true);
    try {
      const [vData, bData] = await Promise.all([
        apiRequest('/vehicles').catch(() => []),
        user ? apiRequest('/bookings/host-bookings').catch(() => []) : Promise.resolve([]),
      ]);
      const cleanFleet = (Array.isArray(vData) ? vData : []).filter(
        (v: any) => !String(v.model || '').toLowerCase().includes('taxi')
      );
      const list = cleanFleet.slice(0, 6);
      setVehicles(list);
      if (list.length > 0 && !managedCarId) {
        selectCarToManage(list[0]);
      }
      setBookings(Array.isArray(bData) ? bData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, managedCarId]);

  const selectCarToManage = (car: any) => {
    setManagedCarId(String(car.id));
    setManagePrice(String(car.pricePerDay || 2800));
    setManageCity(car.city || 'Ahmedabad');
    setManageHub(car.pickupHub || `${car.city || 'Ahmedabad'} Main Hub`);
    setManageRegNo(car.registrationNumber || 'GJ-01-WK-4590');
    setManageKmLimit(String(car.kmPerDay || 300));
  };

  useFocusEffect(
    useCallback(() => {
      loadHostData();
    }, [loadHostData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHostData();
    setRefreshing(false);
  };

  const captureOrPickAngle = async (
    angleKey: string,
    targetSetter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    mode: 'camera' | 'gallery'
  ) => {
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Permission', 'Please allow camera access in settings.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          targetSetter((prev) => ({ ...prev, [angleKey]: res.assets[0].uri }));
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Gallery Permission', 'Please allow photo library access.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          targetSetter((prev) => ({ ...prev, [angleKey]: res.assets[0].uri }));
        }
      }
    } catch {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!res.canceled && res.assets?.[0]?.uri) {
        targetSetter((prev) => ({ ...prev, [angleKey]: res.assets[0].uri }));
      }
    }
  };

  const uploadedAnglesCount = CAR_IMAGE_SLOTS.filter((a) => !!carAnglePhotos[a.key]).length;
  const inspectAnglesCount = CAR_IMAGE_SLOTS.filter((a) => !!inspectPhotos[a.key]).length;

  const handleCreateCarListing = () => {
    if (!carMake.trim() || !carModel.trim()) {
      Alert.alert('Missing Details', 'Please enter your vehicle make and model.');
      return;
    }
    if (uploadedAnglesCount === 0) {
      Alert.alert('Add Car Images', 'Please capture or upload at least 1 photo in Car Images.');
      return;
    }
    const newCar = {
      id: `host-${Date.now()}`,
      make: carMake,
      model: carModel,
      year: Number(carYear) || 2025,
      city: carCity,
      pricePerDay: Number(carRate) || 2800,
      registrationNumber: carRegNo,
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 5,
      available: true,
      imageUrl: carAnglePhotos.FRONT || Object.values(carAnglePhotos)[0],
      anglePhotos: carAnglePhotos,
    };
    setVehicles((prev) => [newCar, ...prev]);
    selectCarToManage(newCar);
    setAddCarModalOpen(false);
    Alert.alert('Car Listed', `${carMake} ${carModel} has been added to your listed cars.`);
  };

  const handleSaveManagedCar = () => {
    if (!managedCarId) return;
    setVehicles((prev) =>
      prev.map((v) =>
        String(v.id) === String(managedCarId)
          ? {
              ...v,
              pricePerDay: Number(managePrice) || 2800,
              city: manageCity,
              pickupHub: manageHub,
              registrationNumber: manageRegNo,
              kmPerDay: Number(manageKmLimit) || 300,
            }
          : v
      )
    );
    Alert.alert('Car Settings Saved', 'Your vehicle pricing, pickup hub, and listing details have been updated.');
  };

  const managedCar = useMemo(
    () => vehicles.find((v) => String(v.id) === String(managedCarId)) || vehicles[0],
    [vehicles, managedCarId]
  );

  const stats = useMemo(() => {
    const gross = bookings.length > 0 ? bookings.reduce((s, b) => s + Number(b.totalAmount || 0), 0) : 64500;
    const net80 = Math.round(gross * 0.8);
    return { fleetCount: vehicles.length || 4, net80 };
  }, [vehicles, bookings]);

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── HEADER ────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Host Dashboard</Text>
          <Text style={s.headerSub}>Manage your listed cars, pricing & car images</Text>
        </View>
        <TouchableOpacity
          style={s.addCarBtn}
          onPress={() => setAddCarModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text style={s.addCarBtnText}>Add New Car</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
      >
        {/* ────────── SUMMARY BAR ────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Net Host Payout (80%)</Text>
            <Text style={s.summaryBigVal}>₹{stats.net80.toLocaleString('en-IN')}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Listed Cars</Text>
            <Text style={s.summaryBigVal}>{stats.fleetCount}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Host Score</Text>
            <Text style={[s.summaryBigVal, { color: '#059669' }]}>4.9 / 5</Text>
          </View>
        </View>

        {/* ────────── HOST TABS ────────── */}
        <View style={s.tabSegment}>
          {HOST_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabBtn, active && s.tabBtnActive]}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabBtnText, active && s.tabBtnTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ────────── TAB 1: MY LISTED CARS ────────── */}
        {activeTab === 'FLEET' && (
          <View style={{ gap: 12 }}>
            {loading ? (
              <View style={s.centerBox}>
                <ActivityIndicator color="#0F172A" />
              </View>
            ) : (
              vehicles.map((car) => {
                const isOnline = car.available !== false;
                return (
                  <View key={car.id} style={s.carItemCard}>
                    <View style={s.carItemTop}>
                      <Image
                        source={car.imageUrl ? { uri: car.imageUrl } : getVehicleImageSource(car)}
                        style={s.carThumb}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.carName}>{car.make} {car.model}</Text>
                        <Text style={s.carSub}>
                          {car.city || 'Ahmedabad'} • ₹{Number(car.pricePerDay || 2500).toLocaleString('en-IN')}/day
                        </Text>
                        <View style={s.statusRow}>
                          <View style={[s.dot, { backgroundColor: isOnline ? '#059669' : '#94A3B8' }]} />
                          <Text style={s.statusLabel}>
                            {isOnline ? 'Listed & Available' : 'Listing Paused'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.carActionsRow}>
                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() => {
                          selectCarToManage(car);
                          setActiveTab('MANAGE');
                        }}
                      >
                        <Settings size={13} color="#0F172A" />
                        <Text style={s.actionBtnText}>Manage Car</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() => {
                          setImagesTargetCar(car);
                          setInspectPhotos(car.anglePhotos || {});
                          setImagesModalOpen(true);
                        }}
                      >
                        <Camera size={13} color="#FF6000" />
                        <Text style={s.actionBtnText}>Car Images</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() =>
                          setVehicles((prev) =>
                            prev.map((v) => (v.id === car.id ? { ...v, available: !isOnline } : v))
                          )
                        }
                      >
                        <Power size={13} color={isOnline ? '#DC2626' : '#059669'} />
                        <Text style={s.actionBtnText}>{isOnline ? 'Pause' : 'Activate'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ────────── TAB 2: MANAGE CAR (DEDICATED HOST CONTROL PANEL) ────────── */}
        {activeTab === 'MANAGE' && (
          <View style={{ gap: 14 }}>
            {/* Vehicle Selector Strip */}
            <Text style={s.sectionTitle}>Select Listed Car to Manage</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {vehicles.map((car) => {
                const selected = String(car.id) === String(managedCar?.id);
                return (
                  <TouchableOpacity
                    key={car.id}
                    style={[s.carSelectChip, selected && s.carSelectChipActive]}
                    onPress={() => selectCarToManage(car)}
                  >
                    <Text style={[s.carSelectChipText, selected && s.carSelectChipTextActive]}>
                      {car.make} {car.model}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {managedCar && (
              <View style={s.managePanelCard}>
                {/* Selected Car Header */}
                <View style={s.manageCarTopRow}>
                  <Image
                    source={
                      managedCar.imageUrl
                        ? { uri: managedCar.imageUrl }
                        : getVehicleImageSource(managedCar)
                    }
                    style={s.manageCarImg}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.manageCarTitle}>
                      {managedCar.make} {managedCar.model}
                    </Text>
                    <Text style={s.manageCarMeta}>
                      {managedCar.transmission || 'Automatic'} • {managedCar.fuelType || 'Diesel'} • {managedCar.seats || 5} Seats
                    </Text>
                    <TouchableOpacity
                      style={s.openImagesInlineBtn}
                      onPress={() => {
                        setImagesTargetCar(managedCar);
                        setInspectPhotos(managedCar.anglePhotos || {});
                        setImagesModalOpen(true);
                      }}
                    >
                      <Camera size={12} color="#FF6000" />
                      <Text style={s.openImagesInlineText}>Update Car Images</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.manageDivider} />

                {/* Editable Host Settings */}
                <View style={s.inputGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Daily Rental Rate (₹)</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={managePrice}
                      onChangeText={setManagePrice}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Included KMs / Day</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={manageKmLimit}
                      onChangeText={setManageKmLimit}
                    />
                  </View>
                </View>

                <View style={s.inputGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Operating City</Text>
                    <TextInput
                      style={s.input}
                      value={manageCity}
                      onChangeText={setManageCity}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Registration No.</Text>
                    <TextInput
                      style={s.input}
                      value={manageRegNo}
                      onChangeText={setManageRegNo}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View>
                  <Text style={s.inputLabel}>Default Pickup & Return Hub</Text>
                  <TextInput
                    style={s.input}
                    value={manageHub}
                    onChangeText={setManageHub}
                  />
                </View>

                <View style={s.manageActionsRow}>
                  <TouchableOpacity
                    style={s.manageImagesBtn}
                    onPress={() => {
                      setImagesTargetCar(managedCar);
                      setInspectPhotos(managedCar.anglePhotos || {});
                      setImagesModalOpen(true);
                    }}
                  >
                    <Camera size={15} color="#0F172A" />
                    <Text style={s.manageImagesBtnText}>Car Images</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.saveManageBtn}
                    onPress={handleSaveManagedCar}
                  >
                    <Text style={s.saveManageBtnText}>Save Car Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ────────── TAB 3: BOOKINGS & PAYOUTS ────────── */}
        {activeTab === 'EARNINGS' && (
          <View style={{ gap: 12 }}>
            <View style={s.earningsCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={18} color="#059669" />
                <Text style={s.earningsTitle}>80 / 20 Host Revenue Share</Text>
              </View>
              <Text style={s.earningsSub}>
                You receive 80% of total trip revenue directly in your bank account within 24 hours of trip completion.
              </Text>
            </View>

            <View style={s.emptyCard}>
              <Calendar size={30} color="#94A3B8" />
              <Text style={s.emptyTitle}>Host Trip Handover</Text>
              <Text style={s.emptySub}>
                Upload start and return car images when handing over your vehicle to a guest.
              </Text>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => {
                  setImagesTargetCar(vehicles[0]);
                  setImagesModalOpen(true);
                }}
              >
                <Camera size={15} color="#FFFFFF" />
                <Text style={s.primaryBtnText}>Upload Car Images</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ────────── MODAL 1: ADD NEW CAR + CAR IMAGES ────────── */}
      <Modal
        visible={addCarModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddCarModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Add New Car Listing</Text>
                <Text style={s.modalSub}>Enter vehicle details & upload Car Images ({uploadedAnglesCount}/8)</Text>
              </View>
              <TouchableOpacity onPress={() => setAddCarModalOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <View style={s.inputGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Brand</Text>
                  <TextInput style={s.input} value={carMake} onChangeText={setCarMake} />
                </View>
                <View style={{ flex: 1.3 }}>
                  <Text style={s.inputLabel}>Model</Text>
                  <TextInput style={s.input} value={carModel} onChangeText={setCarModel} />
                </View>
              </View>

              <View style={s.inputGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Daily Rate (₹)</Text>
                  <TextInput style={s.input} value={carRate} onChangeText={setCarRate} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1.3 }}>
                  <Text style={s.inputLabel}>Registration No.</Text>
                  <TextInput style={s.input} value={carRegNo} onChangeText={setCarRegNo} autoCapitalize="characters" />
                </View>
              </View>

              <Text style={s.sectionTitle}>Car Images (Camera & Upload)</Text>

              <View style={s.anglesGrid}>
                {CAR_IMAGE_SLOTS.map((slot) => {
                  const uri = carAnglePhotos[slot.key];
                  return (
                    <View key={slot.key} style={[s.angleCard, !!uri && s.angleCardDone]}>
                      {uri ? (
                        <Image source={{ uri }} style={s.anglePreview} resizeMode="cover" />
                      ) : (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={s.angleLabel}>{slot.label}</Text>
                          <Text style={s.angleHint}>{slot.hint}</Text>
                        </View>
                      )}
                      {uri && <Text style={[s.angleLabel, { marginTop: 4 }]}>{slot.label}</Text>}

                      <View style={s.angleBtns}>
                        <TouchableOpacity
                          style={s.camBtn}
                          onPress={() => captureOrPickAngle(slot.key, setCarAnglePhotos, 'camera')}
                        >
                          <Camera size={11} color="#FFFFFF" />
                          <Text style={s.camBtnText}>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.upBtn}
                          onPress={() => captureOrPickAngle(slot.key, setCarAnglePhotos, 'gallery')}
                        >
                          <Upload size={11} color="#0F172A" />
                          <Text style={s.upBtnText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={s.submitBtn} onPress={handleCreateCarListing}>
                <Text style={s.submitBtnText}>Publish Car Listing ({uploadedAnglesCount}/8 Images)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 2: HOST CAR IMAGES UPLOADER ────────── */}
      <Modal
        visible={imagesModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImagesModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Car Images</Text>
                <Text style={s.modalSub}>
                  {imagesTargetCar ? `${imagesTargetCar.make} ${imagesTargetCar.model} • ` : ''}
                  {inspectAnglesCount} of 8 car images uploaded
                </Text>
              </View>
              <TouchableOpacity onPress={() => setImagesModalOpen(false)} style={s.closeBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <View style={s.anglesGrid}>
                {CAR_IMAGE_SLOTS.map((slot) => {
                  const uri = inspectPhotos[slot.key];
                  return (
                    <View key={slot.key} style={[s.angleCard, !!uri && s.angleCardDone]}>
                      {uri ? (
                        <Image source={{ uri }} style={s.anglePreview} resizeMode="cover" />
                      ) : (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={s.angleLabel}>{slot.label}</Text>
                          <Text style={s.angleHint}>{slot.hint}</Text>
                        </View>
                      )}
                      {uri && <Text style={[s.angleLabel, { marginTop: 4 }]}>{slot.label}</Text>}

                      <View style={s.angleBtns}>
                        <TouchableOpacity
                          style={s.camBtn}
                          onPress={() => captureOrPickAngle(slot.key, setInspectPhotos, 'camera')}
                        >
                          <Camera size={11} color="#FFFFFF" />
                          <Text style={s.camBtnText}>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.upBtn}
                          onPress={() => captureOrPickAngle(slot.key, setInspectPhotos, 'gallery')}
                        >
                          <Upload size={11} color="#0F172A" />
                          <Text style={s.upBtnText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={s.submitBtn}
                onPress={() => {
                  if (imagesTargetCar) {
                    setVehicles((prev) =>
                      prev.map((v) =>
                        v.id === imagesTargetCar.id
                          ? {
                              ...v,
                              anglePhotos: inspectPhotos,
                              imageUrl: inspectPhotos.FRONT || v.imageUrl,
                            }
                          : v
                      )
                    );
                  }
                  setImagesModalOpen(false);
                  Alert.alert('Car Images Saved', `${inspectAnglesCount}/8 car images have been updated.`);
                }}
              >
                <Text style={s.submitBtnText}>Save Car Images ({inspectAnglesCount}/8)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  addCarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF6000',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addCarBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* Summary Card */
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryBigVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },

  /* Segmented Control */
  tabSegment: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  /* Car Item Card */
  carItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  carItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carThumb: {
    width: 80,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  carName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  carSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  carActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Manage Car Tab */
  carSelectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  carSelectChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  carSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  carSelectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  managePanelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  manageCarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageCarImg: {
    width: 90,
    height: 66,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  manageCarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  manageCarMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  openImagesInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  openImagesInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6000',
  },
  manageDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  manageActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  manageImagesBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  manageImagesBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveManageBtn: {
    flex: 1.3,
    backgroundColor: '#FF6000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveManageBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  centerBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  earningsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  earningsSub: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
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
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  anglesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  angleCard: {
    width: (W - 52) / 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  angleCardDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  anglePreview: {
    width: '100%',
    height: 70,
    borderRadius: 8,
  },
  angleLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  angleHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  angleBtns: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  camBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    borderRadius: 7,
    paddingVertical: 6,
  },
  camBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  upBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingVertical: 6,
  },
  upBtnText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
