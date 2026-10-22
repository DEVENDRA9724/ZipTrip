import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ArrowLeft, Mail, Lock, Phone } from 'lucide-react-native';

export default function LoginScreen() {
  const colors = Colors.light;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, requestLoginOtp, loginWithOtp } = require('@/context/AuthContext').useAuth();

  const handleLogin = async () => {
    if (mode === 'otp') {
      if (!phone) { setError('Enter your mobile number'); return; }
      if (!otpSent) {
        setError('');
        setLoading(true);
        try {
          const res = await requestLoginOtp(phone);
          setOtpSent(true);
          if (res?.devOtp) setOtp(res.devOtp);
        } catch (err: any) {
          setError(err.message || 'Could not send OTP');
        } finally { setLoading(false); }
        return;
      }
      if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit OTP'); return; }
      setError('');
      setLoading(true);
      try { await loginWithOtp(phone, otp); router.replace('/'); }
      catch (err: any) { setError(err.message || 'Invalid or expired OTP'); }
      finally { setLoading(false); }
      return;
    }
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={[styles.backButton, { backgroundColor: colors.backgroundElement }]}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <ThemedText style={styles.brandTitle}>Safar Self Drive</ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            Sign in for Self Drive & Gujarat Taxi rentals. Your Journey. Your Rules.
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={styles.form}>
          {mode === 'otp' ? <>
            <ThemedText style={styles.label}>Mobile number</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Phone size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="+91 9876543210" placeholderTextColor={colors.textSecondary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" editable={!otpSent} />
            </View>
            {otpSent ? <>
              <ThemedText style={styles.label}>6-digit OTP</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter OTP" placeholderTextColor={colors.textSecondary} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
              </View>
            </> : null}
          </> : <>
            <ThemedText style={styles.label}>Email Address</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter your email" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>
            <ThemedText style={styles.label}>Password</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter your password" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            </View>
          </>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>{mode === 'otp' ? (otpSent ? 'Verify & Sign In' : 'Send Login OTP') : 'Sign In'}</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode(mode === 'otp' ? 'password' : 'otp'); setOtpSent(false); setOtp(''); setError(''); }}>
            <ThemedText style={[styles.switchText, { color: colors.primary }]}>{mode === 'otp' ? 'Use email and password instead' : 'Sign in with mobile OTP'}</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <ThemedText style={{ color: colors.textSecondary }}>Don't have an account? </ThemedText>
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>Sign Up</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  titleSection: {
    marginBottom: Spacing.five,
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
  form: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
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
  switchText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.five,
  },
});
