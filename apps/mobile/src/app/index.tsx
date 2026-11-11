import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest, getVehicleImageSource, getCarDistance, getVehicleTerms } from '@/services/api';
import { DateTimePickerModal } from '@/components/datetime-picker-modal';
import { ChevronDown, ChevronRight, Search, X, Phone, Menu } from 'lucide-react-native';

const CITIES = ['All', 'Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot'];
const TYPES = ['All', 'SUV', 'Sedan', 'Hatchback', 'Luxury'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const prettyDate = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen() {
  const { user } = require('@/context/AuthContext').useAuth();

  const [city, setCity] = useState('All');
  const [type, setType] = useState('All');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cityOpen, setCityOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const [startDate, setStartDate] = useState(() => ymd(new Date(Date.now() + 864e5)));
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(() => ymd(new Date(Date.now() + 2 * 864e5)));
  const [endTime, setEndTime] = useState('10:00 AM');

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const data = await apiRequest(city === 'All' ? '/vehicles' : `/vehicles?city=${encodeURIComponent(city)}`);
          if (alive) setVehicles(Array.isArray(data) ? data : []);
        } catch (e) {
          console.error(e);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [city])
  );

  const days = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 1;
    return Math.max(1, Math.ceil((b - a) / 864e5));
  }, [startDate, endDate]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (String(v.model || '').toLowerCase().includes('taxi')) return false;
      const cat = String(v.category || '').toLowerCase();
      if (type !== 'All' && !cat.includes(type.toLowerCase())) {
        if (!(type === 'SUV' && (cat.includes('muv') || String(v.model).toLowerCase().includes('thar')))) return false;
      }
      if (q && !`${v.make} ${v.model} ${v.category} ${v.fuelType} ${v.transmission}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vehicles, type, query]);

  const openCar = (id: string) =>
    router.push({ pathname: '/details/[id]', params: { id, startDate, endDate } });

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.brand}>
          <Image source={require('../../assets/safar-logo.png')} style={s.logo} />
          <View>
            <Text style={s.brandMain}>safar</Text>
            <Text style={s.brandSub}>SELF DRIVE</Text>
          </View>
        </View>
        <View style={s.topActions}>
          <TouchableOpacity style={s.iconBtn} onPress={() => setSearchOpen((v) => !v)}>
            {searchOpen ? <X size={20} color="#1A1523" /> : <Search size={20} color="#1A1523" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push({ pathname: '/guides' as any, params: { section: 'support' } })}
          >
            <Menu size={20} color="#1A1523" />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={s.searchRow}>
          <Search size={16} color="#8A8F98" />
          <TextInput
            autoFocus
            style={s.searchInput}
            placeholder="Car, brand or fuel type"
            placeholderTextColor="#8A8F98"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={s.intro}>
          <Text style={s.hello}>
            {greeting()}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </Text>
          <Text style={s.headline}>Where are you{'\n'}driving next?</Text>
        </View>

        {/* Trip planner */}
        <View style={s.planner}>
          <TouchableOpacity style={s.pRow} onPress={() => setCityOpen(true)} activeOpacity={0.7}>
            <View style={s.rail}>
              <View style={[s.dot, { backgroundColor: '#2D114D' }]} />
            </View>
            <View style={s.pBody}>
              <Text style={s.pLabel}>Pickup hub</Text>
              <Text style={s.pValue}>{city === 'All' ? 'Any city in Gujarat' : `${city}`}</Text>
            </View>
            <ChevronDown size={18} color="#8A8F98" />
          </TouchableOpacity>

          <View style={s.sep} />

          <TouchableOpacity style={s.pRow} onPress={() => setStartOpen(true)} activeOpacity={0.7}>
            <View style={s.rail}>
              <View style={s.railLine} />
              <View style={[s.dot, { backgroundColor: '#FF6000' }]} />
            </View>
            <View style={s.pBody}>
              <Text style={s.pLabel}>Start</Text>
              <Text style={s.pValue}>
                {prettyDate(startDate)} <Text style={s.pTime}>· {startTime}</Text>
              </Text>
            </View>
            <ChevronRight size={18} color="#8A8F98" />
          </TouchableOpacity>

          <View style={s.sep} />

          <TouchableOpacity style={s.pRow} onPress={() => setEndOpen(true)} activeOpacity={0.7}>
            <View style={s.rail}>
              <View style={s.railLine} />
              <View style={[s.dot, { borderWidth: 2, borderColor: '#FF6000', backgroundColor: '#FFF' }]} />
            </View>
            <View style={s.pBody}>
              <Text style={s.pLabel}>Return</Text>
              <Text style={s.pValue}>
                {prettyDate(endDate)} <Text style={s.pTime}>· {endTime}</Text>
              </Text>
            </View>
            <ChevronRight size={18} color="#8A8F98" />
          </TouchableOpacity>

          <View style={s.summary}>
            <Text style={s.summaryText}>
              {days} {days === 1 ? 'day' : 'days'} · {days * 300} km included
            </Text>
          </View>
        </View>

        {/* Type tabs */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Available cars</Text>
          <Text style={s.count}>{loading ? '' : `${list.length}`}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
          {TYPES.map((t) => {
            const on = t === type;
            return (
              <TouchableOpacity key={t} onPress={() => setType(t)} style={s.typeItem}>
                <Text style={[s.typeText, on && s.typeTextOn]}>{t}</Text>
                {on && <View style={s.typeUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Fleet */}
        <View style={{ paddingHorizontal: 20 }}>
          {loading ? (
            <ActivityIndicator color="#2D114D" style={{ marginVertical: 40 }} />
          ) : list.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Nothing matches yet</Text>
              <Text style={s.emptyText}>Try another city or car type.</Text>
            </View>
          ) : (
            list.map((v) => {
              const terms = getVehicleTerms(v);
              const price = Number(v.pricePerDay || 0);
              return (
                <TouchableOpacity key={v.id} style={s.car} activeOpacity={0.85} onPress={() => openCar(String(v.id))}>
                  <Image source={getVehicleImageSource(v)} style={s.carImg} resizeMode="cover" />
                  <View style={s.carInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.carName} numberOfLines={1}>
                        {v.make} {v.model}
                      </Text>
                      <Text style={s.carMeta} numberOfLines={1}>
                        {v.transmission} · {v.fuelType} · {v.seats || 5} seats
                      </Text>
                      <Text style={s.carHub} numberOfLines={1}>
                        {v.locationCity || 'Ahmedabad'} · {getCarDistance(v)} km away
                      </Text>
                    </View>
                    <View style={s.priceCol}>
                      <Text style={s.price}>₹{price.toLocaleString('en-IN')}</Text>
                      <Text style={s.priceUnit}>per day</Text>
                    </View>
                  </View>
                  <View style={s.carFoot}>
                    <Text style={s.carFootText}>
                      {terms.kmPerDay} km/day · ₹{terms.excessKmRate}/km after
                    </Text>
                    <Text style={s.carTotal}>₹{(price * days).toLocaleString('en-IN')} for {days}d</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* How it works – plain, factual */}
        <View style={s.howWrap}>
          <Text style={s.sectionTitleInset}>How renting works</Text>
          {[
            ['Verify once', 'Aadhaar and driving licence through DigiLocker. Takes about a minute.'],
            ['Pick up at the hub', 'We photograph the car with you before you drive off.'],
            ['Return and settle', 'Deposit is released after the return check. GST invoice is emailed.'],
          ].map(([t, d], i) => (
            <View key={t} style={s.howRow}>
              <Text style={s.howNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.howTitle}>{t}</Text>
                <Text style={s.howDesc}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Host strip */}
        <TouchableOpacity style={s.hostStrip} onPress={() => router.push('/host')} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={s.hostTitle}>Own a car that sits idle?</Text>
            <Text style={s.hostText}>List it with Safar and earn when it's booked.</Text>
          </View>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Support */}
        <TouchableOpacity style={s.support} onPress={() => Linking.openURL('tel:+919909031177')}>
          <Phone size={16} color="#2D114D" />
          <Text style={s.supportText}>Need help? Call +91 99090 31177</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* City sheet */}
      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setCityOpen(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Pickup hub</Text>
            {CITIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={s.sheetRow}
                onPress={() => {
                  setCity(c);
                  setCityOpen(false);
                }}
              >
                <Text style={[s.sheetText, c === city && { color: '#2D114D', fontWeight: '700' }]}>
                  {c === 'All' ? 'Any city in Gujarat' : c}
                </Text>
                {c === city && <View style={s.sheetCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <DateTimePickerModal
        visible={startOpen}
        title="Start of trip"
        selectedDate={startDate}
        selectedTime={startTime}
        onClose={() => setStartOpen(false)}
        onSelect={(d, t) => {
          setStartDate(d);
          setStartTime(t);
          if (new Date(d) >= new Date(endDate)) setEndDate(ymd(new Date(new Date(d).getTime() + 864e5)));
        }}
      />
      <DateTimePickerModal
        visible={endOpen}
        title="End of trip"
        selectedDate={endDate}
        selectedTime={endTime}
        onClose={() => setEndOpen(false)}
        onSelect={(d, t) => {
          setEndDate(d);
          setEndTime(t);
        }}
      />
    </SafeAreaView>
  );
}

const INK = '#1A1523';
const MUTED = '#6B7280';
const LINE = '#ECEDF0';

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, resizeMode: 'contain' },
  brandMain: { fontSize: 20, fontWeight: '800', fontStyle: 'italic', color: '#2D114D', lineHeight: 21 },
  brandSub: { fontSize: 8.5, fontWeight: '700', color: '#FF6000', letterSpacing: 2 },
  topActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK },

  intro: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  hello: { fontSize: 14, color: MUTED },
  headline: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: INK, marginTop: 4, letterSpacing: -0.6 },

  planner: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
  },
  pRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 16 },
  rail: { width: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  railLine: { position: 'absolute', top: -14, bottom: '50%', width: 1.5, backgroundColor: '#D9D3E3' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pBody: { flex: 1 },
  pLabel: { fontSize: 12, color: MUTED, marginBottom: 2 },
  pValue: { fontSize: 16, fontWeight: '600', color: INK },
  pTime: { color: MUTED, fontWeight: '500' },
  sep: { height: 1, backgroundColor: LINE, marginLeft: 44 },
  summary: { backgroundColor: '#2D114D', paddingVertical: 12, paddingHorizontal: 16 },
  summaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  count: { fontSize: 14, color: MUTED },

  typeRow: { paddingHorizontal: 20, gap: 22, paddingTop: 12, paddingBottom: 14 },
  typeItem: { paddingBottom: 6 },
  typeText: { fontSize: 15, color: MUTED, fontWeight: '500' },
  typeTextOn: { color: INK, fontWeight: '700' },
  typeUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6000', borderRadius: 1 },

  car: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
  },
  carImg: { width: '100%', height: 180, backgroundColor: '#F1F1EE' },
  carInfo: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  carName: { fontSize: 17, fontWeight: '700', color: INK },
  carMeta: { fontSize: 13, color: MUTED, marginTop: 3 },
  carHub: { fontSize: 13, color: MUTED, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 19, fontWeight: '800', color: INK },
  priceUnit: { fontSize: 12, color: MUTED },
  carFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  carFootText: { fontSize: 12, color: MUTED },
  carTotal: { fontSize: 13, fontWeight: '700', color: '#FF6000' },

  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK },
  emptyText: { fontSize: 14, color: MUTED, marginTop: 4 },

  howWrap: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitleInset: { fontSize: 20, fontWeight: '800', color: INK, marginBottom: 14, letterSpacing: -0.3 },
  howRow: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  howNum: { fontSize: 22, fontWeight: '800', color: '#D9D3E3', width: 22 },
  howTitle: { fontSize: 15, fontWeight: '700', color: INK },
  howDesc: { fontSize: 14, color: MUTED, marginTop: 3, lineHeight: 20 },

  hostStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#2D114D',
  },
  hostTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  hostText: { fontSize: 13, color: '#CFC5DD', marginTop: 3 },

  support: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26 },
  supportText: { fontSize: 14, color: '#2D114D', fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,28,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 8 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sheetText: { fontSize: 16, color: INK },
  sheetCheck: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6000' },
});
