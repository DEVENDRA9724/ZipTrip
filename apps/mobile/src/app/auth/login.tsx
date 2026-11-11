import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Mail, Lock, Phone } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, requestLoginOtp, loginWithOtp } = require('@/context/AuthContext').useAuth();

  const handleLogin = async () => {
    if (mode === 'otp') {
      if (!phone) {
        setError('Enter your 10-digit mobile number');
        return;
      }
      if (!otpSent) {
        setError('');
        setLoading(true);
        try {
          const res = await requestLoginOtp(phone);
          setOtpSent(true);
          if (res?.devOtp) setOtp(res.devOtp);
        } catch (err: any) {
          setError(err.message || 'Could not send OTP');
        } finally {
          setLoading(false);
        }
        return;
      }
      if (!/^\d{6}$/.test(otp)) {
        setError('Enter the 6-digit OTP');
        return;
      }
      setError('');
      setLoading(true);
      try {
        await loginWithOtp(phone, otp);
        router.replace('/');
      } catch (err: any) {
        setError(err.message || 'Invalid or expired OTP');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <ArrowLeft size={20} color="#1E1B2E" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Brand Lockup */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../../assets/safar-logo.png')}
              style={styles.logoImg}
            />
          </View>
          <Text style={styles.brandMain}>safar</Text>
          <Text style={styles.brandSub}>- SELF DRIVE -</Text>
          <Text style={styles.subtitle}>
            Sign in to book verified self-drive cars across Gujarat.
          </Text>
        </View>

        {/* Mode Tabs */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'otp' && styles.modeTabActive]}
            onPress={() => {
              setMode('otp');
              setError('');
            }}
          >
            <Text style={[styles.modeTabText, mode === 'otp' && styles.modeTabTextActive]}>
              Mobile OTP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'password' && styles.modeTabActive]}
            onPress={() => {
              setMode('password');
              setError('');
            }}
          >
            <Text style={[styles.modeTabText, mode === 'password' && styles.modeTabTextActive]}>
              Email & Password
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {mode === 'otp' ? (
            <>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Phone size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  editable={!otpSent}
                />
              </View>
              {otpSent ? (
                <>
                  <Text style={styles.label}>6-Digit OTP</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={18} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#94A3B8"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Mail size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'otp' ? (otpSent ? 'Verify & Sign In' : 'Get OTP') : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={{ color: '#64748B', fontSize: 14 }}>New to Safar? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <Text style={{ color: '#FF6000', fontWeight: '800', fontSize: 14 }}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImg: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  brandMain: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#2D114D',
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6000',
    letterSpacing: 2.5,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 19,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#2D114D',
    fontWeight: '800',
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B2E',
    marginTop: 10,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FF6000',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
});
