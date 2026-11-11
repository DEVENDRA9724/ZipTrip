import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  ArrowLeft,
  Lock,
} from 'lucide-react-native';

import { apiRequest } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type KycSession = { id: string; status: string; environment: string; expiresAt?: string };
type KycDocument = { id: string; kind: string; source?: string; status?: string; mediaId?: string | null };

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<KycSession[]>([]);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const status = await apiRequest('/kyc');
      setSessions(status.sessions || []);
      setDocuments(status.documents || []);
    } catch (error: any) {
      Alert.alert('Verification unavailable', error.message || 'Could not load verification status.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const refresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const startVerification = async () => {
    setAction('start');
    try {
      const result = await apiRequest('/kyc/sessions', {
        method: 'POST',
        body: JSON.stringify({ consent: true }),
      });
      if (!result.authorizationUrl) {
        throw new Error('DigiLocker did not return an authorization link.');
      }
      await Linking.openURL(result.authorizationUrl);
      Alert.alert('Complete verification', 'Finish DigiLocker verification, then return here and tap Sync latest session.');
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Could not start verification', error.message || 'Please try again.');
    } finally {
      setAction(null);
    }
  };

  const syncSession = async (session: KycSession) => {
    setAction(session.id);
    try {
      const result = await apiRequest(`/kyc/sessions/${session.id}/sync`, { method: 'POST' });
      const failed = (result.syncResults || []).filter((item: any) => item.state === 'FAILED');
      if (failed.length) {
        Alert.alert('Documents not available yet', failed.map((item: any) => `${item.kind}: ${item.message}`).join('\n'));
      } else {
        Alert.alert('Verification synced', 'Your latest DigiLocker records are now available for review.');
      }
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Sync failed', error.message || 'The session may have expired. Start a new verification.');
    } finally {
      setAction(null);
    }
  };

  if (!user) {
    return (
      <View style={[styles.screen, { paddingTop: topPadding }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#2D114D" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Verification Centre</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.center}>
          <View style={styles.shieldIconWrap}>
            <ShieldCheck size={48} color="#2D114D" />
          </View>
          <Text style={styles.authTitle}>Identity Verification</Text>
          <Text style={styles.authSub}>Sign in to complete Aadhaar and driving licence verification via DigiLocker.</Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <LogIn size={18} color="#FFFFFF" />
            <Text style={styles.signInBtnText}>Sign In to Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const latestSession = sessions[0];
  const isAllApproved = documents.length > 0 && documents.every((d) => d.status === 'APPROVED');

  return (
    <View style={[styles.screen, { paddingTop: topPadding }]}>
      {/* ────────── TOP APP BAR (CLEAR OF NOTCH) ────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#2D114D" />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Verification Centre</Text>
          <Text style={styles.topBarSub}>Aadhaar & Driving Licence</Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.backBtn} activeOpacity={0.7}>
          <RefreshCw size={17} color="#2D114D" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#2D114D" />}
      >
        {/* Status Callout Banner */}
        <View style={[styles.bannerCard, isAllApproved ? styles.bannerApproved : styles.bannerPending]}>
          <View style={styles.bannerIconWrap}>
            {isAllApproved ? (
              <CheckCircle2 size={24} color="#059669" />
            ) : (
              <ShieldCheck size={24} color="#2D114D" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {isAllApproved ? 'Zero Security Deposit Active' : 'Govt. DigiLocker Gateway'}
            </Text>
            <Text style={styles.bannerSub}>
              {isAllApproved
                ? 'Your Aadhaar & DL are verified. Enjoy ₹0 security deposit on all trips.'
                : 'Instant 1-minute verification via official DigiLocker. We never store your credentials.'}
            </Text>
          </View>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={startVerification}
          disabled={!!action || loading}
          activeOpacity={0.88}
        >
          {action === 'start' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <ExternalLink size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Continue with DigiLocker</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Security Assurance */}
        <View style={styles.trustRow}>
          <Lock size={12} color="#6B7280" />
          <Text style={styles.trustText}>256-bit SSL encrypted • MeitY & DigiLocker compliant</Text>
        </View>

        {/* Latest Session Card if any */}
        {latestSession && (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>Latest DigiLocker Session</Text>
                <Text style={styles.sessionStatusText}>
                  {latestSession.environment.toUpperCase()} • {latestSession.status.toUpperCase()}
                </Text>
              </View>
              {latestSession.status.toLowerCase() === 'succeeded' ? (
                <CheckCircle2 size={22} color="#059669" />
              ) : (
                <TriangleAlert size={22} color="#FF6000" />
              )}
            </View>

            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => syncSession(latestSession)}
              disabled={!!action}
              activeOpacity={0.75}
            >
              {action === latestSession.id ? (
                <ActivityIndicator color="#2D114D" />
              ) : (
                <>
                  <RefreshCw size={15} color="#2D114D" />
                  <Text style={styles.syncButtonText}>Sync Latest Records</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Submitted Documents Section */}
        <Text style={styles.sectionHeader}>Submitted Records</Text>

        {loading && !documents.length ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#2D114D" />
            <Text style={styles.emptyText}>Checking verification status…</Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileCheck2 size={36} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No records submitted yet</Text>
            <Text style={styles.emptyText}>Tap the button above to verify your driving licence and Aadhaar via DigiLocker.</Text>
          </View>
        ) : (
          documents.map((document) => {
            const approved = document.status === 'APPROVED';
            return (
              <View key={document.id} style={styles.documentCard}>
                <View style={[styles.docIconBox, approved ? styles.docIconApproved : styles.docIconPending]}>
                  <FileCheck2 size={20} color={approved ? '#059669' : '#2D114D'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>
                    {document.kind === 'AADHAAR' ? 'Aadhaar eKYC' : 'Driving Licence'}
                  </Text>
                  <Text style={styles.docMeta}>
                    Source: {document.source || 'DIGILOCKER'}
                  </Text>
                </View>
                <View style={[styles.docStatusBadge, approved ? styles.badgeApproved : styles.badgePending]}>
                  <Text style={[styles.docStatusText, approved ? styles.statusApprovedText : styles.statusPendingText]}>
                    {document.status || 'PENDING'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEBF5',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3EEFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D114D',
  },
  topBarSub: {
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  bannerPending: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  bannerApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
  },
  bannerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: '#FF6000',
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -4,
  },
  trustText: {
    fontSize: 11,
    color: '#6B7280',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 12,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
  },
  sessionStatusText: {
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D114D',
    backgroundColor: '#FAF5FF',
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D114D',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEBF5',
    gap: 12,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconApproved: {
    backgroundColor: '#ECFDF5',
  },
  docIconPending: {
    backgroundColor: '#FAF5FF',
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D114D',
  },
  docMeta: {
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 2,
  },
  docStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeApproved: {
    backgroundColor: '#ECFDF5',
  },
  badgePending: {
    backgroundColor: '#FFF7ED',
  },
  docStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusApprovedText: {
    color: '#059669',
  },
  statusPendingText: {
    color: '#FF6000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  shieldIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2D114D',
  },
  authSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  signInBtn: {
    backgroundColor: '#FF6000',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
