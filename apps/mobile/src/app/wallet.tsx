import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/services/api';
import { Wallet, LogIn, Plus, LogOut, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react-native';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export default function WalletScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const authContext = require('@/context/AuthContext');
  const { user, logout, refreshProfile } = authContext.useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchWallet();
      }
    }, [user])
  );

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/wallet');
      setBalance(Number(data.balance));
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (amount: number) => {
    if (amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiRequest('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      Alert.alert('Success', `INR ${amount.toLocaleString('en-IN')} added to your wallet.`);
      setDepositAmount('');
      await fetchWallet();
      refreshProfile(); // refresh auth user context
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Deposit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  // Guest State
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">Profile & Wallet</ThemedText>
        </View>
        <View style={styles.center}>
          <Wallet size={48} color={colors.textSecondary} style={{ marginBottom: Spacing.three }} />
          <ThemedText style={styles.promptTitle}>Check Your Balance</ThemedText>
          <ThemedText type="small" style={[styles.promptDesc, { color: colors.textSecondary }]}>
            Sign in to access your digital wallet, top up funds, and check transaction details.
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="title">Profile & Wallet</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {user.email} • {user.role}
            </ThemedText>
          </View>
        </View>

        {/* Premium Digital Debit Card */}
        <View style={[styles.cardContainer, { shadowColor: colors.primary }]}>
          <View style={[styles.creditCard, { backgroundColor: colors.primary }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardBrand}>Safar Self Drive</ThemedText>
              <CreditCard size={24} color="#FFFFFF" opacity={0.8} />
            </View>

            <View style={styles.cardMid}>
              <ThemedText style={styles.cardBalanceLabel}>WALLET BALANCE</ThemedText>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.cardBalanceValue}>
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </ThemedText>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View>
                <ThemedText style={styles.cardHolderLabel}>CARDHOLDER</ThemedText>
                <ThemedText style={styles.cardHolderValue}>
                  {user.firstName.toUpperCase()} {user.lastName.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={styles.cardNumber}>•••• 2026</ThemedText>
            </View>
          </View>
        </View>

        {/* Deposit Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Add Money to Wallet</ThemedText>
          <ThemedText type="small" style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Top up your balance instantly using mock payment routing.
          </ThemedText>

          {/* Quick options */}
          <View style={styles.quickAddRow}>
            {QUICK_AMOUNTS.map(amount => (
              <TouchableOpacity
                key={amount}
                style={[styles.quickPill, { backgroundColor: colors.backgroundElement }]}
                onPress={() => handleDeposit(amount)}
                disabled={actionLoading}
              >
                <ThemedText style={[styles.quickPillText, { color: colors.primary }]}>+₹{amount}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Input */}
          <View style={styles.customAddRow}>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <ThemedText style={styles.currencySymbol}>₹</ThemedText>
              <TextInput
                style={[styles.customInput, { color: colors.text }]}
                placeholder="Enter custom amount"
                placeholderTextColor={colors.textSecondary}
                value={depositAmount}
                onChangeText={setDepositAmount}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleDeposit(Number(depositAmount))}
              disabled={actionLoading || !depositAmount}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Plus size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Settings list */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Account Verification</ThemedText>
          
          <View style={styles.settingItem}>
            <ShieldCheck size={20} color={colors.success} />
            <View style={styles.settingText}>
              <ThemedText style={styles.settingLabel}>Driving License Verified</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Required for unlocking cars</ThemedText>
            </View>
            <ThemedText style={{ color: colors.success, fontWeight: 'bold', fontSize: 13 }}>Verified</ThemedText>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.error }]}
          onPress={handleLogout}
        >
          <LogOut size={18} color={colors.error} />
          <ThemedText style={[styles.logoutBtnText, { color: colors.error }]}>Sign Out</ThemedText>
        </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 120,
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
  cardContainer: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  },
  creditCard: {
    height: 200,
    borderRadius: 20,
    padding: Spacing.four,
    justifyContent: 'space-between',
    // Gradient overlay can be simulated with background opacity or style, primary has indigo
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardMid: {
    marginVertical: Spacing.two,
  },
  cardBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardBalanceValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolderLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardHolderValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  section: {
    marginHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDesc: {
    lineHeight: 18,
    marginBottom: Spacing.two,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginBottom: Spacing.two,
  },
  quickPill: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  customAddRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    height: 44,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  settingText: {
    flex: 1,
    marginLeft: Spacing.three,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  logoutBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
