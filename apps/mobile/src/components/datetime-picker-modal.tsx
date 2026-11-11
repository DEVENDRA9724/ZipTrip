import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Calendar, Clock, X, Check } from 'lucide-react-native';

const TIME_SLOTS = [
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
  '10:00 PM',
];

interface DateTimePickerModalProps {
  visible: boolean;
  title: string;
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // e.g. '10:00 AM'
  minDate?: string;
  onClose: () => void;
  onSelect: (date: string, time: string) => void;
}

const toYMD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DateTimePickerModal({
  visible,
  title,
  selectedDate,
  selectedTime,
  onClose,
  onSelect,
}: DateTimePickerModalProps) {
  const [tempDate, setTempDate] = useState(selectedDate);
  const [tempTime, setTempTime] = useState(selectedTime || '10:00 AM');

  React.useEffect(() => {
    if (visible) {
      setTempDate(selectedDate);
      setTempTime(selectedTime || '10:00 AM');
    }
  }, [visible, selectedDate, selectedTime]);

  // Generate next 30 calendar days
  const upcomingDays = useMemo(() => {
    const list: { ymd: string; dayName: string; dayNum: string; monthName: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
      list.push({
        ymd: toYMD(d),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNum: String(d.getDate()).padStart(2, '0'),
        monthName: d.toLocaleDateString('en-IN', { month: 'short' }),
      });
    }
    return list;
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>TRIP SCHEDULE</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#1E1B2E" />
            </TouchableOpacity>
          </View>

          {/* Date Selector Section */}
          <View style={styles.sectionHeader}>
            <Calendar size={15} color="#FF6000" />
            <Text style={styles.sectionTitle}>Select Date</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScroll}
          >
            {upcomingDays.map((item) => {
              const active = tempDate === item.ymd;
              return (
                <TouchableOpacity
                  key={item.ymd}
                  style={[styles.dayCard, active && styles.dayCardActive]}
                  activeOpacity={0.85}
                  onPress={() => setTempDate(item.ymd)}
                >
                  <Text style={[styles.dayName, active && styles.dayTextActive]}>
                    {item.dayName}
                  </Text>
                  <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                    {item.dayNum}
                  </Text>
                  <Text style={[styles.monthName, active && styles.dayTextActive]}>
                    {item.monthName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time Slot Selector Section */}
          <View style={[styles.sectionHeader, { marginTop: 18 }]}>
            <Clock size={15} color="#2D114D" />
            <Text style={styles.sectionTitle}>Select Time Slot (8:00 AM – 10:00 PM)</Text>
          </View>

          <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator={false}>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((slot) => {
                const active = tempTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    activeOpacity={0.85}
                    onPress={() => setTempTime(slot)}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            style={styles.confirmBtn}
            activeOpacity={0.9}
            onPress={() => {
              onSelect(tempDate, tempTime);
              onClose();
            }}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E1B2E',
  },
  daysScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  dayCard: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardActive: {
    backgroundColor: '#2D114D',
    borderColor: '#2D114D',
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 2,
  },
  monthName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: '#FFF1E8',
    borderColor: '#FF6000',
  },
  timeChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  timeChipTextActive: {
    color: '#C2410C',
    fontWeight: '800',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D114D',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 18,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
