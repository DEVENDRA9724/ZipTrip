import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { Calendar, AlertCircle, LogIn, ChevronRight, CheckCircle2, XCircle } from 'lucide-react-native';

const TRIP_STATUSES = ['Upcoming', 'Completed', 'Cancelled'];

export default function TripsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const authContext = require('@/context/AuthContext');
  const { user } = authContext.useAuth();

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      'Are you sure you want to cancel this booking? The full amount will be refunded to your wallet.',
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
              Alert.alert('Success', 'Booking cancelled and money refunded to wallet.');
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

  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderBookingCard = ({ item }: { item: any }) => {
    const images = item.vehicle.images.split(',');
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
    alignItems: 'flex-end',
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
});
