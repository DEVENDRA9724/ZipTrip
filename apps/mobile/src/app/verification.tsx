import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { CheckCircle2, ExternalLink, FileCheck2, LogIn, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type KycSession = { id: string; status: string; environment: string; expiresAt?: string };
type KycDocument = { id: string; kind: string; source?: string; status?: string; mediaId?: string | null };

export default function VerificationScreen() {
  const colors = Colors.light;
  const { user } = useAuth();
  const [sessions, setSessions] = useState<KycSession[]>([]);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const status = await apiRequest('/kyc');
      setSessions(status.sessions || []);
      setDocuments(status.documents || []);
    } catch (error: any) {
      Alert.alert('Verification unavailable', error.message || 'Could not load verification status.');
    } finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));
  const refresh = async () => { setRefreshing(true); await loadStatus(); setRefreshing(false); };

  const startVerification = async () => {
    setAction('start');
    try {
      const result = await apiRequest('/kyc/sessions', { method: 'POST', body: JSON.stringify({ consent: true }) });
      if (!result.authorizationUrl) throw new Error('DigiLocker did not return an authorization link.');
      await Linking.openURL(result.authorizationUrl);
      Alert.alert('Complete verification', 'Finish DigiLocker verification, then return here and tap Sync latest session.');
      await loadStatus();
    } catch (error: any) { Alert.alert('Could not start verification', error.message || 'Please try again.'); }
    finally { setAction(null); }
  };

  const syncSession = async (session: KycSession) => {
    setAction(session.id);
    try {
      const result = await apiRequest(`/kyc/sessions/${session.id}/sync`, { method: 'POST' });
      const failed = (result.syncResults || []).filter((item: any) => item.state === 'FAILED');
      if (failed.length) Alert.alert('Documents not available yet', failed.map((item: any) => `${item.kind}: ${item.message}`).join('\n'));
      else Alert.alert('Verification synced', 'Your latest DigiLocker records are now available for review.');
      await loadStatus();
    } catch (error: any) { Alert.alert('Sync failed', error.message || 'The session may have expired. Start a new verification.'); }
    finally { setAction(null); }
  };

  if (!user) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.center}>
        <ShieldCheck size={52} color={colors.primary} />
        <ThemedText style={styles.title}>Identity verification</ThemedText>
        <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>Sign in to complete Aadhaar and driving licence verification.</ThemedText>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/auth/login')}>
          <LogIn size={18} color="#fff" /><ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const latestSession = sessions[0];
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}><ThemedText style={styles.title}>Verification centre</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>Securely verify your identity before booking.</ThemedText></View>
          <ShieldCheck size={30} color={colors.primary} />
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.infoIcon}><FileCheck2 size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}><ThemedText style={styles.cardTitle}>Aadhaar eKYC + Driving licence</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>Safar redirects you to the official DigiLocker gateway. We never collect your Aadhaar OTP.</ThemedText></View>
        </View>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={startVerification} disabled={!!action || loading}>
          {action === 'start' ? <ActivityIndicator color="#fff" /> : <ExternalLink size={18} color="#fff" />}<ThemedText style={styles.primaryButtonText}>Continue with DigiLocker</ThemedText>
        </TouchableOpacity>
        {latestSession && <View style={[styles.sessionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.headerRow}><View><ThemedText style={styles.cardTitle}>Latest DigiLocker session</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>{latestSession.environment.toUpperCase()} · {latestSession.status.toUpperCase()}</ThemedText></View>{latestSession.status.toLowerCase() === 'succeeded' ? <CheckCircle2 size={23} color={colors.success} /> : <TriangleAlert size={23} color={colors.primary} />}</View>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={() => syncSession(latestSession)} disabled={!!action}>
            {action === latestSession.id ? <ActivityIndicator color={colors.primary} /> : <RefreshCw size={17} color={colors.primary} />}<ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Sync latest session</ThemedText>
          </TouchableOpacity>
        </View>}
        <ThemedText style={styles.sectionTitle}>Submitted records</ThemedText>
        {loading && !documents.length ? <ActivityIndicator color={colors.primary} /> : documents.length === 0 ? <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>No records yet. Complete DigiLocker verification to get started.</ThemedText> : documents.map(document => (
          <View key={document.id} style={[styles.documentRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <FileCheck2 size={20} color={document.status === 'APPROVED' ? colors.success : colors.primary} /><View style={{ flex: 1 }}><ThemedText style={styles.cardTitle}>{document.kind === 'AADHAAR' ? 'Aadhaar' : 'Driving licence'}</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>{document.status || 'PENDING'} · {document.source || 'DIGILOCKER'}</ThemedText></View><ThemedText style={[styles.statusText, { color: document.status === 'APPROVED' ? colors.success : colors.primary }]}>{document.status || 'PENDING'}</ThemedText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: Spacing.three, paddingBottom: 120, gap: Spacing.three }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: Spacing.two }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, title: { fontSize: 26, fontWeight: '800' }, sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: Spacing.two }, cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 }, muted: { fontSize: 13, lineHeight: 19 }, infoCard: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: 16, borderWidth: 1 }, infoIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F47B2018' }, primaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three }, primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' }, secondaryButton: { minHeight: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.three }, secondaryButtonText: { fontWeight: '800' }, sessionCard: { padding: Spacing.three, borderRadius: 16, borderWidth: 1 }, documentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 14, borderWidth: 1 }, statusText: { fontSize: 11, fontWeight: '800' },
});
