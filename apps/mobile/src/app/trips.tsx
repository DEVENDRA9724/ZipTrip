import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, FlatList, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest, parseImageList } from '@/services/api';
import { Calendar, AlertCircle, LogIn, ChevronRight, CheckCircle2, XCircle } from 'lucide-react-native';

const TRIP_STATUSES = ['Upcoming', 'Completed', 'Cancelled'];

export default function TripsScreen() {
  const colors = Colors.light;

  const authContext = require('@/context/AuthContext');
  const { user } = authContext.useAuth();

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [ratingBooking, setRatingBooking] = useState<any | null>(null);
  const [ratingTarget, setRatingTarget] = useState<'vehicle' | 'host'>('vehicle');
  const [ratingValue, setRatingValue] = useState('5');
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchTrips();
      }
    }, [user, activeTab])
  );

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/bookings/my-trips');
      
      // Filter based on tab selection
      const now = new Date();
      const filtered = data.filter((booking: any) => {
        if (booking.status === 'CANCELLED') {
          return activeTab === 'Cancelled';
        }
        
        const tripEnd = new Date(booking.endDate);
        if (tripEnd < now || booking.status === 'COMPLETED') {
          return activeTab === 'Completed';
        }
        
        return activeTab === 'Upcoming';
      });
      
      setTrips(filtered);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? The cancellation policy will be applied and any eligible refund will be reviewed by Safar.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(bookingId);
            try {
              await apiRequest(`/bookings/${bookingId}/cancel`, {
                method: 'POST',
              });
              Alert.alert('Cancellation submitted', 'Your booking was cancelled. Any eligible refund is now pending administrator reconciliation.');
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

  const submitRating = async () => {
    if (!ratingBooking) return;
    const rating = Number(ratingValue);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Alert.alert('Rating required', 'Choose a rating from 1 to 5.');
    setRatingBusy(true);
    try {
      await apiRequest(ratingTarget === 'vehicle' ? '/reviews' : '/reviews/party', {
        method: 'POST',
        body: JSON.stringify({ bookingId: ratingBooking.id, ...(ratingTarget === 'host' ? { targetRole: 'HOST' } : {}), rating, comment: ratingComment.trim() || undefined }),
      });
      setRatingBooking(null);
      Alert.alert('Rating submitted', `Your ${ratingTarget} rating was saved.`);
      fetchTrips();
    } catch (error: any) {
      Alert.alert('Rating failed', error.message || 'Could not save this rating.');
    } finally {
      setRatingBusy(false);
    }
  };

  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderBookingCard = ({ item }: { item: any }) => {
    const images = parseImageList(item.vehicle.images);
    const isUpcoming = activeTab === 'Upcoming';
    
    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.cardMain}>
          <Image source={{ uri: images[0] }} style={styles.carImage} />
          
          <View style={styles.cardContent}>
            <View style={styles.refRow}>
              <ThemedText type="small" style={styles.refText}>{item.bookingRef}</ThemedText>
              <View style={[
                styles.statusDot, 
                { backgroundColor: item.status === 'CANCELLED' ? colors.error : colors.success }
              ]} />
            </View>

            <ThemedText style={styles.carName}>{item.vehicle.make} {item.vehicle.model}</ThemedText>
            
            <View style={styles.infoRow}>
              <Calendar size={14} color={colors.textSecondary} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {formatDateString(item.startDate)} - {formatDateString(item.endDate)}
              </ThemedText>
            </View>

            <ThemedText style={[styles.priceText, { color: colors.text }]}>
              Paid: ₹{Number(item.totalAmount).toLocaleString('en-IN')}
            </ThemedText>
          </View>
        </View>

        {isUpcoming && item.status === 'CONFIRMED' && (
          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.agreementBtn, { borderColor: colors.primary }]}
              onPress={() => router.push({ pathname: '/booking/agreement' as any, params: { id: item.id } })}
            >
              <ThemedText style={[styles.agreementBtnText, { color: colors.primary }]}>Agreement</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.error }]}
              onPress={() => handleCancelBooking(item.id)}
              disabled={actionLoading === item.id}
            >
              {actionLoading === item.id ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <ThemedText style={[styles.cancelBtnText, { color: colors.error }]}>Cancel Booking</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'COMPLETED' && (
          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.agreementBtn, { borderColor: colors.primary }]} onPress={() => { setRatingBooking(item); setRatingTarget('vehicle'); setRatingValue('5'); setRatingComment(''); }}>
              <ThemedText style={[styles.agreementBtnText, { color: colors.primary }]}>Rate vehicle</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.primary }]} onPress={() => { setRatingBooking(item); setRatingTarget('host'); setRatingValue('5'); setRatingComment(''); }}>
              <ThemedText style={[styles.cancelBtnText, { color: colors.primary }]}>Rate host</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render Login Prompt if Guest
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">My Trips</ThemedText>
        </View>
        <View style={styles.center}>
          <AlertCircle size={48} color={colors.textSecondary} style={{ marginBottom: Spacing.three }} />
          <ThemedText style={styles.promptTitle}>View Your Bookings</ThemedText>
          <ThemedText type="small" style={[styles.promptDesc, { color: colors.textSecondary }]}>
            Please sign in to view your upcoming, completed, and cancelled trips.
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
      <View style={styles.header}>
        <ThemedText type="title">My Trips</ThemedText>
        <ThemedText type="small" style={{ color: colors.textSecondary }}>Manage your rentals</ThemedText>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {TRIP_STATUSES.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && [styles.tabActive, { borderBottomColor: colors.primary }]
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <ThemedText style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === tab && { color: colors.primary, fontWeight: 'bold' }
            ]}>
              {tab}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Booking List */}
      {loading ? (
        <View style={styles.listCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.listCenter}>
          <Calendar size={36} color={colors.textSecondary} style={{ marginBottom: Spacing.two }} />
          <ThemedText style={{ color: colors.textSecondary }}>No {activeTab.toLowerCase()} trips found.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderBookingCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
      <Modal visible={Boolean(ratingBooking)} animationType="slide" transparent onRequestClose={() => !ratingBusy && setRatingBooking(null)}>
        <View style={styles.modalBg}>
          <SafeAreaView style={[styles.ratingModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Rate {ratingTarget}</ThemedText>
              <TouchableOpacity disabled={ratingBusy} onPress={() => setRatingBooking(null)}><ThemedText style={{ color: colors.error, fontWeight: 'bold' }}>Close</ThemedText></TouchableOpacity>
            </View>
            <View style={styles.ratingForm}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Booking {ratingBooking?.bookingRef || ''}</ThemedText>
              <TextInput style={[styles.ratingInput, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]} value={ratingValue} onChangeText={setRatingValue} keyboardType="numeric" placeholder="Rating 1 to 5" placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.ratingInput, styles.ratingComment, { color: colors.text, backgroundColor: colors.cardBg, borderColor: colors.border }]} value={ratingComment} onChangeText={setRatingComment} multiline placeholder="Optional comment" placeholderTextColor={colors.textSecondary} />
              <TouchableOpacity style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={submitRating} disabled={ratingBusy}>{ratingBusy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.loginBtnText}>Submit Rating</ThemedText>}</TouchableOpacity>
            </View>
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: Spacing.two,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    // borderBottomColor set dynamically
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 100,
    gap: Spacing.three,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    padding: Spacing.three,
  },
  carImage: {
    width: 90,
    height: 70,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.three,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.half,
  },
  refText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  carName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.half,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.half,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: Spacing.half,
  },
  cardActions: {
    borderTopWidth: 1,
    padding: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ratingModal: {
    minHeight: '42%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  ratingForm: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  ratingInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  ratingComment: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  agreementBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  agreementBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
