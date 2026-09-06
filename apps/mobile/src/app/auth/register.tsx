import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ArrowLeft, Mail, Lock, User, Phone } from 'lucide-react-native';

export default function RegisterScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'HOST'>('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = require('@/context/AuthContext').useAuth();

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !phone) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        phone,
        password,
        role,
      });
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.backgroundElement }]}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.titleSection}>
          <ThemedText style={styles.brandTitle}>Join Safar Self Drive</ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            Your Journey. Your Rules. Self-drive & Taxi rentals across Gujarat.
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={styles.rolePickerContainer}>
          <ThemedText style={styles.label}>Select Your Goal</ThemedText>
          <View style={[styles.rolePicker, { backgroundColor: colors.backgroundElement }]}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'CUSTOMER' && [styles.roleActive, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setRole('CUSTOMER')}
            >
              <ThemedText style={[styles.roleOptionText, role === 'CUSTOMER' && styles.roleActiveText]}>Rent Cars</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'HOST' && [styles.roleActive, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setRole('HOST')}
            >
              <ThemedText style={[styles.roleOptionText, role === 'HOST' && styles.roleActiveText]}>Host Cars</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <ThemedText style={styles.label}>First Name</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <User size={16} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="John"
                  placeholderTextColor={colors.textSecondary}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>
            <View style={styles.halfWidth}>
              <ThemedText style={styles.label}>Last Name</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <User size={16} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Doe"
                  placeholderTextColor={colors.textSecondary}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
          </View>

          <ThemedText style={styles.label}>Email Address</ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="john.doe@example.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <ThemedText style={styles.label}>Phone Number</ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Phone size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="+919876543210"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <ThemedText style={styles.label}>Password</ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Min 6 characters"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>Create Account</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <ThemedText style={{ color: colors.textSecondary }}>Already have an account? </ThemedText>
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>Sign In</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  titleSection: {
    marginVertical: Spacing.three,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: Spacing.one,
  },
  subtitle: {
    marginTop: Spacing.one,
    lineHeight: 20,
  },
  errorBox: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  rolePickerContainer: {
    marginBottom: Spacing.three,
  },
  rolePicker: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginTop: Spacing.one,
  },
  roleOption: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  roleOptionText: {
    fontWeight: '600',
    fontSize: 14,
  },
  roleActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleActiveText: {
    color: '#FFFFFF',
  },
  form: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    marginTop: Spacing.one,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.five,
  },
});
