import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const formatDate = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function BookingAgreementScreen() {
  const colors = Colors.light;
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  const loadAgreement = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try { setAgreement(await apiRequest(`/bookings/${encodeURIComponent(id)}/agreement`)); }
    catch (error: any) { Alert.alert('Agreement unavailable', error.message || 'Could not load this booking agreement.'); }
    finally { setLoading(false); }
  }, [id, user]);

  React.useEffect(() => { loadAgreement(); }, [loadAgreement]);

  const acknowledge = async () => {
    setAcknowledging(true);
    try {
      const result = await apiRequest(`/bookings/${encodeURIComponent(id as string)}/agreement/acknowledge`, { method: 'POST' });
      setAgreement((current: any) => ({ ...current, acknowledgement: result }));
      Alert.alert('Agreement acknowledged', `Recorded at ${formatDate(result.acceptedAt)}`);
    } catch (error: any) { Alert.alert('Could not acknowledge', error.message || 'Please try again.'); }
    finally { setAcknowledging(false); }
  };

  if (!user) return null;
  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} style={styles.loader} /></SafeAreaView>;
  if (!agreement) return null;

  const B = agreement.booking;
  const V = agreement.vehicle;
  const C = agreement.customer;
  const H = agreement.host;
  const F = agreement.scheduleIII || {};
  const cancellation = agreement.scheduleIV || {};
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}><ArrowLeft size={19} color={colors.text} /></TouchableOpacity>
          <View style={{ flex: 1 }}><ThemedText style={styles.title}>Booking agreement</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>{agreement.agreementVersion}</ThemedText></View>
          <FileText size={25} color={colors.primary} />
        </View>
        <View style={[styles.notice, { backgroundColor: colors.cardBg, borderColor: colors.border }]}><ThemedText style={styles.cardTitle}>{['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(B.status) ? 'Confirmed rental agreement' : 'Draft booking agreement'}</ThemedText><ThemedText style={[styles.muted, { color: colors.textSecondary }]}>Every field below is generated from this booking, customer, host and vehicle record.</ThemedText></View>
        <Section title="Parties"><Info label="Guest" value={`${C.firstName} ${C.lastName}\n${C.email}${C.phone ? `\n${C.phone}` : ''}`} /><Info label="Host" value={`${H.firstName} ${H.lastName}\n${H.email}${H.phone ? `\n${H.phone}` : ''}`} /></Section>
        <Section title="Booking and trip details"><Info label="Reference" value={B.reference} /><Info label="Pickup" value={formatDate(B.startDate)} /><Info label="Return" value={formatDate(B.endDate)} /><Info label="Location" value={agreement.scheduleI?.designatedLocation || V.locationCity} /><Info label="Status" value={`${B.status} · ${B.paymentStatus?.replaceAll('_', ' ')}`} /></Section>
        <Section title="Vehicle details"><Info label="Vehicle" value={`${V.make} ${V.model} (${V.year})`} /><Info label="Registration" value={V.registrationNumber || 'Assigned at pickup'} /><Info label="Category" value={`${V.category} · ${V.transmission} · ${V.fuelType}`} /><Info label="Seats" value={String(V.seats)} /></Section>
        <Section title="Charges and policy"><Info label="Rental" value={money(B.rentalAmount)} /><Info label="Security deposit" value={money(B.securityDeposit)} /><Info label="Booking total" value={money(B.totalAmount)} /><Info label="Included distance" value={`${B.includedKilometres ?? 'As stated at booking'} km`} /><Info label="Excess distance" value={`${money(F.excessKmRate || B.excessKmRate)} / km`} /><Info label="Late return" value={`${F.lateGraceMinutes || B.lateReturnGraceMinutes} min grace · ${money(F.lateReturnRatePerHour || B.lateReturnRatePerHour)} / hour`} /></Section>
        <Section title="Cancellation policy"><Info label="More than 48 hours" value={cancellation.moreThan48Hours || 'As stated in Fee Policy'} /><Info label="24 to 48 hours" value={cancellation.between24And48Hours || 'As stated in Fee Policy'} /><Info label="Less than 24 hours" value={cancellation.lessThan24Hours || 'As stated in Fee Policy'} /></Section>
        <Section title="Agreement terms"><View style={styles.terms}>{(agreement.terms || []).map((term: string, index: number) => <View key={`${index}-${term}`} style={styles.termRow}><ThemedText style={[styles.termNumber, { color: colors.primary }]}>{index + 1}</ThemedText><ThemedText style={styles.termText}>{term}</ThemedText></View>)}</View></Section>
        <TouchableOpacity style={[styles.ackButton, { backgroundColor: agreement.acknowledgement ? colors.success : colors.primary }]} onPress={acknowledge} disabled={!!agreement.acknowledgement || acknowledging}>{acknowledging ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={18} color="#fff" />}<ThemedText style={styles.ackText}>{agreement.acknowledgement ? 'Agreement acknowledged' : 'Acknowledge agreement'}</ThemedText></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><ThemedText style={styles.sectionTitle}>{title}</ThemedText>{children}</View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><ThemedText style={styles.infoLabel}>{label}</ThemedText><ThemedText style={styles.infoValue}>{value}</ThemedText></View>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: Spacing.three, paddingBottom: 100, gap: Spacing.three }, loader: { flex: 1 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, title: { fontSize: 24, fontWeight: '800' }, muted: { fontSize: 13, lineHeight: 19 }, notice: { padding: Spacing.three, borderRadius: 15, borderWidth: 1 }, cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 }, section: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 15, padding: Spacing.three, gap: Spacing.two }, sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: Spacing.one }, info: { borderBottomColor: '#E2E8F0', borderBottomWidth: 1, paddingBottom: Spacing.two }, infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }, infoValue: { fontSize: 14, lineHeight: 20, marginTop: 2 }, terms: { gap: Spacing.two }, termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two }, termNumber: { fontWeight: '800', width: 22 }, termText: { flex: 1, fontSize: 14, lineHeight: 20 }, ackButton: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.two }, ackText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
