import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SafarHeader } from '@/components/safar-header';
import { getVehicleImageSource } from '@/services/api';
import {
  Compass,
  HelpCircle,
  PhoneCall,
  Mail,
  MessageCircle,
  ShieldCheck,
  FileText,
  Camera,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Clock,
} from 'lucide-react-native';

const GUJARAT_GUIDES = [
  {
    id: 'sou',
    title: 'Ahmedabad / Vadodara → Statue of Unity (Kevadia)',
    distance: '198 km • 3.5 hrs drive',
    pickupHub: 'Ahmedabad',
    recommendedCar: { make: 'Hyundai', model: 'Creta SX(O)', category: 'SUV' },
    highlights: 'Expressway drive via Vadodara, Sardar Sarovar Dam viewpoint, Valley of Flowers & Laser Show.',
    bestFor: 'Family & Weekend Drive',
  },
  {
    id: 'gir',
    title: 'Ahmedabad / Rajkot → Sasan Gir National Park & Somnath',
    distance: '365 km • 6.5 hrs drive',
    pickupHub: 'Rajkot',
    recommendedCar: { make: 'Mahindra', model: 'Thar 4x4', category: 'SUV' },
    highlights: 'Asiatic Lion Safari trail, Girnar ropeway in Junagadh, and coastal highway to Somnath Temple.',
    bestFor: 'Wildlife & SUV Adventure',
  },
  {
    id: 'saputara',
    title: 'Surat → Saputara Hill Station (Dang Forest)',
    distance: '156 km • 3.5 hrs drive',
    pickupHub: 'Surat',
    recommendedCar: { make: 'Toyota', model: 'Innova Crysta', category: 'MUV' },
    highlights: 'Scenic ghat roads, Gira Waterfalls, Sunset Point, Saputara Lake & tribal heritage trails.',
    bestFor: 'Monsoon & Hill Getaway',
  },
  {
    id: 'kutch',
    title: 'Ahmedabad → White Rann of Kutch & Mandvi Beach',
    distance: '400 km • 7 hrs drive',
    pickupHub: 'Ahmedabad',
    recommendedCar: { make: 'Toyota', model: 'Fortuner Legender', category: 'Luxury' },
    highlights: 'Road to Heaven (Khavda–Dholavira), White Desert full-moon views, Vijay Vilas Palace in Mandvi.',
    bestFor: 'Signature Highway Expedition',
  },
  {
    id: 'dwarka',
    title: 'Rajkot / Ahmedabad → Dwarka, Bet Dwarka & Shivrajpur Beach',
    distance: '225 km • 4 hrs drive',
    pickupHub: 'Rajkot',
    recommendedCar: { make: 'Mahindra', model: 'Scorpio-N Z8L', category: 'SUV' },
    highlights: 'Blue Flag Shivrajpur Beach, Sudama Setu, Nageshwar Jyotirlinga & coastal sunset drive.',
    bestFor: 'Heritage & Coastal Road Trip',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Select Hub, Dates & Verified Car',
    desc: 'Choose your pickup city across Ahmedabad, Surat, Vadodara, Gandhinagar, or Rajkot. Compare transparent daily fares with 300 km/day included.',
    icon: MapPin,
  },
  {
    step: '02',
    title: 'Instant DigiLocker Aadhaar & DL e-KYC',
    desc: 'Verify your identity and Driving Licence in under 60 seconds via the official Government DigiLocker gateway. Zero paperwork at pickup.',
    icon: ShieldCheck,
  },
  {
    step: '03',
    title: 'Digital Lease Agreement & 8-Angle Handover',
    desc: 'Sign the digital car-sharing lease agreement and complete the 8-angle vehicle photo & odometer inspection at the pickup hub.',
    icon: Camera,
  },
  {
    step: '04',
    title: 'Drive Freely & Get Dual GST Tax Invoices',
    desc: 'Enjoy 24×7 roadside support across Gujarat. On return inspection, your refundable security deposit is released and your 80/20 Dual GST Invoices are generated.',
    icon: FileText,
  },
];

const FAQS = [
  {
    q: 'What documents are required to book a self-drive car?',
    a: 'You need a valid original Indian Light Motor Vehicle (LMV) Driving Licence and Aadhaar card verified through our DigiLocker e-KYC tab prior to vehicle handover.',
  },
  {
    q: 'What is included in the daily rental price?',
    a: 'Every booking includes 300 km/day (or Unlimited km if selected), comprehensive vehicle insurance, 24×7 Gujarat roadside assistance, and all taxes. Fuel is on a level-to-level basis.',
  },
  {
    q: 'How does the Refundable Security Deposit work?',
    a: 'A nominal refundable deposit (typically ₹2,000) is collected at checkout and automatically refunded after the return 8-angle inspection and FASTag/challan reconciliation.',
  },
  {
    q: 'How does Dual GST Invoicing (80/20 Split) work?',
    a: 'To ensure 100% tax compliance, Safar generates a two-part invoice: Part A covers the 80% Vehicle Lease from the Fleet Partner, and Part B covers the 20% Safar Platform Service Fee.',
  },
  {
    q: 'Can I take the car outside Gujarat?',
    a: 'All vehicles are permitted across all districts of Gujarat. For interstate travel (Rajasthan, Maharashtra, MP, Diu/Daman), FASTag and state border permit charges apply at actuals.',
  },
];

export default function GuidesAndSupportScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 54) + 6 : Math.max(insets.top, 24);
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<'guides' | 'how' | 'support'>(
    params.section === 'how' || params.section === 'support' ? params.section : 'guides'
  );

  React.useEffect(() => {
    if (params.section === 'guides' || params.section === 'how' || params.section === 'support') {
      setSection(params.section);
    }
  }, [params.section]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <SafarHeader />

      {/* Top Section Switcher (Matches Website Top Menu Items) */}
      <View style={styles.topTabsWrap}>
        <TouchableOpacity
          style={[styles.topTab, section === 'guides' && styles.topTabActive]}
          onPress={() => setSection('guides')}
        >
          <Compass size={15} color={section === 'guides' ? '#FFFFFF' : '#475569'} />
          <Text style={[styles.topTabText, section === 'guides' && styles.topTabTextActive]}>
            Travel Guides
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTab, section === 'how' && styles.topTabActive]}
          onPress={() => setSection('how')}
        >
          <CheckCircle2 size={15} color={section === 'how' ? '#FFFFFF' : '#475569'} />
          <Text style={[styles.topTabText, section === 'how' && styles.topTabTextActive]}>
            How It Works
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTab, section === 'support' && styles.topTabActive]}
          onPress={() => setSection('support')}
        >
          <HelpCircle size={15} color={section === 'support' ? '#FFFFFF' : '#475569'} />
          <Text style={[styles.topTabText, section === 'support' && styles.topTabTextActive]}>
            Help & Support
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {section === 'guides' && (
          <View>
            <View style={styles.heroBanner}>
              <Text style={styles.eyebrow}>GUJARAT ROAD TRIP ITINERARIES</Text>
              <Text style={styles.heroTitle}>Curated Self-Drive Travel Guides</Text>
              <Text style={styles.heroSub}>
                Explore Gujarat’s finest highways, heritage sites, and wildlife sanctuaries in a verified Safar self-drive car.
              </Text>
            </View>

            {GUJARAT_GUIDES.map((guide) => (
              <View key={guide.id} style={styles.guideCard}>
                <View style={styles.guideImageRow}>
                  <Image
                    source={getVehicleImageSource(guide.recommendedCar)}
                    style={styles.guideCarImg}
                    resizeMode="cover"
                  />
                  <View style={styles.guideBadge}>
                    <Text style={styles.guideBadgeText}>{guide.bestFor}</Text>
                  </View>
                </View>

                <View style={styles.guideBody}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <View style={styles.guideMetaRow}>
                    <Clock size={13} color="#FF6000" />
                    <Text style={styles.guideMetaText}>{guide.distance}</Text>
                    <Text style={styles.guideMetaDot}>•</Text>
                    <MapPin size={13} color="#2D114D" />
                    <Text style={styles.guideMetaText}>{guide.pickupHub} Hub</Text>
                  </View>

                  <Text style={styles.guideHighlights}>{guide.highlights}</Text>

                  <View style={styles.guideFooter}>
                    <View>
                      <Text style={styles.recLabel}>Recommended Car</Text>
                      <Text style={styles.recValue}>
                        {guide.recommendedCar.make} {guide.recommendedCar.model}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.exploreRouteBtn}
                      onPress={() => router.push('/')}
                    >
                      <Text style={styles.exploreRouteBtnText}>Book Car</Text>
                      <ArrowRight size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === 'how' && (
          <View>
            <View style={styles.heroBanner}>
              <Text style={styles.eyebrow}>TRANSPARENT 4-STEP PROCESS</Text>
              <Text style={styles.heroTitle}>How Safar Self Drive Works</Text>
              <Text style={styles.heroSub}>
                100% digital onboarding, verified studio-inspected cars, and instant security deposit refunds.
              </Text>
            </View>

            {HOW_IT_WORKS_STEPS.map((item) => {
              const IconComp = item.icon;
              return (
                <View key={item.step} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepNumBadge}>
                      <Text style={styles.stepNumText}>STEP {item.step}</Text>
                    </View>
                    <IconComp size={20} color="#FF6000" />
                  </View>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                </View>
              );
            })}

            <View style={styles.ctaBox}>
              <Text style={styles.ctaTitle}>Ready for your next road trip?</Text>
              <Text style={styles.ctaSub}>
                Browse 100% pre-inspected SUVs, sedans, and hatchbacks across Gujarat.
              </Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/')}>
                <Text style={styles.ctaBtnText}>Explore Available Cars</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {section === 'support' && (
          <View>
            <View style={styles.heroBanner}>
              <Text style={styles.eyebrow}>24×7 CUSTOMER & ROADSIDE SUPPORT</Text>
              <Text style={styles.heroTitle}>We’re Here for Every Kilometre</Text>
              <Text style={styles.heroSub}>
                Direct support from our Ahmedabad headquarters for bookings, KYC, handover, and emergency roadside assistance.
              </Text>
            </View>

            {/* Direct Contact Cards */}
            <View style={styles.contactGrid}>
              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('tel:+919909031177')}
              >
                <View style={[styles.contactIconWrap, { backgroundColor: '#FFF7ED' }]}>
                  <PhoneCall size={20} color="#FF6000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>24×7 Helpline & Roadside Desk</Text>
                  <Text style={styles.contactValue}>+91 99090 31177</Text>
                  <Text style={styles.contactHours}>Every day, 8:00 AM – 10:00 PM (24×7 Emergency)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('https://wa.me/919909031177')}
              >
                <View style={[styles.contactIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <MessageCircle size={20} color="#0D9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>WhatsApp Instant Support</Text>
                  <Text style={styles.contactValue}>Chat on WhatsApp (+91 99090 31177)</Text>
                  <Text style={styles.contactHours}>Fast assistance for KYC & pickup hub location pins</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('mailto:support@safarselfdrive.com')}
              >
                <View style={[styles.contactIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Mail size={20} color="#2D114D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>Official Email & Billing Desk</Text>
                  <Text style={styles.contactValue}>support@safarselfdrive.com</Text>
                  <Text style={styles.contactHours}>For GST invoices, corporate leases & refunds</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* FAQ Section */}
            <Text style={styles.faqHeading}>Frequently Asked Questions</Text>
            {FAQS.map((item, idx) => (
              <View key={idx} style={styles.faqCard}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  topTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topTabActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  topTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  topTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  heroBanner: {
    backgroundColor: '#2D114D',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 19,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 16,
  },
  guideImageRow: {
    height: 175,
    backgroundColor: '#EFF2F6',
    position: 'relative',
  },
  guideCarImg: {
    width: '100%',
    height: '100%',
  },
  guideBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(45, 17, 77, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  guideBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  guideBody: {
    padding: 15,
  },
  guideTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  guideMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  guideMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  guideMetaDot: {
    color: '#94A3B8',
    marginHorizontal: 2,
  },
  guideHighlights: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  guideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  recLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D114D',
  },
  exploreRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6000',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exploreRouteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FF6000',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  ctaBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E1B2E',
  },
  ctaSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  ctaBtn: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  contactGrid: {
    gap: 12,
    marginBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  contactIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  contactHours: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  faqHeading: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E1B2E',
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 5,
  },
  faqA: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
});
