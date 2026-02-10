/**
 * Reporter Payment Screen
 * 
 * Dedicated screen for handling reporter subscription payments.
 * Navigated to when login returns 402 Payment Required.
 * 
 * The 402 response already contains all razorpay data (keyId, orderId, amount)
 * so we don't need to call a separate create-order API.
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { changeMpin, loginWithMpin, PaymentBreakdown, RazorpayLoginData } from '@/services/api';
import { saveTokens } from '@/services/auth';
import { formatPaymentAmount, openRazorpayCheckout, verifyPayment } from '@/services/payment';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = Colors.light.primary;
const SECONDARY = Colors.light.secondary;

// Helper to get month name
const getMonthName = (month: number): string => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
};

export default function ReporterPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    reporterId?: string;
    tenantId?: string;
    mobile?: string;
    mpin?: string;
    razorpayData?: string; // JSON string of RazorpayLoginData
    breakdownData?: string; // JSON string of PaymentBreakdown
    tenantName?: string;
    tenantNativeName?: string;
    tenantLogo?: string;
    tenantPrimaryColor?: string;
    isNewReporter?: string; // 'true' if reporter needs to set MPIN after payment
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayData, setRazorpayData] = useState<RazorpayLoginData | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [success, setSuccess] = useState(false);
  // Store payment data for retry verification
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  } | null>(null);
  
  // Stored credentials from AsyncStorage (fallback if params lost)
  const [storedCredentials, setStoredCredentials] = useState<{
    mobile: string;
    mpin: string;
  } | null>(null);
  
  // Change MPIN state (shown after successful payment for new reporters)
  const [showChangeMpin, setShowChangeMpin] = useState(false);
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [changingMpin, setChangingMpin] = useState(false);
  const [mpinError, setMpinError] = useState<string | null>(null);

  // Theme
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  // Load stored credentials from AsyncStorage on mount
  useEffect(() => {
    const loadStoredCredentials = async () => {
      try {
        const stored = await AsyncStorage.getItem('pendingPaymentCredentials');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Only use if stored within last 30 minutes
          if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            console.log('[PAYMENT] Loaded stored credentials', {
              mobile: parsed.mobile,
              mpinLength: parsed.mpin?.length,
            });
            setStoredCredentials({
              mobile: parsed.mobile,
              mpin: parsed.mpin,
            });
          } else {
            // Expired, clean up
            await AsyncStorage.removeItem('pendingPaymentCredentials');
          }
        }
      } catch (err) {
        console.error('[PAYMENT] Failed to load stored credentials', err);
      }
    };
    loadStoredCredentials();
  }, []);

  // Parse razorpay data from navigation params (passed from 402 response)
  useEffect(() => {
    console.log('[PAYMENT SCREEN] Raw params received', {
      hasRazorpayData: !!params.razorpayData,
      razorpayDataLength: params.razorpayData?.length,
      razorpayDataPreview: params.razorpayData?.substring(0, 100),
      mobile: params.mobile,
      mpin: params.mpin,
      reporterId: params.reporterId,
      tenantId: params.tenantId,
    });
    
    try {
      if (params.razorpayData) {
        const parsed = JSON.parse(params.razorpayData) as RazorpayLoginData;
        console.log('[PAYMENT SCREEN] Parsed razorpay data', {
          orderId: parsed.orderId,
          keyId: parsed.keyId,
          amount: parsed.amount,
          currency: parsed.currency,
          allKeys: Object.keys(parsed),
        });
        
        if (parsed.orderId && parsed.keyId) {
          setRazorpayData(parsed);
          console.log('[PAYMENT] Razorpay data loaded from params', { 
            orderId: parsed.orderId, 
            amount: parsed.amount 
          });
        } else {
          console.error('[PAYMENT SCREEN] Missing orderId or keyId', parsed);
          setError('Invalid payment data. Please try logging in again.');
        }
      } else {
        console.error('[PAYMENT SCREEN] No razorpayData in params - redirecting to login');
        // Redirect back to login if payment data is missing
        setTimeout(() => {
          router.replace('/auth/login');
        }, 100);
        return;
      }
      
      if (params.breakdownData) {
        const parsedBreakdown = JSON.parse(params.breakdownData) as PaymentBreakdown;
        setBreakdown(parsedBreakdown);
      }
    } catch (err) {
      console.error('[PAYMENT] Failed to parse razorpay data', err);
      setError('Invalid payment data. Please try logging in again.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.razorpayData, params.breakdownData]);

  // Get effective credentials (prefer params, fallback to stored)
  const effectiveMobile = params.mobile || storedCredentials?.mobile;
  const effectiveMpin = params.mpin || storedCredentials?.mpin;

  // Handle payment
  const handlePayment = useCallback(async () => {
    if (!razorpayData) return;

    setPaying(true);
    setError(null);

    try {
      // Open Razorpay checkout
      const paymentResult = await openRazorpayCheckout(razorpayData, {
        mobile: effectiveMobile,
        name: 'Reporter',
      });

      if (!paymentResult.success) {
        if (paymentResult.cancelled) {
          setError('Payment cancelled. Please try again to complete payment.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setError(paymentResult.error || 'Payment failed. Please try again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return;
      }

      if (!paymentResult.paymentData) {
        setError('Payment data missing. Please try again.');
        return;
      }

      // Verify payment with reporterId and tenantId
      const verified = await verifyPayment(paymentResult.paymentData, {
        reporterId: params.reporterId,
        tenantId: params.tenantId,
      });

      if (!verified) {
        // Store payment data for retry
        setPendingPaymentData(paymentResult.paymentData);
        setError('Payment verification failed. Tap "Retry Verification" to try again, or contact support if amount was deducted.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Payment successful
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);

      // Check if this is a new reporter who needs to set MPIN
      const isNewReporter = params.isNewReporter === 'true';
      const mobileNumber = effectiveMobile || params.mobile;
      
      if (isNewReporter && mobileNumber) {
        // New reporter: show change MPIN screen after brief success animation
        setTimeout(() => {
          setSuccess(false);
          setShowChangeMpin(true);
        }, 1500);
        return;
      }

      // Existing reporter: Try to auto-login if we have credentials (from params or stored)
      if (effectiveMobile && effectiveMpin) {
        setTimeout(async () => {
          try {
            console.log('[PAYMENT] Attempting auto-login after payment', {
              mobile: effectiveMobile,
              mpinLength: effectiveMpin?.length,
              source: params.mobile ? 'params' : 'stored',
            });
            const res = await loginWithMpin({ mobileNumber: effectiveMobile!, mpin: effectiveMpin! });
            
            // Check if MPIN is insecure (last 4 digits of phone)
            const last4 = effectiveMobile!.slice(-4);
            const isInsecureMpin = effectiveMpin === last4;
            
            await saveTokens({
              jwt: res.jwt,
              refreshToken: res.refreshToken,
              expiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : undefined,
              languageId: res.user?.languageId,
              user: res.user,
            });
            
            // Clear stored credentials after successful login
            await AsyncStorage.removeItem('pendingPaymentCredentials');
            
            if (isInsecureMpin) {
              // MPIN is last 4 digits - force change
              console.log('[PAYMENT] Insecure MPIN detected, showing change MPIN');
              setSuccess(false);
              setShowChangeMpin(true);
            } else {
              // Navigate to dashboard
              setTimeout(() => {
                router.replace('/reporter/dashboard');
              }, 1500);
            }
          } catch (loginErr: any) {
            console.error('[PAYMENT] Login after payment failed', loginErr, {
              status: loginErr?.status,
              message: loginErr?.message,
              body: loginErr?.body,
            });
            // Clear stored credentials on failure too
            await AsyncStorage.removeItem('pendingPaymentCredentials');
            // Still show success, user can login manually
            setTimeout(() => {
              router.replace('/auth/login');
            }, 2000);
          }
        }, 1000);
      } else {
        console.log('[PAYMENT] No credentials for auto-login', {
          hasMobile: !!effectiveMobile,
          hasMpin: !!effectiveMpin,
          hasStoredCredentials: !!storedCredentials,
        });
        // No credentials, redirect to login
        setTimeout(() => {
          router.replace('/auth/login');
        }, 2500);
      }
    } finally {
      setPaying(false);
    }
  }, [razorpayData, effectiveMobile, effectiveMpin, storedCredentials, params.reporterId, params.tenantId, params.mobile, params.isNewReporter, router]);

  // Handle change MPIN after payment
  const handleChangeMpin = useCallback(async () => {
    const mobileNumber = effectiveMobile || params.mobile;
    if (!mobileNumber) {
      setMpinError('మొబైల్ నంబర్ కనుగొనబడలేదు');
      return;
    }
    
    if (!/^\d{4}$/.test(newMpin)) {
      setMpinError('కొత్త MPIN 4 అంకెలు ఉండాలి');
      return;
    }
    
    if (newMpin !== confirmMpin) {
      setMpinError('MPIN లు సరిపోలడం లేదు');
      return;
    }
    
    // Check if new MPIN is also the last 4 digits (still insecure)
    const last4 = mobileNumber.slice(-4);
    if (newMpin === last4) {
      setMpinError('మీ ఫోన్ నంబర్ చివరి 4 అంకెలు MPIN గా వాడవద్దు');
      return;
    }
    
    setChangingMpin(true);
    setMpinError(null);
    
    try {
      // Use current MPIN from login credentials as old MPIN
      // Fall back to last 4 digits only if no MPIN is available
      const oldMpin = effectiveMpin || last4;
      
      await changeMpin({
        mobileNumber,
        oldMpin,
        newMpin,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Now login with new MPIN
      try {
        const res = await loginWithMpin({ mobileNumber, mpin: newMpin });
        await saveTokens({
          jwt: res.jwt,
          refreshToken: res.refreshToken,
          expiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : undefined,
          languageId: res.user?.languageId,
          user: res.user,
        });
        
        await AsyncStorage.removeItem('pendingPaymentCredentials');
        
        // Navigate to dashboard
        setTimeout(() => {
          router.replace('/reporter/dashboard');
        }, 500);
      } catch (loginErr: any) {
        console.error('[PAYMENT] Login after MPIN change failed', loginErr);
        // MPIN changed successfully, redirect to login
        setTimeout(() => {
          router.replace('/auth/login');
        }, 1000);
      }
    } catch (err: any) {
      console.error('[PAYMENT] Change MPIN failed', err);
      setMpinError(err?.message || 'MPIN మార్చడం విఫలమైంది');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setChangingMpin(false);
    }
  }, [effectiveMobile, params.mobile, newMpin, confirmMpin, router]);

  // Refs for MPIN inputs
  const newMpinRef = useRef<TextInput>(null);
  const confirmMpinRef = useRef<TextInput>(null);

  // Retry verification when it failed previously
  const handleRetryVerification = useCallback(async () => {
    if (!pendingPaymentData) return;

    setVerifying(true);
    setError(null);

    try {
      const verified = await verifyPayment(pendingPaymentData, {
        reporterId: params.reporterId,
        tenantId: params.tenantId,
      });

      if (!verified) {
        setError('Payment verification failed. Tap "Retry Verification" to try again, or contact support if amount was deducted.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Verification successful - clear pending data
      setPendingPaymentData(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);

      // Check if this is a new reporter
      const isNewReporter = params.isNewReporter === 'true';
      const mobileNumber = effectiveMobile || params.mobile;
      
      if (isNewReporter && mobileNumber) {
        setTimeout(() => {
          setSuccess(false);
          setShowChangeMpin(true);
        }, 1500);
        return;
      }

      // Try to auto-login if we have credentials (from params or stored)
      if (effectiveMobile && effectiveMpin) {
        setTimeout(async () => {
          try {
            console.log('[PAYMENT] Attempting auto-login after retry verification', {
              mobile: effectiveMobile,
              mpinLength: effectiveMpin?.length,
              source: params.mobile ? 'params' : 'stored',
            });
            const res = await loginWithMpin({ mobileNumber: effectiveMobile!, mpin: effectiveMpin! });
            
            const last4 = effectiveMobile!.slice(-4);
            const isInsecureMpin = effectiveMpin === last4;
            
            await saveTokens({
              jwt: res.jwt,
              refreshToken: res.refreshToken,
              expiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : undefined,
              languageId: res.user?.languageId,
              user: res.user,
            });
            
            // Clear stored credentials after successful login
            await AsyncStorage.removeItem('pendingPaymentCredentials');
            
            if (isInsecureMpin) {
              setSuccess(false);
              setShowChangeMpin(true);
            } else {
              setTimeout(() => {
                router.replace('/reporter/dashboard');
              }, 1500);
            }
          } catch (loginErr: any) {
            console.error('[PAYMENT] Login after retry verification failed', loginErr, {
              status: loginErr?.status,
              message: loginErr?.message,
              body: loginErr?.body,
            });
            // Clear stored credentials on failure too
            await AsyncStorage.removeItem('pendingPaymentCredentials');
            setTimeout(() => {
              router.replace('/auth/login');
            }, 2000);
          }
        }, 1000);
      } else {
        console.log('[PAYMENT] No credentials for auto-login after retry', {
          hasMobile: !!effectiveMobile,
          hasMpin: !!effectiveMpin,
          hasStoredCredentials: !!storedCredentials,
        });
        setTimeout(() => {
          router.replace('/auth/login');
        }, 2500);
      }
    } finally {
      setVerifying(false);
    }
  }, [pendingPaymentData, params.reporterId, params.tenantId, params.mobile, params.isNewReporter, effectiveMobile, effectiveMpin, storedCredentials, router]);

  // Go back
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth/login');
    }
  }, [router]);

  // Tenant branding from params
  const tenantLogo = params.tenantLogo;
  const tenantName = params.tenantNativeName || params.tenantName || 'Kaburlu';

  // Change MPIN state (after successful payment)
  if (showChangeMpin) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        
        {/* Header with tenant branding */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={{ width: 44 }} />
          <View style={styles.headerCenter}>
            {tenantLogo ? (
              <Image source={{ uri: tenantLogo }} style={styles.headerLogo} />
            ) : (
              <Image source={require('@/assets/images/app-icon.png')} style={styles.headerLogo} />
            )}
            <Text style={[styles.headerTitle, { color: textColor }]}>{tenantName}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.paymentCard, { backgroundColor: cardBg, borderColor }]}>
            {/* Icon */}
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.iconContainer}
            >
              <Ionicons name="shield-checkmark" size={36} color="#fff" />
            </LinearGradient>

            <Text style={[styles.title, { color: textColor }]}>MPIN సెట్ చేయండి</Text>
            <Text style={[styles.subtitle, { color: mutedColor }]}>
              మీ అకౌంట్ భద్రత కోసం కొత్త 4-అంకెల MPIN సృష్టించండి
            </Text>

            {/* MPIN Error */}
            {mpinError && (
              <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{mpinError}</Text>
              </View>
            )}

            {/* New MPIN Input */}
            <View style={styles.mpinInputContainer}>
              <Text style={[styles.mpinLabel, { color: textColor }]}>కొత్త MPIN</Text>
              <TextInput
                ref={newMpinRef}
                style={[styles.mpinTextInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: textColor, borderColor }]}
                value={newMpin}
                onChangeText={(t) => { 
                  const cleaned = t.replace(/\D/g, '').slice(0, 4);
                  setNewMpin(cleaned); 
                  setMpinError(null);
                  // Auto-move to confirm after 4 digits
                  if (cleaned.length === 4) {
                    setTimeout(() => confirmMpinRef.current?.focus(), 100);
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder=""
                placeholderTextColor={mutedColor}
                secureTextEntry
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => confirmMpinRef.current?.focus()}
              />
            </View>

            {/* Confirm MPIN Input */}
            <View style={styles.mpinInputContainer}>
              <Text style={[styles.mpinLabel, { color: textColor }]}>MPIN నిర్ధారించండి</Text>
              <TextInput
                ref={confirmMpinRef}
                style={[styles.mpinTextInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: textColor, borderColor }]}
                value={confirmMpin}
                onChangeText={(t) => { 
                  const cleaned = t.replace(/\D/g, '').slice(0, 4);
                  setConfirmMpin(cleaned); 
                  setMpinError(null);
                  // Auto-submit after 4 digits - validate directly before submit
                  if (cleaned.length === 4 && newMpin.length === 4) {
                    // Check match immediately with actual values
                    if (cleaned !== newMpin) {
                      setMpinError('MPIN లు సరిపోలడం లేదు');
                      return;
                    }
                    Keyboard.dismiss();
                    setTimeout(() => handleChangeMpin(), 300);
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder=""
                placeholderTextColor={mutedColor}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleChangeMpin}
              />
            </View>

            {/* Set MPIN Button */}
            <TouchableOpacity
              style={[styles.payBtn, changingMpin && styles.payBtnDisabled]}
              onPress={handleChangeMpin}
              disabled={changingMpin}
            >
              <LinearGradient
                colors={changingMpin ? ['#94a3b8', '#94a3b8'] : ['#10b981', '#059669']}
                style={styles.payBtnGradient}
              >
                {changingMpin ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.payBtnText}>MPIN సెట్ చేయండి</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.helpText, { color: mutedColor, marginTop: 16 }]}>
              మీ ఫోన్ నంబర్ చివరి 4 అంకెలు MPIN గా ఉపయోగించవద్దు
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Success state
  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.successContainer}>
          <LottieView
            source={require('@/assets/lotti/congratulation.json')}
            autoPlay
            loop={false}
            style={{ width: 280, height: 280 }}
          />
          <Text style={[styles.successTitle, { color: textColor }]}>Payment Successful! 🎉</Text>
          <Text style={[styles.successSubtitle, { color: mutedColor }]}>
            Logging you in...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header with tenant branding */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: cardBg }]} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {tenantLogo ? (
            <Image source={{ uri: tenantLogo }} style={styles.headerLogo} />
          ) : (
            <Image source={require('@/assets/images/app-icon.png')} style={styles.headerLogo} />
          )}
          <Text style={[styles.headerTitle, { color: textColor }]}>{tenantName}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Card */}
        <View style={[styles.paymentCard, { backgroundColor: cardBg, borderColor }]}>
          {/* Icon */}
          <LinearGradient
            colors={[SECONDARY, '#e85d04']}
            style={styles.iconContainer}
          >
            <MaterialCommunityIcons name="credit-card-check" size={36} color="#fff" />
          </LinearGradient>

          <Text style={[styles.title, { color: textColor }]}>Subscription Payment</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            Complete your payment to continue using reporter features
          </Text>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={[styles.loadingText, { color: mutedColor }]}>
                Loading payment details...
              </Text>
            </View>
          )}

          {/* Error */}
          {error && !loading && (
            <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Amount with Breakdown */}
          {razorpayData && !loading && (
            <>
              {/* Breakdown items */}
              {breakdown && (
                <View style={[styles.breakdownBox, { backgroundColor: isDark ? '#1a2744' : '#f8fafc', borderColor }]}>
                  {breakdown.idCardCharge && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: textColor }]}>{breakdown.idCardCharge.label}</Text>
                      <Text style={[styles.breakdownAmount, { color: textColor }]}>{breakdown.idCardCharge.displayAmount}</Text>
                    </View>
                  )}
                  {breakdown.monthlySubscription && (
                    <View style={styles.breakdownRow}>
                      <View>
                        <Text style={[styles.breakdownLabel, { color: textColor }]}>{breakdown.monthlySubscription.label}</Text>
                        {breakdown.monthlySubscription.month && breakdown.monthlySubscription.year && (
                          <Text style={[styles.breakdownMeta, { color: mutedColor }]}>
                            ({getMonthName(breakdown.monthlySubscription.month)} {breakdown.monthlySubscription.year})
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.breakdownAmount, { color: textColor }]}>{breakdown.monthlySubscription.displayAmount}</Text>
                    </View>
                  )}
                  <View style={[styles.breakdownDivider, { borderColor }]} />
                  {breakdown.total && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownTotalLabel, { color: textColor }]}>{breakdown.total.label}</Text>
                      <Text style={[styles.breakdownTotalAmount, { color: PRIMARY }]}>{breakdown.total.displayAmount}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Fallback amount display if no breakdown */}
              {!breakdown && (
                <View style={[styles.amountBox, { backgroundColor: isDark ? '#1a2744' : '#eff6ff', borderColor: isDark ? '#2563eb33' : '#bfdbfe' }]}>
                  <Text style={[styles.amountLabel, { color: mutedColor }]}>Amount Due</Text>
                  <Text style={[styles.amountValue, { color: PRIMARY }]}>
                    {formatPaymentAmount(razorpayData.amount)}
                  </Text>
                </View>
              )}

              {/* Features */}
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={[styles.featureText, { color: textColor }]}>Full reporter access</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={[styles.featureText, { color: textColor }]}>Post unlimited articles</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={[styles.featureText, { color: textColor }]}>Access to all features</Text>
                </View>
              </View>

              {/* Pay Button */}
              <TouchableOpacity
                style={[styles.payBtn, paying && styles.payBtnDisabled]}
                onPress={handlePayment}
                disabled={paying}
              >
                <LinearGradient
                  colors={paying ? ['#94a3b8', '#94a3b8'] : [PRIMARY, '#0a4490']}
                  style={styles.payBtnGradient}
                >
                  {paying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={20} color="#fff" />
                      <Text style={styles.payBtnText}>Pay Securely</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Security badge */}
              <View style={styles.securityBadge}>
                <Ionicons name="lock-closed" size={14} color={mutedColor} />
                <Text style={[styles.securityText, { color: mutedColor }]}>
                  Secured by Razorpay • 256-bit encryption
                </Text>
              </View>
            </>
          )}

          {/* Retry Verification button when payment was made but verification failed */}
          {error && !loading && pendingPaymentData && (
            <TouchableOpacity
              style={[styles.retryVerifyBtn, verifying && styles.payBtnDisabled]}
              onPress={handleRetryVerification}
              disabled={verifying}
            >
              <LinearGradient
                colors={verifying ? ['#94a3b8', '#94a3b8'] : [SECONDARY, '#e85d04']}
                style={styles.payBtnGradient}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.payBtnText}>Retry Verification</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Back to login button for errors */}
          {error && !loading && (
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor }]}
              onPress={() => router.replace('/auth/login')}
            >
              <Ionicons name="arrow-back" size={18} color={PRIMARY} />
              <Text style={[styles.retryText, { color: PRIMARY }]}>Back to Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Help text */}
        <Text style={[styles.helpText, { color: mutedColor }]}>
          Having trouble? Contact support at support@kaburlumedia.com
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  paymentCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  amountBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 42,
    fontWeight: '800',
  },
  featuresList: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  payBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  payBtnDisabled: {
    opacity: 0.7,
  },
  payBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Breakdown styles
  breakdownBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  breakdownMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  breakdownDivider: {
    height: 1,
    borderTopWidth: 1,
    marginVertical: 8,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownTotalAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  retryVerifyBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 24,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: -20,
  },
  successSubtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  // MPIN Input styles
  mpinInputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  mpinLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  mpinTextInput: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'left',
    letterSpacing: 8,
  },
});
