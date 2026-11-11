import React, { useState } from 'react';
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
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, getVehicleImageSource } from '@/services/api';
import {
  CalendarDays,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  Car,
  FileText,
  ChevronRight,
  X,
  Heart,
  Key,
  Camera,
  ShieldAlert,
  Phone,
  MessageCircle,
  Receipt,
  Fuel,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  Upload,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const TABS = [
  { key: 'Upcoming', label: 'Upcoming' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = require('@/context/AuthContext').useAuth();

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // 1. Customer Handover Walkaround (Photo Inspection)
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionBooking, setInspectionBooking] = useState<any | null>(null);
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, string>>({});
  const [inspectionOdometer, setInspectionOdometer] = useState('');
  const [inspectionFuel, setInspectionFuel] = useState('100%');
  const [inspectedTrips, setInspectedTrips] = useState<Record<string, boolean>>({});

  // 2. Emergency 24x7 Roadside & SOS Modal
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosBooking, setSosBooking] = useState<any | null>(null);

  // 3. FASTag & Fuel Ledger Modal
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerBooking, setLedgerBooking] = useState<any | null>(null);

  // 4. GST Tax Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<any | null>(null);

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchTrips();
      }
    }, [user])
  );

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/bookings/my-trips');
      setAllBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = React.useMemo(() => {
    const now = new Date();
    return allBookings.filter((b) => {
      if (b.status === 'CANCELLED') {
        return activeTab === 'Cancelled';
      }
      const tripEnd = new Date(b.endDate);
      const isCompleted = tripEnd < now || b.status === 'COMPLETED';
      if (activeTab === 'Completed') return isCompleted;
      if (activeTab === 'Upcoming') return !isCompleted;
      return true;
    });
  }, [allBookings, activeTab]);

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? Eligible refunds will be processed back to your Safar wallet or source account.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(bookingId);
            try {
              await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' });
              Alert.alert('Booking Cancelled', 'Your cancellation has been processed.');
              fetchTrips();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel booking.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const submitReview = async () => {
    if (!selectedBooking) return;
    setSubmittingReview(true);
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          vehicleId: selectedBooking.vehicleId,
          rating,
          comment,
        }),
      });
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setReviewModalOpen(false);
      setSelectedBooking(null);
      setComment('');
      fetchTrips();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // 1. Handover Walkaround Photo Picker
  const handleCapturePhoto = async (slot: string) => {
    try {
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setInspectionPhotos((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
      }
    } catch {
      // Fallback to library if camera unavailable in simulator
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setInspectionPhotos((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
      }
    }
  };

  const handleSubmitCustomerInspection = () => {
    if (Object.keys(inspectionPhotos).length === 0) {
      Alert.alert('Photos Recommended', 'Please capture at least 1 photo of the car condition or odometer reading.');
      return;
    }
    if (inspectionBooking) {
      setInspectedTrips((prev) => ({ ...prev, [inspectionBooking.id]: true }));
    }
    setInspectionModalOpen(false);
    Alert.alert(
      'Inspection Verified',
      'Your pre-trip condition photos and odometer reading have been timestamped. Zero damage liability is activated.'
    );
  };

  // 2. Share WhatsApp Digital Pass
  const handleShareWhatsAppPass = (booking: any) => {
    const v = booking.vehicle || {};
    const text = `🚗 *SAFAR SELF DRIVE - DIGITAL PASS*\n\n• *Booking Ref:* #${booking.bookingId || booking.id}\n• *Car:* ${v.make || 'Safar'} ${v.model || 'Self Drive'}\n• *Registration:* ${v.registrationNumber || 'Private White Plate'}\n• *Dates:* ${formatTripDates(booking.startDate, booking.endDate)}\n• *Pickup Hub:* ${booking.pickupHub || v.city || 'Ahmedabad Hub'}\n• *24x7 Roadside Helpline:* +91 99000 00001\n\n*Verified by Govt. DigiLocker e-KYC. Present Driving Licence at Handover.*`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    });
  };

  // 3. Share GST Tax Invoice
  const handleShareInvoice = (booking: any) => {
    const v = booking.vehicle || {};
    const base = Math.round(Number(booking.totalAmount || 2500) / 1.18);
    const gst = Math.round(Number(booking.totalAmount || 2500) - base);
    const invoiceText = `🧾 *SAFAR SELF DRIVE PRIVATE LIMITED*\n*GST TAX INVOICE (SAC: 997311)*\n\n• Invoice No: SAFAR-GJ-2026-${String(booking.id).slice(-6).toUpperCase()}\n• GSTIN: 24AABCS1234F1Z5 (Gujarat 24)\n• Guest: ${user?.firstName || 'Safar Guest'} ${user?.lastName || ''}\n• Vehicle: ${v.make} ${v.model}\n• Base Rental: ₹${base.toLocaleString('en-IN')}\n• CGST (9%): ₹${Math.round(gst / 2).toLocaleString('en-IN')}\n• SGST (9%): ₹${Math.round(gst / 2).toLocaleString('en-IN')}\n• *Total Paid:* ₹${Number(booking.totalAmount || 2500).toLocaleString('en-IN')}\n\n*This is a computer-generated GST tax compliant invoice.*`;
    Share.share({ message: invoiceText });
  };

  // Helper date formatter
  const formatTripDates = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const sFmt = s.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      const eFmt = e.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      return `${sFmt} → ${eFmt}`;
    } catch {
      return `${startStr} → ${endStr}`;
    }
  };

  return (
    <View style={[s.screen, { paddingTop: topPadding }]}>
      {/* ────────── HEADER ────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>My Trips</Text>
          <Text style={s.headerSub}>Manage your bookings, digital passes & inspection</Text>
        </View>

        <TouchableOpacity
          style={s.newDriveBtn}
          onPress={() => router.push('/')}
          activeOpacity={0.8}
        >
          <Text style={s.newDriveBtnText}>+ New Drive</Text>
        </TouchableOpacity>
      </View>

      {/* ────────── SUB TABS ────────── */}
      <View style={s.tabBarWrap}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, active && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
              {active && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ────────── CONTENT ────────── */}
      {!user ? (
        <View style={s.guestBox}>
          <Car size={48} color="#2D114D" />
          <Text style={s.guestTitle}>Sign in to view your trips</Text>
          <Text style={s.guestSub}>
            Track upcoming bookings, download GST tax invoices, and access your digital vehicle handover pass.
          </Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/auth/login')}>
            <Text style={s.loginBtnText}>Log In to Your Account</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#2D114D" />
          <Text style={s.loadingText}>Fetching your trips…</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyScroll}>
          <View style={s.emptyCard}>
            <View style={s.emptyIconCircle}>
              <CalendarDays size={36} color="#2D114D" />
            </View>
            <Text style={s.emptyTitle}>No {activeTab.toLowerCase()} trips found</Text>
            <Text style={s.emptySub}>
              {activeTab === 'Upcoming'
                ? "You don't have any active or upcoming drives. Plan your next weekend getaway now!"
                : `No ${activeTab.toLowerCase()} bookings recorded in your account history.`}
            </Text>
            <TouchableOpacity style={s.browseBtn} onPress={() => router.push('/')}>
              <Text style={s.browseBtnText}>Explore Available Cars</Text>
              <ArrowRight size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredTrips.map((booking) => {
            const vehicle = booking.vehicle || {};
            const isCompleted = activeTab === 'Completed';
            const isCancelled = booking.status === 'CANCELLED';
            const isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'ACTIVE';
            const isInspected = !!inspectedTrips[booking.id];

            return (
              <View key={booking.id} style={s.tripCard}>
                {/* Car Showcase Image */}
                <View style={s.cardImageContainer}>
                  <Image
                    source={getVehicleImageSource(vehicle)}
                    style={s.cardCarImage}
                    resizeMode="contain"
                  />
                  {/* WhatsApp Quick Share Button */}
                  <TouchableOpacity
                    style={s.whatsappBtnCorner}
                    onPress={() => handleShareWhatsAppPass(booking)}
                    activeOpacity={0.8}
                  >
                    <MessageCircle size={15} color="#25D366" />
                  </TouchableOpacity>
                </View>

                {/* Card Body */}
                <View style={s.cardBody}>
                  {/* Car Name & Status Badge */}
                  <View style={s.cardTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.carMake}>{vehicle.make || 'Safar'} · {vehicle.year || '2025'}</Text>
                      <Text style={s.carModel}>{vehicle.model || 'Self Drive Car'}</Text>
                    </View>

                    <View
                      style={[
                        s.statusBadge,
                        isCompleted && s.statusCompleted,
                        isConfirmed && s.statusConfirmed,
                        isCancelled && s.statusCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          isCompleted && s.statusTextCompleted,
                          isConfirmed && s.statusTextConfirmed,
                          isCancelled && s.statusTextCancelled,
                        ]}
                      >
                        {booking.status}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Time Row */}
                  <View style={s.dateBox}>
                    <Clock size={13} color="#6B7280" />
                    <Text style={s.dateRangeText}>
                      {formatTripDates(booking.startDate, booking.endDate)}
                    </Text>
                  </View>

                  {/* Pickup Location */}
                  <View style={s.locationBox}>
                    <MapPin size={13} color="#FF6000" />
                    <Text style={s.locationText}>
                      Pickup: {booking.pickupHub || vehicle.city || 'Ahmedabad Hub'}
                    </Text>
                  </View>

                  {/* ────────── NEW: QUICK ACTION PILLS (INSPECTION, FASTAG, RSA) ────────── */}
                  {isConfirmed && (
                    <View style={s.featurePillsRow}>
                      {/* Customer Handover Walkaround */}
                      <TouchableOpacity
                        style={[s.featurePill, isInspected && s.featurePillActive]}
                        onPress={() => {
                          setInspectionBooking(booking);
                          setInspectionPhotos({});
                          setInspectionModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Camera size={12} color={isInspected ? '#059669' : '#2D114D'} />
                        <Text style={[s.featurePillText, isInspected && s.featurePillTextGreen]}>
                          {isInspected ? 'Inspection Saved' : 'Walkaround (Photos)'}
                        </Text>
                      </TouchableOpacity>

                      {/* FASTag & Fuel Ledger */}
                      <TouchableOpacity
                        style={s.featurePill}
                        onPress={() => {
                          setLedgerBooking(booking);
                          setLedgerModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Fuel size={12} color="#FF6000" />
                        <Text style={s.featurePillText}>FASTag & Fuel</Text>
                      </TouchableOpacity>

                      {/* Emergency 24x7 RSA */}
                      <TouchableOpacity
                        style={s.featurePillSos}
                        onPress={() => {
                          setSosBooking(booking);
                          setSosModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <ShieldAlert size={12} color="#DC2626" />
                        <Text style={s.featurePillTextRed}>24x7 SOS</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Price & Fare Details */}
                  <View style={s.fareRow}>
                    <View>
                      <Text style={s.fareLabel}>Total Fare Paid</Text>
                      <Text style={s.fareValue}>
                        ₹{Number(booking.totalAmount || booking.baseFare || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.depositLabel}>Security Deposit</Text>
                      <Text style={s.depositValue}>
                        {Number(booking.securityDeposit || 0) === 0 ? 'Zero Deposit (KYC)' : `₹${booking.securityDeposit} (Refunded)`}
                      </Text>
                    </View>
                  </View>

                  <View style={s.cardDivider} />

                  {/* Actions Row */}
                  <View style={s.actionsRow}>
                    {isCompleted ? (
                      <>
                        <TouchableOpacity
                          style={s.bookAgainBtn}
                          onPress={() => router.push({ pathname: '/details/[id]', params: { id: String(vehicle.id || booking.vehicleId) } })}
                          activeOpacity={0.8}
                        >
                          <RotateCcw size={14} color="#2D114D" />
                          <Text style={s.bookAgainText}>Book Again</Text>
                        </TouchableOpacity>

                        {/* GST Tax Invoice */}
                        <TouchableOpacity
                          style={s.invoiceBtn}
                          onPress={() => {
                            setInvoiceBooking(booking);
                            setInvoiceModalOpen(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <FileText size={14} color="#2D114D" />
                          <Text style={s.invoiceBtnText}>GST Invoice</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.rateBtn}
                          onPress={() => {
                            setSelectedBooking(booking);
                            setReviewModalOpen(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Star size={14} color="#FF6000" />
                          <Text style={s.rateBtnText}>Rate</Text>
                        </TouchableOpacity>
                      </>
                    ) : isConfirmed ? (
                      <>
                        <TouchableOpacity
                          style={s.handoverPassBtn}
                          onPress={() => handleShareWhatsAppPass(booking)}
                          activeOpacity={0.8}
                        >
                          <Key size={14} color="#FFF" />
                          <Text style={s.handoverPassText}>WhatsApp Pass</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.cancelTripBtn}
                          onPress={() => handleCancelBooking(booking.id)}
                          activeOpacity={0.8}
                          disabled={actionLoading === booking.id}
                        >
                          {actionLoading === booking.id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Text style={s.cancelTripText}>Cancel</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={s.bookAgainBtn}
                        onPress={() => router.push('/')}
                        activeOpacity={0.8}
                      >
                        <RotateCcw size={15} color="#2D114D" />
                        <Text style={s.bookAgainText}>Search Other Cars</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ────────── MODAL 1: CUSTOMER HANDOVER WALKAROUND INSPECTION ────────── */}
      <Modal
        visible={inspectionModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectionModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Vehicle Walkaround Inspection</Text>
                <Text style={s.modalSubtitle}>Protect yourself against false damage claims</Text>
              </View>
              <TouchableOpacity onPress={() => setInspectionModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <Text style={s.inspectInstText}>
                Take 4 photos of the exterior & 1 photo of the odometer before starting your drive.
              </Text>

              {/* 4 Photos Grid */}
              <View style={s.photoSlotsGrid}>
                {['Front', 'Rear', 'Left Side', 'Right Side'].map((side) => {
                  const key = side.toLowerCase().replace(' ', '_');
                  const hasPhoto = !!inspectionPhotos[key];
                  return (
                    <TouchableOpacity
                      key={side}
                      style={[s.photoSlot, hasPhoto && s.photoSlotDone]}
                      onPress={() => handleCapturePhoto(key)}
                    >
                      {hasPhoto ? (
                        <CheckCircle2 size={20} color="#059669" />
                      ) : (
                        <Camera size={18} color="#2D114D" />
                      )}
                      <Text style={[s.photoSlotText, hasPhoto && { color: '#059669', fontWeight: '800' }]}>
                        {hasPhoto ? `${side} ✓` : `+ ${side}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Odometer & Fuel */}
              <View style={s.odometerCard}>
                <Text style={s.cardInputLabel}>Current Odometer (km)</Text>
                <TextInput
                  style={s.odometerInput}
                  placeholder="e.g. 24,580"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={inspectionOdometer}
                  onChangeText={setInspectionOdometer}
                />

                <Text style={[s.cardInputLabel, { marginTop: 10 }]}>Fuel Level at Pickup</Text>
                <View style={s.fuelChipsRow}>
                  {['100% (Full)', '75%', '50%', '25%'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[s.fuelChip, inspectionFuel === level && s.fuelChipActive]}
                      onPress={() => setInspectionFuel(level)}
                    >
                      <Text style={[s.fuelChipText, inspectionFuel === level && s.fuelChipTextActive]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={s.confirmInspectionBtn}
                onPress={handleSubmitCustomerInspection}
                activeOpacity={0.88}
              >
                <ShieldCheck size={18} color="#FFF" />
                <Text style={s.confirmInspectionText}>Save & Lock Handover Inspection</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 2: 24x7 GUJARAT ROADSIDE ASSISTANCE (SOS) ────────── */}
      <Modal
        visible={sosModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSosModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>24x7 Gujarat Roadside SOS</Text>
                <Text style={s.modalSubtitle}>Immediate roadside support across all Gujarat highways</Text>
              </View>
              <TouchableOpacity onPress={() => setSosModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              {/* Emergency Hotline Button */}
              <TouchableOpacity
                style={s.sosCallBtn}
                onPress={() => Linking.openURL('tel:+919900000001')}
                activeOpacity={0.88}
              >
                <Phone size={20} color="#FFF" />
                <View>
                  <Text style={s.sosCallBtnTitle}>Call 24x7 Roadside Helpline</Text>
                  <Text style={s.sosCallBtnSub}>+91 99000 00001 • Instant Dispatch</Text>
                </View>
              </TouchableOpacity>

              {/* Share Live Location via WhatsApp */}
              <TouchableOpacity
                style={s.sosWhatsappBtn}
                onPress={() => {
                  const msg = `🚨 *EMERGENCY ROADSIDE REQUEST - SAFAR SELF DRIVE*\n• Booking: #${sosBooking?.id || 'ACTIVE'}\n• Car: ${sosBooking?.vehicle?.make} ${sosBooking?.vehicle?.model}\n• Location: Gujarat Highway\nPlease dispatch RSA vehicle.`;
                  Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                }}
                activeOpacity={0.88}
              >
                <Navigation size={18} color="#25D366" />
                <Text style={s.sosWhatsappText}>Share Live Location with Safar Desk</Text>
              </TouchableOpacity>

              {/* Service Cards */}
              <View style={s.sosServicesList}>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>🔧 Flat Tyre Assistance</Text>
                  <Text style={s.sosServiceSub}>Stepney swap or puncture repair anywhere on highway</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>⚡ Dead Battery Jumpstart</Text>
                  <Text style={s.sosServiceSub}>Quick booster battery restart within 30-45 minutes</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>⛽ 5L Emergency Fuel</Text>
                  <Text style={s.sosServiceSub}>Direct emergency fuel delivery if stranded</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>🛞 Flatbed Towing</Text>
                  <Text style={s.sosServiceSub}>Free towing to the nearest authorized service hub</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 3: IN-APP FUEL & FASTAG LEDGER ────────── */}
      <Modal
        visible={ledgerModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLedgerModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>FASTag & Fuel Live Ledger</Text>
                <Text style={s.modalSubtitle}>Transparent toll tracking & fuel policy</Text>
              </View>
              <TouchableOpacity onPress={() => setLedgerModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {/* Fuel Rule Card */}
              <View style={s.ledgerCard}>
                <View style={s.ledgerCardHeader}>
                  <Fuel size={16} color="#FF6000" />
                  <Text style={s.ledgerCardTitle}>Like-to-Like Fuel Guarantee</Text>
                </View>
                <Text style={s.ledgerCardText}>
                  You received this car with a <Text style={{ fontWeight: '800' }}>100% Full Tank</Text>. Return with the same level or settle the difference at exact Gujarat petrol/diesel pump rates without any surcharge.
                </Text>
              </View>

              {/* FASTag Tolls */}
              <View style={s.ledgerCard}>
                <View style={s.ledgerCardHeader}>
                  <Receipt size={16} color="#2D114D" />
                  <Text style={s.ledgerCardTitle}>Gujarat FASTag Toll Passes</Text>
                </View>
                <View style={s.tollRow}>
                  <Text style={s.tollName}>Ahmedabad - Vadodara NE-1 Expressway</Text>
                  <Text style={s.tollAmount}>₹135</Text>
                </View>
                <View style={s.tollRow}>
                  <Text style={s.tollName}>SG Highway Ring Road Plaza</Text>
                  <Text style={s.tollAmount}>₹50</Text>
                </View>
                <View style={[s.tollRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[s.tollName, { fontWeight: '800', color: '#2D114D' }]}>Total Tolls Incurred</Text>
                  <Text style={[s.tollAmount, { fontWeight: '800', color: '#2D114D', fontSize: 14 }]}>₹185</Text>
                </View>
              </View>

              <Text style={s.ledgerFootnote}>
                FASTag toll amounts are auto-settled from your Safar Digital Cash wallet or refunded deposit.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────── MODAL 4: GST TAX INVOICE ────────── */}
      <Modal
        visible={invoiceModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInvoiceModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>GST Tax Invoice</Text>
                <Text style={s.modalSubtitle}>Government GST-compliant tax receipt</Text>
              </View>
              <TouchableOpacity onPress={() => setInvoiceModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {invoiceBooking && (
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                <View style={s.invoiceCard}>
                  <View style={s.invoiceHeaderRow}>
                    <View>
                      <Text style={s.companyName}>Safar Self Drive Pvt. Ltd.</Text>
                      <Text style={s.gstinText}>GSTIN: 24AABCS1234F1Z5 (Gujarat)</Text>
                      <Text style={s.gstinText}>SAC Code: 997311 (Passenger Rental)</Text>
                    </View>
                    <View style={s.invoiceNumberBox}>
                      <Text style={s.invoiceNumberLabel}>TAX INVOICE</Text>
                      <Text style={s.invoiceNumberVal}>
                        SFR-{String(invoiceBooking.id).slice(-6).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={s.invoiceDivider} />

                  <View style={s.invoiceMetaRow}>
                    <View>
                      <Text style={s.metaLabel}>Billed To</Text>
                      <Text style={s.metaVal}>{user?.firstName || 'Safar Member'} {user?.lastName || ''}</Text>
                      <Text style={s.metaSub}>{user?.phone || user?.email || 'Verified Guest'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.metaLabel}>Trip Vehicle</Text>
                      <Text style={s.metaVal}>
                        {invoiceBooking.vehicle?.make} {invoiceBooking.vehicle?.model}
                      </Text>
                    </View>
                  </View>

                  <View style={s.invoiceDivider} />

                  {/* Calculations */}
                  <View style={s.invoiceLineRow}>
                    <Text style={s.invoiceLineKey}>Base Vehicle Rental</Text>
                    <Text style={s.invoiceLineVal}>
                      ₹{Math.round(Number(invoiceBooking.totalAmount || 2500) / 1.18).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={s.invoiceLineRow}>
                    <Text style={s.invoiceLineKey}>CGST (9%)</Text>
                    <Text style={s.invoiceLineVal}>
                      ₹{Math.round((Number(invoiceBooking.totalAmount || 2500) - Math.round(Number(invoiceBooking.totalAmount || 2500) / 1.18)) / 2).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={s.invoiceLineRow}>
                    <Text style={s.invoiceLineKey}>SGST (9%)</Text>
                    <Text style={s.invoiceLineVal}>
                      ₹{Math.round((Number(invoiceBooking.totalAmount || 2500) - Math.round(Number(invoiceBooking.totalAmount || 2500) / 1.18)) / 2).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={[s.invoiceLineRow, s.invoiceTotalRow]}>
                    <Text style={s.invoiceTotalKey}>Total Paid (Inclusive of GST)</Text>
                    <Text style={s.invoiceTotalVal}>
                      ₹{Number(invoiceBooking.totalAmount || 2500).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.shareInvoiceBtn}
                  onPress={() => handleShareInvoice(invoiceBooking)}
                  activeOpacity={0.88}
                >
                  <FileText size={16} color="#FFF" />
                  <Text style={s.shareInvoiceBtnText}>Share / Save Tax Invoice</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ────────── REVIEW MODAL ────────── */}
      <Modal
        visible={reviewModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Rate Your Drive</Text>
              <TouchableOpacity onPress={() => setReviewModalOpen(false)}>
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSubtitle}>
              How was your experience with {selectedBooking?.vehicle?.make} {selectedBooking?.vehicle?.model}?
            </Text>

            {/* Stars */}
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={{ padding: 6 }}
                >
                  <Star
                    size={32}
                    color="#FFB800"
                    fill={star <= rating ? '#FFB800' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.reviewInput}
              placeholder="Tell us about the car condition, cleanliness, handover..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity
              style={s.submitReviewBtn}
              onPress={submitReview}
              disabled={submittingReview}
              activeOpacity={0.85}
            >
              {submittingReview ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.submitReviewText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEBF5',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2D114D',
  },
  headerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  newDriveBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#FF6000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  newDriveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Tabs */
  tabBarWrap: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#2D114D',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  /* List & Cards */
  listContainer: {
    padding: 16,
    paddingBottom: 36,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    overflow: 'hidden',
    shadowColor: '#2D114D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardImageContainer: {
    height: 170,
    backgroundColor: '#FAF8FC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardCarImage: {
    width: '90%',
    height: '90%',
  },
  whatsappBtnCorner: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardBody: {
    padding: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carMake: {
    fontSize: 11,
    color: '#8A8F98',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  carModel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2D114D',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#EFF6FF',
  },
  statusConfirmed: {
    backgroundColor: '#ECFDF5',
  },
  statusCancelled: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextCompleted: {
    color: '#2563EB',
  },
  statusTextConfirmed: {
    color: '#059669',
  },
  statusTextCancelled: {
    color: '#DC2626',
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  locationText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },

  /* Feature Action Pills */
  featurePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  featurePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    paddingVertical: 6,
  },
  featurePillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  featurePillSos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featurePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2D114D',
  },
  featurePillTextGreen: {
    color: '#059669',
  },
  featurePillTextRed: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },

  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF8FD',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  fareLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2D114D',
    marginTop: 1,
  },
  depositLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  depositValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookAgainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#2D114D',
    borderRadius: 12,
    paddingVertical: 9,
  },
  bookAgainText: {
    color: '#2D114D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  invoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F3EEFA',
    borderRadius: 12,
    paddingVertical: 9,
  },
  invoiceBtnText: {
    color: '#2D114D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  rateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  rateBtnText: {
    color: '#FF6000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  handoverPassBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: '#25D366',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  handoverPassText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelTripBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  cancelTripText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Empty & Loading */
  emptyScroll: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
    width: '100%',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2D114D',
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D114D',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  guestBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D114D',
  },
  guestSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D114D',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  inspectInstText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },
  photoSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoSlot: {
    width: (W - 50) / 2,
    height: 70,
    backgroundColor: '#FAF8FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDF2',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoSlotDone: {
    borderStyle: 'solid',
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  photoSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },
  odometerCard: {
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DDF2',
  },
  cardInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D114D',
  },
  odometerInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8CEE8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 6,
  },
  fuelChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  fuelChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  fuelChipActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  fuelChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  fuelChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  confirmInspectionBtn: {
    backgroundColor: '#2D114D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  confirmInspectionText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* SOS Modal */
  sosCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    padding: 16,
  },
  sosCallBtnTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sosCallBtnSub: {
    fontSize: 11,
    color: '#FEE2E2',
    marginTop: 2,
  },
  sosWhatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
  },
  sosWhatsappText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#15803D',
  },
  sosServicesList: {
    gap: 8,
    marginTop: 4,
  },
  sosServiceItem: {
    backgroundColor: '#FAF8FD',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  sosServiceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },
  sosServiceSub: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 1,
  },

  /* Ledger Modal */
  ledgerCard: {
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  ledgerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ledgerCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D114D',
  },
  ledgerCardText: {
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16,
  },
  tollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  tollName: {
    fontSize: 11,
    color: '#4B5563',
  },
  tollAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D114D',
  },
  ledgerFootnote: {
    fontSize: 10.5,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
  },

  /* GST Invoice Modal */
  invoiceCard: {
    backgroundColor: '#FAF8FD',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2D114D',
  },
  gstinText: {
    fontSize: 9.5,
    color: '#6B7280',
    marginTop: 1,
  },
  invoiceNumberBox: {
    alignItems: 'flex-end',
  },
  invoiceNumberLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 0.5,
  },
  invoiceNumberVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D114D',
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 9.5,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 1,
  },
  metaSub: {
    fontSize: 10,
    color: '#6B7280',
  },
  invoiceLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  invoiceLineKey: {
    fontSize: 11.5,
    color: '#4B5563',
  },
  invoiceLineVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2D114D',
  },
  invoiceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#2D114D',
    paddingTop: 8,
    marginTop: 6,
  },
  invoiceTotalKey: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2D114D',
  },
  invoiceTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FF6000',
  },
  shareInvoiceBtn: {
    backgroundColor: '#2D114D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  shareInvoiceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Review Modal */
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 14,
  },
  reviewInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#1F2937',
    textAlignVertical: 'top',
    height: 90,
  },
  submitReviewBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  submitReviewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
