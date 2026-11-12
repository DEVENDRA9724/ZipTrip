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
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, getVehicleImageSource } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
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
  X,
  Key,
  Camera,
  ShieldAlert,
  Phone,
  MessageCircle,
  Receipt,
  Fuel,
  CheckCircle2,
  Navigation,
  Upload,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const TABS = [
  { key: 'Upcoming', label: 'Upcoming & Active' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const CAR_IMAGE_SLOTS = [
  { key: 'FRONT', label: '1. Front View', hint: 'Bumper, Grille & Number Plate' },
  { key: 'REAR', label: '2. Rear View', hint: 'Tailgate, Boot & Rear Plate' },
  { key: 'LEFT_SIDE', label: '3. Left Side', hint: 'Left Doors & Tyres' },
  { key: 'RIGHT_SIDE', label: '4. Right Side', hint: 'Driver Side Doors & Mirrors' },
  { key: 'FRONT_LEFT', label: '5. Front-Left Corner', hint: 'Front Left Fender & Lamp' },
  { key: 'FRONT_RIGHT', label: '6. Front-Right Corner', hint: 'Front Right Fender & Wheel' },
  { key: 'ODOMETER', label: '7. Odometer & Fuel', hint: 'Live KM Reading & Fuel Gauge' },
  { key: 'INTERIOR', label: '8. Interior Cabin', hint: 'Front & Rear Seats' },
];

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

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

  // Customer Start / End Trip Car Images Modal (Only for logged-in booked trips)
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionBooking, setInspectionBooking] = useState<any | null>(null);
  const [tripStage, setTripStage] = useState<'START' | 'END'>('START');
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, string>>({});
  const [inspectionOdometer, setInspectionOdometer] = useState('');
  const [inspectionFuel, setInspectionFuel] = useState('100% (Full)');
  const [inspectedTrips, setInspectedTrips] = useState<Record<string, boolean>>({});

  // Emergency 24x7 Roadside & SOS Modal
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosBooking, setSosBooking] = useState<any | null>(null);

  // FASTag & Fuel Ledger Modal
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerBooking, setLedgerBooking] = useState<any | null>(null);

  // GST Tax Invoice Modal
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

  const handleCapturePhoto = async (slot: string, mode: 'camera' | 'gallery') => {
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Permission Needed', 'Please allow camera access to capture car images.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          setInspectionPhotos((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Gallery Permission Needed', 'Please allow photo library access to upload car images.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          setInspectionPhotos((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
        }
      }
    } catch {
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setInspectionPhotos((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
      }
    }
  };

  const completedImagesCount = CAR_IMAGE_SLOTS.filter((a) => !!inspectionPhotos[a.key]).length;

  const handleSubmitCustomerInspection = () => {
    if (completedImagesCount === 0) {
      Alert.alert(
        'Car Images Required',
        'Please capture or upload at least 1 car image before saving.'
      );
      return;
    }
    if (inspectionBooking) {
      setInspectedTrips((prev) => ({ ...prev, [inspectionBooking.id]: true }));
    }
    setInspectionModalOpen(false);
    Alert.alert(
      'Car Images Saved',
      `${completedImagesCount}/8 car images for ${tripStage === 'START' ? 'Trip Start' : 'Trip End'} have been saved.`
    );
  };

  const handleShareWhatsAppPass = (booking: any) => {
    const v = booking.vehicle || {};
    const text = `*SAFAR SELF DRIVE - DIGITAL HANDOVER PASS*\n\n• *Booking Ref:* #${booking.bookingId || booking.id}\n• *Car:* ${v.make || 'Safar'} ${v.model || 'Self Drive'}\n• *Registration:* ${v.registrationNumber || 'Private White Plate'}\n• *Dates:* ${formatTripDates(booking.startDate, booking.endDate)}\n• *Pickup Hub:* ${booking.pickupHub || v.city || 'Ahmedabad Hub'}\n• *24x7 Roadside Helpline:* +91 99000 00001\n\n*Verified by Govt. DigiLocker e-KYC. Present Driving Licence at Handover.*`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    });
  };

  const handleShareInvoice = (booking: any) => {
    const v = booking.vehicle || {};
    const base = Math.round(Number(booking.totalAmount || 2500) / 1.18);
    const gst = Math.round(Number(booking.totalAmount || 2500) - base);
    const invoiceText = `*SAFAR SELF DRIVE PRIVATE LIMITED*\n*GST TAX INVOICE (SAC: 997311)*\n\n• Invoice No: SAFAR-GJ-2026-${String(booking.id).slice(-6).toUpperCase()}\n• GSTIN: 24AABCS1234F1Z5 (Gujarat 24)\n• Guest: ${user?.firstName || 'Safar Guest'} ${user?.lastName || ''}\n• Vehicle: ${v.make} ${v.model}\n• Base Rental: ₹${base.toLocaleString('en-IN')}\n• CGST (9%): ₹${Math.round(gst / 2).toLocaleString('en-IN')}\n• SGST (9%): ₹${Math.round(gst / 2).toLocaleString('en-IN')}\n• *Total Paid:* ₹${Number(booking.totalAmount || 2500).toLocaleString('en-IN')}\n\n*This is a computer-generated GST tax compliant invoice.*`;
    Share.share({ message: invoiceText });
  };

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
      {/* ────────── CLEAN HEADER (NO CAMERA BUTTON HERE) ────────── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>My Trips</Text>
          <Text style={s.headerSub}>Manage your bookings, digital passes & GST invoices</Text>
        </View>

        <TouchableOpacity
          style={s.newDriveBtn}
          onPress={() => router.push('/cars')}
          activeOpacity={0.85}
        >
          <Text style={s.newDriveBtnText}>+ Book Car</Text>
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
          <View style={s.emptyIconCircle}>
            <Car size={34} color="#0F172A" />
          </View>
          <Text style={s.guestTitle}>Sign in to view your trips</Text>
          <Text style={s.guestSub}>
            View your upcoming bookings, upload start/end trip car images on active bookings, and download GST tax invoices.
          </Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/auth/login')}>
            <Text style={s.loginBtnText}>Sign In to Your Account</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={s.loadingText}>Syncing your reservations…</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyScroll}>
          <View style={s.emptyCard}>
            <View style={s.emptyIconCircle}>
              <CalendarDays size={32} color="#0F172A" />
            </View>
            <Text style={s.emptyTitle}>No {activeTab.toLowerCase()} trips found</Text>
            <Text style={s.emptySub}>
              {activeTab === 'Upcoming'
                ? 'You do not have any active or upcoming car bookings right now. Once you book a car, you can manage trip start/end car images here.'
                : `No ${activeTab.toLowerCase()} bookings recorded in your account history.`}
            </Text>

            <TouchableOpacity style={s.browseBtn} onPress={() => router.push('/cars')}>
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
                  <View style={s.regBadgeTopLeft}>
                    <Text style={s.regBadgeTopLeftText}>
                      {vehicle.registrationNumber || 'GJ-01 PRIVATE PLATE'}
                    </Text>
                  </View>
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

                  <View style={s.dateBox}>
                    <Clock size={13} color="#64748B" />
                    <Text style={s.dateRangeText}>
                      {formatTripDates(booking.startDate, booking.endDate)}
                    </Text>
                  </View>

                  <View style={s.locationBox}>
                    <MapPin size={13} color="#FF6000" />
                    <Text style={s.locationText}>
                      Pickup: {booking.pickupHub || vehicle.city || 'Ahmedabad Hub'}
                    </Text>
                  </View>

                  {/* ────────── ONLY ON ACTIVE/CONFIRMED BOOKINGS: START/END TRIP CAR IMAGES ────────── */}
                  {isConfirmed && (
                    <View style={s.featurePillsRow}>
                      <TouchableOpacity
                        style={[s.featurePill, isInspected && s.featurePillActive]}
                        onPress={() => {
                          setInspectionBooking(booking);
                          setInspectionModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Camera size={12} color={isInspected ? '#059669' : '#0F172A'} />
                        <Text style={[s.featurePillText, isInspected && s.featurePillTextGreen]}>
                          {isInspected ? 'Car Images Saved' : 'Car Images (Start/End)'}
                        </Text>
                      </TouchableOpacity>

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

                      <TouchableOpacity
                        style={s.featurePillSos}
                        onPress={() => {
                          setSosBooking(booking);
                          setSosModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <ShieldAlert size={12} color="#DC2626" />
                        <Text style={s.featurePillTextRed}>24×7 SOS</Text>
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
                        {Number(booking.securityDeposit || 0) === 0
                          ? '₹0 Deposit (DigiLocker)'
                          : `₹${booking.securityDeposit} (Refundable)`}
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
                          onPress={() =>
                            router.push({
                              pathname: '/details/[id]',
                              params: { id: String(vehicle.id || booking.vehicleId) },
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <RotateCcw size={14} color="#0F172A" />
                          <Text style={s.bookAgainText}>Book Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.invoiceBtn}
                          onPress={() => {
                            setInvoiceBooking(booking);
                            setInvoiceModalOpen(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <FileText size={14} color="#0F172A" />
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
                          style={s.invoiceBtn}
                          onPress={() => {
                            setInvoiceBooking(booking);
                            setInvoiceModalOpen(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <FileText size={14} color="#0F172A" />
                          <Text style={s.invoiceBtnText}>Invoice</Text>
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
                        onPress={() => router.push('/cars')}
                        activeOpacity={0.8}
                      >
                        <RotateCcw size={15} color="#0F172A" />
                        <Text style={s.bookAgainText}>Browse Available Fleet</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ────────── MODAL 1: START / END TRIP CAR IMAGES (ONLY FOR BOOKED TRIPS) ────────── */}
      <Modal
        visible={inspectionModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectionModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Car Images — Start & End Trip</Text>
                <Text style={s.modalSubtitle}>
                  Upload car images when starting or ending your booked trip ({completedImagesCount}/8)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInspectionModalOpen(false)} style={s.closeCircle}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              {/* Start Trip vs End Trip Selector */}
              <View style={s.stageToggleRow}>
                <TouchableOpacity
                  style={[s.stageBtn, tripStage === 'START' && s.stageBtnActive]}
                  onPress={() => setTripStage('START')}
                >
                  <Text style={[s.stageBtnText, tripStage === 'START' && s.stageBtnTextActive]}>
                    Starting Trip (Pickup)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.stageBtn, tripStage === 'END' && s.stageBtnActive]}
                  onPress={() => setTripStage('END')}
                >
                  <Text style={[s.stageBtnText, tripStage === 'END' && s.stageBtnTextActive]}>
                    Ending Trip (Return)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Car Images Grid */}
              <View style={s.photoSlotsGrid}>
                {CAR_IMAGE_SLOTS.map((slot) => {
                  const uri = inspectionPhotos[slot.key];
                  const hasPhoto = !!uri;
                  return (
                    <View
                      key={slot.key}
                      style={[s.photoSlotCard, hasPhoto && s.photoSlotCardDone]}
                    >
                      {hasPhoto ? (
                        <View style={s.previewBox}>
                          <Image source={{ uri }} style={s.previewImg} resizeMode="cover" />
                          <View style={s.doneTag}>
                            <CheckCircle2 size={11} color="#FFFFFF" />
                            <Text style={s.doneTagText}>Saved</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={s.emptySlotHeader}>
                          <View style={s.slotCameraIconWrap}>
                            <Camera size={16} color="#0F172A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.photoSlotTitle}>{slot.label}</Text>
                            <Text style={s.photoSlotHint}>{slot.hint}</Text>
                          </View>
                        </View>
                      )}

                      {hasPhoto && (
                        <Text style={[s.photoSlotTitle, { marginTop: 6 }]}>{slot.label}</Text>
                      )}

                      <View style={s.slotActionsRow}>
                        <TouchableOpacity
                          style={s.slotCamBtn}
                          onPress={() => handleCapturePhoto(slot.key, 'camera')}
                          activeOpacity={0.8}
                        >
                          <Camera size={12} color="#FFFFFF" />
                          <Text style={s.slotCamBtnText}>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.slotGalleryBtn}
                          onPress={() => handleCapturePhoto(slot.key, 'gallery')}
                          activeOpacity={0.8}
                        >
                          <Upload size={12} color="#0F172A" />
                          <Text style={s.slotGalleryBtnText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Odometer & Fuel */}
              <View style={s.odometerCard}>
                <Text style={s.cardInputLabel}>Current Odometer Reading (km)</Text>
                <TextInput
                  style={s.odometerInput}
                  placeholder="e.g. 18,420"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={inspectionOdometer}
                  onChangeText={setInspectionOdometer}
                />

                <Text style={[s.cardInputLabel, { marginTop: 10 }]}>Fuel Level</Text>
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
                <Text style={s.confirmInspectionText}>
                  Save {tripStage === 'START' ? 'Start Trip' : 'End Trip'} Car Images ({completedImagesCount}/8)
                </Text>
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
                <Text style={s.modalTitle}>24×7 Gujarat Roadside SOS</Text>
                <Text style={s.modalSubtitle}>Immediate roadside support across all Gujarat highways</Text>
              </View>
              <TouchableOpacity onPress={() => setSosModalOpen(false)} style={s.closeCircle}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={s.sosCallBtn}
                onPress={() => Linking.openURL('tel:+919900000001')}
                activeOpacity={0.88}
              >
                <Phone size={20} color="#FFF" />
                <View>
                  <Text style={s.sosCallBtnTitle}>Call 24×7 Roadside Helpline</Text>
                  <Text style={s.sosCallBtnSub}>+91 99000 00001 • Instant Dispatch</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.sosWhatsappBtn}
                onPress={() => {
                  const msg = `*EMERGENCY ROADSIDE REQUEST - SAFAR SELF DRIVE*\n• Booking: #${sosBooking?.id || 'ACTIVE'}\n• Car: ${sosBooking?.vehicle?.make} ${sosBooking?.vehicle?.model}\n• Location: Gujarat Highway\nPlease dispatch RSA vehicle.`;
                  Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                }}
                activeOpacity={0.88}
              >
                <Navigation size={18} color="#25D366" />
                <Text style={s.sosWhatsappText}>Share Live GPS Location with Safar Desk</Text>
              </TouchableOpacity>

              <View style={s.sosServicesList}>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>01. Flat Tyre Assistance</Text>
                  <Text style={s.sosServiceSub}>Stepney swap or puncture repair anywhere on highway</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>02. Dead Battery Jumpstart</Text>
                  <Text style={s.sosServiceSub}>Quick booster battery restart within 30–45 minutes</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>03. 5L Emergency Fuel Delivery</Text>
                  <Text style={s.sosServiceSub}>Direct emergency fuel delivery if stranded</Text>
                </View>
                <View style={s.sosServiceItem}>
                  <Text style={s.sosServiceTitle}>04. Flatbed Towing & Replacement</Text>
                  <Text style={s.sosServiceSub}>Free towing to nearest hub & replacement vehicle</Text>
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
                <Text style={s.modalSubtitle}>Transparent NHAI toll tracking & fuel policy</Text>
              </View>
              <TouchableOpacity onPress={() => setLedgerModalOpen(false)} style={s.closeCircle}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View style={s.ledgerCard}>
                <View style={s.ledgerCardHeader}>
                  <Fuel size={16} color="#FF6000" />
                  <Text style={s.ledgerCardTitle}>Like-to-Like Fuel Guarantee</Text>
                </View>
                <Text style={s.ledgerCardText}>
                  You received this car with a <Text style={{ fontWeight: '800' }}>100% Full Tank</Text>. Return with the same level or settle the difference at exact Gujarat pump rates without any surcharge.
                </Text>
              </View>

              <View style={s.ledgerCard}>
                <View style={s.ledgerCardHeader}>
                  <Receipt size={16} color="#0F172A" />
                  <Text style={s.ledgerCardTitle}>Gujarat NHAI FASTag Toll Passes</Text>
                </View>
                <View style={s.tollRow}>
                  <Text style={s.tollName}>Ahmedabad – Vadodara NE-1 Expressway</Text>
                  <Text style={s.tollAmount}>₹135</Text>
                </View>
                <View style={s.tollRow}>
                  <Text style={s.tollName}>SG Highway Ring Road Plaza</Text>
                  <Text style={s.tollAmount}>₹50</Text>
                </View>
                <View style={[s.tollRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[s.tollName, { fontWeight: '800', color: '#0F172A' }]}>Total Tolls Incurred</Text>
                  <Text style={[s.tollAmount, { fontWeight: '800', color: '#0F172A', fontSize: 14 }]}>₹185</Text>
                </View>
              </View>

              <Text style={s.ledgerFootnote}>
                FASTag toll amounts are auto-settled from your Safar Cash wallet at trip completion.
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
                <Text style={s.modalSubtitle}>Government GST-compliant tax receipt (SAC: 997311)</Text>
              </View>
              <TouchableOpacity onPress={() => setInvoiceModalOpen(false)} style={s.closeCircle}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {invoiceBooking && (
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                <View style={s.invoiceCard}>
                  <View style={s.invoiceHeaderRow}>
                    <View>
                      <Text style={s.companyName}>Safar Self Drive Pvt. Ltd.</Text>
                      <Text style={s.gstinText}>GSTIN: 24AABCS1234F1Z5 (Gujarat)</Text>
                      <Text style={s.gstinText}>SAC Code: 997311 (Self-Drive Rental)</Text>
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
                  <Text style={s.shareInvoiceBtnText}>Share / Download Tax Invoice</Text>
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
              <TouchableOpacity onPress={() => setReviewModalOpen(false)} style={s.closeCircle}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSubtitle}>
              How was your experience with {selectedBooking?.vehicle?.make} {selectedBooking?.vehicle?.model}?
            </Text>

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
              placeholderTextColor="#94A3B8"
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
                <Text style={s.submitReviewText}>Submit Verified Review</Text>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  newDriveBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newDriveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Tabs */
  tabBarWrap: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#FF6000',
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
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardImageContainer: {
    height: 165,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardCarImage: {
    width: '88%',
    height: '88%',
  },
  regBadgeTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#0F172A',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  regBadgeTopLeftText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  whatsappBtnCorner: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  carModel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
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
    color: '#334155',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  locationText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
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
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 7,
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
    paddingVertical: 7,
  },
  featurePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  featurePillTextGreen: {
    color: '#059669',
  },
  featurePillTextRed: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
  },

  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 11,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fareLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  depositLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  depositValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
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
    borderColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 9,
  },
  bookAgainText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  invoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invoiceBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  rateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  rateBtnText: {
    color: '#FF6000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  handoverPassBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingVertical: 10,
  },
  handoverPassText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  cancelTripBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  cancelTripText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Empty & Loading */
  emptyScroll: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 18,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    width: '100%',
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
    padding: 28,
    gap: 10,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  guestSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
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
    color: '#64748B',
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Start vs End Trip Toggle */
  stageToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  stageBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  stageBtnActive: {
    backgroundColor: '#0F172A',
  },
  stageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stageBtnTextActive: {
    color: '#FFFFFF',
  },

  photoSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoSlotCard: {
    width: (W - 52) / 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
  },
  photoSlotCardDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  emptySlotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  slotCameraIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  photoSlotHint: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 1,
  },
  previewBox: {
    height: 78,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  doneTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(5, 150, 105, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  slotActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  slotCamBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 6,
  },
  slotCamBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  slotGalleryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
  },
  slotGalleryBtnText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '700',
  },

  odometerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardInputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  odometerInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  fuelChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fuelChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  fuelChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  fuelChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  fuelChipTextActive: {
    color: '#FFFFFF',
  },
  confirmInspectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  confirmInspectionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* SOS Modal */
  sosCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    padding: 14,
  },
  sosCallBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  sosCallBtnSub: {
    color: '#FEE2E2',
    fontSize: 11,
    marginTop: 2,
  },
  sosWhatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 12,
  },
  sosWhatsappText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  sosServicesList: {
    gap: 8,
    marginTop: 4,
  },
  sosServiceItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sosServiceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  sosServiceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* FASTag & Fuel Ledger Modal */
  ledgerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  ledgerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ledgerCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerCardText: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 17,
  },
  tollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tollName: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  tollAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  ledgerFootnote: {
    fontSize: 10.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },

  /* GST Invoice Modal */
  invoiceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  gstinText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  invoiceNumberBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  invoiceNumberLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0F172A',
  },
  invoiceNumberVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FF6000',
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  metaSub: {
    fontSize: 10,
    color: '#64748B',
  },
  invoiceLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  invoiceLineKey: {
    fontSize: 11.5,
    color: '#475569',
  },
  invoiceLineVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  invoiceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
    paddingTop: 10,
  },
  invoiceTotalKey: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  invoiceTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#059669',
  },
  shareInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
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
    marginVertical: 16,
  },
  reviewInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitReviewBtn: {
    backgroundColor: '#FF6000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitReviewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
