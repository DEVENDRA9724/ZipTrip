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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

const TABS = [
  { key: 'Upcoming', label: 'Upcoming' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

export default function TripsScreen() {
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
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* ────────── HEADER ────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>My Trips</Text>
          <Text style={s.headerSub}>Manage your bookings & digital passes</Text>
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
            Track upcoming bookings, download invoices, and access your digital vehicle handover pass.
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

            return (
              <View key={booking.id} style={s.tripCard}>
                {/* Car Showcase Image */}
                <View style={s.cardImageContainer}>
                  <Image
                    source={getVehicleImageSource(vehicle)}
                    style={s.cardCarImage}
                    resizeMode="contain"
                  />
                  {/* Heart / Wishlist icon */}
                  <TouchableOpacity style={s.heartIconBox} activeOpacity={0.8}>
                    <Heart size={16} color="#2D114D" />
                  </TouchableOpacity>

                  {/* Dots carousel indicator */}
                  <View style={s.dotsRow}>
                    <View style={[s.dot, s.dotActive]} />
                    <View style={s.dot} />
                    <View style={s.dot} />
                    <View style={s.dot} />
                  </View>
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
                          <RotateCcw size={15} color="#2D114D" />
                          <Text style={s.bookAgainText}>Book Again</Text>
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
                          <Text style={s.rateBtnText}>Rate Drive</Text>
                        </TouchableOpacity>
                      </>
                    ) : isConfirmed ? (
                      <>
                        <TouchableOpacity
                          style={s.handoverPassBtn}
                          onPress={() => {
                            Alert.alert(
                              'Digital Handover Pass',
                              `Booking ID: ${booking.bookingId || booking.id}\nVehicle: ${vehicle.make} ${vehicle.model}\nPickup: ${booking.pickupHub || 'Ahmedabad Hub'}\n\nPresent your DigiLocker verified driving licence at pickup to collect keys.`
                            );
                          }}
                          activeOpacity={0.8}
                        >
                          <Key size={14} color="#FFF" />
                          <Text style={s.handoverPassText}>Handover Pass</Text>
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
    </SafeAreaView>
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F1235',
  },
  headerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  newDriveBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    height: 180,
    backgroundColor: '#FAF8FC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardCarImage: {
    width: '90%',
    height: '90%',
  },
  heartIconBox: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(45, 17, 77, 0.25)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#2D114D',
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
    color: '#1F1235',
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
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
    color: '#1F1235',
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
    gap: 10,
  },
  bookAgainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2D114D',
    borderRadius: 12,
    paddingVertical: 10,
  },
  bookAgainText: {
    color: '#2D114D',
    fontSize: 12,
    fontWeight: '800',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rateBtnText: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '700',
  },
  handoverPassBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D114D',
    borderRadius: 12,
    paddingVertical: 11,
  },
  handoverPassText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelTripBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  cancelTripText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Empty & Guest States */
  emptyScroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1235',
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
    borderRadius: 14,
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
    padding: 30,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1235',
    marginTop: 14,
  },
  guestSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
  },
  loginBtn: {
    backgroundColor: '#2D114D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
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
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
  },

  /* Review Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1235',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  reviewInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    minHeight: 90,
  },
  submitReviewBtn: {
    backgroundColor: '#2D114D',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  submitReviewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
