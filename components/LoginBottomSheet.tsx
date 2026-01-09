/**
 * LoginBottomSheet - Industry-level News-style Login Experience
 * 
 * A beautiful, professional bottom sheet login flow with:
 * - Newspaper-style typography and branding
 * - Smooth animations and haptic feedback
 * - Auto-detect new vs returning users
 * - MPIN-based secure authentication
 * - Forgot MPIN flow with OTP
 * - Glassmorphism and modern design patterns
 */

import { Colors } from '@/constants/Colors';
import { useAuthModal } from '@/context/AuthModalContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createCitizenReporterMobile, getMpinStatus, loginWithMpin, requestOtpForMpinReset, setNewMpin, verifyOtpForMpinReset } from '@/services/api';
import { getLastMobile, saveTokens } from '@/services/auth';
import { getDeviceIdentity } from '@/services/device';
import { requestAppPermissions } from '@/services/permissions';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PRIMARY = Colors.light.primary;
const SECONDARY = Colors.light.secondary;

// Step indicator component
const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
  <View style={stepStyles.container}>
    {Array.from({ length: totalSteps }).map((_, i) => (
      <View
        key={i}
        style={[
          stepStyles.dot,
          i < currentStep && stepStyles.dotCompleted,
          i === currentStep && stepStyles.dotActive,
        ]}
      />
    ))}
  </View>
);

const stepStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { width: 24, backgroundColor: SECONDARY },
  dotCompleted: { backgroundColor: PRIMARY },
});

// Type for user status
type UserStatus = { mpinStatus: boolean; isRegistered: boolean; roleName: string | null } | null;

// Main LoginBottomSheet Component
const LoginBottomSheet: React.FC = () => {
  const { showLoginSheet, closeLoginSheet, sheetOptions, onLoginSuccess } = useAuthModal();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.95)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  
  // State
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<UserStatus>(null);
  const [checking, setChecking] = useState(false);
  const [mpinDigits, setMpinDigits] = useState(['', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);
  
  // Reset flow states
  const [showReset, setShowReset] = useState(false);
  const [resetStage, setResetStage] = useState<'request' | 'verify' | 'set'>('request');
  const [resetCorrelationId, setResetCorrelationId] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [resetNew, setResetNew] = useState(['', '', '', '']);
  const [resetConfirm, setResetConfirm] = useState(['', '', '', '']);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  // Refs
  const mobileRef = useRef<TextInput>(null);
  const mpinRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const fullNameRef = useRef<TextInput>(null);
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const resetNewRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const resetConfirmRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const mpinShake = useRef(new Animated.Value(0)).current;
  const submittingRef = useRef(false);
  
  // Derived values
  const mpin = mpinDigits.join('');
  const isExisting = status?.isRegistered === true;
  const isNew = status?.isRegistered === false;
  const currentStep = !status ? 0 : isExisting ? 1 : 1;
  const totalSteps = isNew ? 2 : 2;
  
  // Load last mobile on mount
  useEffect(() => {
    if (showLoginSheet) {
      (async () => {
        const prefill = sheetOptions?.mobile;
        if (prefill) {
          setMobile(prefill);
        } else {
          try {
            const last = await getLastMobile();
            if (last) setMobile(last);
          } catch {}
        }
      })();
    }
  }, [showLoginSheet, sheetOptions?.mobile]);
  
  // Animation handlers
  useEffect(() => {
    if (showLoginSheet) {
      // Open animations
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentScale, { toValue: 1, useNativeDriver: true, damping: 15 }),
        Animated.timing(formOpacity, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
      ]).start();
      // Auto focus mobile field
      setTimeout(() => mobileRef.current?.focus(), 400);
    } else {
      // Close animations
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [showLoginSheet, slideAnim, backdropOpacity, contentScale, formOpacity]);
  
  // Check mobile status when 10 digits entered
  useEffect(() => {
    let cancelled = false;
    if (!/^\d{10}$/.test(mobile)) {
      setStatus(null);
      return;
    }
    setChecking(true);
    setError(null);
    (async () => {
      try {
        const res = await getMpinStatus(mobile);
        const r: any = res;
        const isReg = !!(r.isRegistered ?? r.mpinStatus ?? r.roleName);
        if (!cancelled) setStatus({ mpinStatus: !!r.mpinStatus, isRegistered: isReg, roleName: r.roleName });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to check number');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mobile]);
  
  // Auto-focus based on status
  useEffect(() => {
    if (!status || checking) return;
    const timer = setTimeout(() => {
      if (status.isRegistered) {
        mpinRefs[0].current?.focus();
      } else {
        fullNameRef.current?.focus();
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, checking]);
  
  // Cooldown timer for OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  
  // Persist auth response
  const persistAuth = useCallback(async (data: any) => {
    try {
      const jwt = data.jwt || data.token;
      const refreshToken = data.refreshToken;
      const expiresIn = data.expiresIn || data.expiresInSec;
      const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
      const user = data.user;
      const languageId = user?.languageId || data.languageId;
      const session = {
        tenantId: data?.tenantId,
        domainId: data?.domainId,
        tenant: data?.tenant,
        domain: data?.domain,
        domainSettings: data?.domainSettings,
        tenantReporter: data?.tenantReporter ?? data?.reporter ?? data?.reporterProfile ?? undefined,
      };
      const hasSession = !!(session.tenantId || session.domainId || session.tenant || session.domain);
      await saveTokens({ jwt, refreshToken, expiresAt, user, languageId, session: hasSession ? session : undefined });
      if (user?.role) await AsyncStorage.setItem('profile_role', user.role);
      await AsyncStorage.setItem('is_authenticated', '1');
      await AsyncStorage.setItem('profile_mobile', mobile);
      await AsyncStorage.setItem('last_login_mobile', mobile);
    } catch (e: any) {
      console.warn('persistAuth failed', e.message);
    }
  }, [mobile]);
  
  // Login handler
  const handleLogin = useCallback(async (overrideMpin?: string) => {
    if (submittingRef.current) return;
    const effectiveMpin = overrideMpin ?? mpin;
    if (!/^\d{10}$/.test(mobile) || !/^\d{4}$/.test(effectiveMpin)) return;
    if (attemptsLeft <= 0) return;
    
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    
    try {
      const res = await loginWithMpin({ mobileNumber: mobile, mpin: effectiveMpin });
      await persistAuth(res);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSuccess('Login successful!');
      setShowCongrats(true);
      onLoginSuccess?.(res);
      setTimeout(() => {
        setShowCongrats(false);
        closeLoginSheet();
        resetState();
      }, 1800);
    } catch (e: any) {
      if (e?.status === 401) {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        setMpinDigits(['', '', '', '']);
        setError(remaining > 0 ? `Incorrect MPIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : 'Too many attempts.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeError();
        if (remaining > 0) setTimeout(() => mpinRefs[0].current?.focus(), 100);
      } else {
        setError(e?.message || 'Login failed');
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, mpin, attemptsLeft, persistAuth, onLoginSuccess, closeLoginSheet]);
  
  // Registration handler
  const handleRegister = useCallback(async () => {
    if (submittingRef.current) return;
    if (!/^\d{10}$/.test(mobile) || !fullName.trim() || !/^\d{4}$/.test(mpin)) return;
    
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    
    try {
      let languageId: string | undefined;
      try { const raw = await AsyncStorage.getItem('selectedLanguage'); if (raw) languageId = JSON.parse(raw)?.id; } catch {}
      if (!languageId) languageId = 'en';
      const device = await getDeviceIdentity();
      let pushToken: string | undefined;
      let location: any;
      try {
        const perms = await requestAppPermissions();
        pushToken = perms.pushToken;
        if (perms.coordsDetailed) {
          location = {
            latitude: perms.coordsDetailed.latitude,
            longitude: perms.coordsDetailed.longitude,
            accuracyMeters: perms.coordsDetailed.accuracy,
            provider: 'fused',
            timestampUtc: new Date(perms.coordsDetailed.timestamp || Date.now()).toISOString(),
            placeId: null,
            placeName: perms.place?.fullName || perms.place?.name || null,
            address: perms.place?.fullName || null,
            source: 'foreground',
          };
        }
      } catch {}
      
      const res = await createCitizenReporterMobile({
        mobileNumber: mobile,
        mpin,
        fullName: fullName.trim(),
        deviceId: device.deviceId,
        pushToken,
        languageId,
        location,
      });
      await persistAuth(res);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSuccess('Account created!');
      setShowCongrats(true);
      onLoginSuccess?.(res);
      setTimeout(() => {
        setShowCongrats(false);
        closeLoginSheet();
        resetState();
      }, 1800);
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, fullName, mpin, persistAuth, onLoginSuccess, closeLoginSheet]);
  
  // Shake animation for errors
  const shakeError = useCallback(() => {
    mpinShake.setValue(0);
    Animated.sequence([
      Animated.timing(mpinShake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(mpinShake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(mpinShake, { toValue: 0.6, duration: 50, useNativeDriver: true }),
      Animated.timing(mpinShake, { toValue: -0.6, duration: 50, useNativeDriver: true }),
      Animated.timing(mpinShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [mpinShake]);
  
  const shakeStyle = useMemo(() => ({
    transform: [{ translateX: mpinShake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) }],
  }), [mpinShake]);
  
  // Reset state
  const resetState = useCallback(() => {
    setMobile('');
    setStatus(null);
    setMpinDigits(['', '', '', '']);
    setFullName('');
    setError(null);
    setSuccess(null);
    setAttemptsLeft(3);
    setShowReset(false);
    setResetStage('request');
    setResetCorrelationId(null);
    setOtpDigits(['', '', '', '']);
    setResetNew(['', '', '', '']);
    setResetConfirm(['', '', '', '']);
    setResetError(null);
    setCooldown(0);
  }, []);
  
  // Handle MPIN digit input
  const handleMpinChange = useCallback((idx: number, val: string) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...mpinDigits];
    next[idx] = c;
    setMpinDigits(next);
    setError(null);
    
    if (c && idx < 3) {
      setTimeout(() => mpinRefs[idx + 1].current?.focus(), 30);
    }
    if (idx === 3 && c) {
      const code = next.join('');
      if (/^\d{4}$/.test(code)) {
        setTimeout(() => {
          Keyboard.dismiss();
          if (isExisting) {
            handleLogin(code);
          } else if (isNew && fullName.trim()) {
            handleRegister();
          }
        }, 80);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpinDigits, isExisting, isNew, fullName, handleLogin, handleRegister]);
  
  const handleMpinKeyPress = useCallback((idx: number, key: string) => {
    if (key === 'Backspace' && !mpinDigits[idx] && idx > 0) {
      setTimeout(() => mpinRefs[idx - 1].current?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpinDigits]);

  const openReset = useCallback(() => {
    setResetStage('request');
    setResetCorrelationId(null);
    setOtpDigits(['', '', '', '']);
    setResetNew(['', '', '', '']);
    setResetConfirm(['', '', '', '']);
    setResetError(null);
    setCooldown(0);
    setShowReset(true);
  }, []);
  
  // Forgot MPIN handlers
  const requestOtp = useCallback(async () => {
    if (resetLoading) return;
    if (!/^\d{10}$/.test(mobile)) {
      setResetError('Enter a valid 10-digit mobile number');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await requestOtpForMpinReset(mobile);
      setResetCorrelationId(res.id);
      setResetStage('verify');
      setCooldown(45);
      setTimeout(() => otpRefs[0].current?.focus(), 150);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      setResetError(e?.message || 'Failed to send OTP');
    } finally {
      setResetLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, resetLoading]);
  
  const verifyOtp = useCallback(async () => {
    const code = otpDigits.join('');
    if (!/^\d{4}$/.test(code) || !resetCorrelationId || resetLoading) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await verifyOtpForMpinReset({ id: resetCorrelationId, otp: code });
      setResetStage('set');
      setTimeout(() => resetNewRefs[0].current?.focus(), 150);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setResetError(e?.message || 'Invalid OTP');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpDigits, resetCorrelationId, resetLoading]);
  
  const submitNewMpin = useCallback(async () => {
    const newCode = resetNew.join('');
    const confirmCode = resetConfirm.join('');
    if (!/^\d{4}$/.test(newCode) || newCode !== confirmCode || !resetCorrelationId || resetLoading) {
      if (newCode !== confirmCode) setResetError('MPINs do not match');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      await setNewMpin({ id: resetCorrelationId, mobileNumber: mobile, mpin: newCode });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMpinDigits(resetNew);
      setShowReset(false);
      setResetStage('request');
      setResetCorrelationId(null);
      setResetNew(['', '', '', '']);
      setResetConfirm(['', '', '', '']);
      setOtpDigits(['', '', '', '']);
      setTimeout(() => mpinRefs[0].current?.focus(), 150);
    } catch (e: any) {
      setResetError(e?.message || 'Failed to set MPIN');
    } finally {
      setResetLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNew, resetConfirm, resetCorrelationId, mobile, resetLoading]);
  
  // Generic digit handler for OTP/reset
  const handleDigitInput = useCallback((
    arr: string[],
    setArr: (v: string[]) => void,
    idx: number,
    val: string,
    refs: React.RefObject<TextInput | null>[],
    onComplete?: () => void
  ) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...arr];
    next[idx] = c;
    setArr(next);
    setResetError(null);
    if (c && idx < 3) {
      setTimeout(() => refs[idx + 1].current?.focus(), 30);
    }
    if (idx === 3 && c && /^\d{4}$/.test(next.join(''))) {
      setTimeout(() => { Keyboard.dismiss(); onComplete?.(); }, 80);
    }
  }, []);
  
  const handleDigitKeyPress = useCallback((
    arr: string[],
    idx: number,
    key: string,
    refs: React.RefObject<TextInput | null>[]
  ) => {
    if (key === 'Backspace' && !arr[idx] && idx > 0) {
      setTimeout(() => refs[idx - 1].current?.focus(), 30);
    }
  }, []);
  
  if (!showLoginSheet) return null;
  
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedColor = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = isDark ? '#252525' : '#F9FAFB';
  const borderColor = isDark ? '#333' : '#E5E7EB';
  
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={closeLoginSheet}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeLoginSheet} />
      </Animated.View>
      
      {/* Sheet */}
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }, { scale: contentScale }], backgroundColor: bgColor, paddingBottom: insets.bottom + 16 },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.logoContainer}>
                <LinearGradient colors={[PRIMARY, '#0a4490']} style={styles.logoGradient}>
                  <Image source={require('@/assets/images/app-icon.png')} style={styles.logo} resizeMode="contain" />
                </LinearGradient>
              </View>
              <View>
                <Text style={[styles.brandName, { color: textColor }]}>
                  {sheetOptions?.title || 'Kaburlu'}
                </Text>
                <Text style={[styles.brandTagline, { color: SECONDARY }]}>
                  Citizen Journalism
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeLoginSheet} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={mutedColor} />
            </TouchableOpacity>
          </View>
          
          {/* Step Indicator */}
          {status && <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />}
          
          <Animated.View style={[styles.content, { opacity: formOpacity }]}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: textColor }]}>
                {isExisting ? '👋 Welcome Back!' : isNew ? '🎉 Join the Community' : '📰 Get Started'}
              </Text>
              <Text style={[styles.subtitle, { color: mutedColor }]}>
                {sheetOptions?.subtitle || (isExisting 
                  ? 'Enter your MPIN to continue reading' 
                  : isNew 
                    ? 'Create your reporter account in seconds'
                    : 'Enter your mobile number to begin')}
              </Text>
            </View>
            
            {/* Mobile Input */}
            {(!status || isNew) && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: textColor }]}>Mobile Number</Text>
                <View style={[styles.mobileRow, focusedField === 'mobile' && styles.inputFocused, { backgroundColor: cardBg, borderColor }]}>
                  <View style={[styles.countryBox, { borderColor }]}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={[styles.countryCode, { color: PRIMARY }]}>+91</Text>
                  </View>
                  <TextInput
                    ref={mobileRef}
                    value={mobile}
                    onChangeText={(t) => {
                      const clean = t.replace(/\D/g, '').slice(0, 10);
                      setMobile(clean);
                      setError(null);
                    }}
                    placeholder="10-digit number"
                    placeholderTextColor={mutedColor}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={[styles.mobileInput, { color: textColor }]}
                    onFocus={() => setFocusedField('mobile')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {checking && <ActivityIndicator size="small" color={SECONDARY} />}
                  {mobile.length === 10 && !checking && status && (
                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  )}
                </View>
              </View>
            )}
            
            {/* Existing User - MPIN Section */}
            {isExisting && (
              <View style={styles.section}>
                {/* Show masked mobile */}
                <View style={[styles.maskedRow, { backgroundColor: cardBg, borderColor }]}>
                  <View style={styles.maskedInfo}>
                    <MaterialCommunityIcons name="cellphone" size={20} color={PRIMARY} />
                    <Text style={[styles.maskedText, { color: textColor }]}>
                      +91 {mobile.replace(/^(\d{3})\d{4}(\d{3})$/, '$1 •••• $2')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setStatus(null); setMpinDigits(['', '', '', '']); }}>
                    <Text style={[styles.changeBtn, { color: SECONDARY }]}>Change</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.label, { color: textColor, marginTop: 16 }]}>Enter MPIN</Text>
                <Animated.View style={[styles.mpinRow, error && shakeStyle]}>
                  {mpinRefs.map((ref, i) => (
                    <TextInput
                      key={i}
                      ref={ref}
                      value={mpinDigits[i]}
                      onChangeText={(v) => handleMpinChange(i, v)}
                      onKeyPress={({ nativeEvent }) => handleMpinKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={[
                        styles.mpinBox,
                        { backgroundColor: cardBg, borderColor },
                        mpinDigits[i] && styles.mpinBoxFilled,
                        focusedField === `mpin-${i}` && styles.mpinBoxFocused,
                      ]}
                      onFocus={() => setFocusedField(`mpin-${i}`)}
                      onBlur={() => setFocusedField(null)}
                    />
                  ))}
                </Animated.View>
                
                {/* Forgot MPIN */}
                <TouchableOpacity onPress={openReset} style={styles.forgotBtn}>
                  <Text style={[styles.forgotText, { color: SECONDARY }]}>Forgot MPIN?</Text>
                </TouchableOpacity>
                
                {/* Login Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, (mpin.length !== 4 || submitting || attemptsLeft <= 0) && styles.btnDisabled]}
                  onPress={() => handleLogin()}
                  disabled={mpin.length !== 4 || submitting || attemptsLeft <= 0}
                >
                  <LinearGradient colors={attemptsLeft <= 0 ? ['#9CA3AF', '#6B7280'] : [PRIMARY, '#0a4490']} style={styles.btnGradient}>
                    {submitting && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
                    <Text style={styles.btnText}>
                      {attemptsLeft <= 0 ? '🔒 Locked' : submitting ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {/* New User - Registration */}
            {isNew && (
              <View style={styles.section}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: textColor }]}>Full Name</Text>
                  <View style={[styles.textInputRow, focusedField === 'fullName' && styles.inputFocused, { backgroundColor: cardBg, borderColor }]}>
                    <Ionicons name="person-outline" size={20} color={mutedColor} />
                    <TextInput
                      ref={fullNameRef}
                      value={fullName}
                      onChangeText={(t) => setFullName(t.replace(/[^a-zA-Z\s.-]/g, '').slice(0, 50))}
                      placeholder="Enter your full name"
                      placeholderTextColor={mutedColor}
                      style={[styles.textInput, { color: textColor }]}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: textColor }]}>Create MPIN</Text>
                  <View style={styles.mpinRow}>
                    {mpinRefs.map((ref, i) => (
                      <TextInput
                        key={i}
                        ref={ref}
                        value={mpinDigits[i]}
                        onChangeText={(v) => handleMpinChange(i, v)}
                        onKeyPress={({ nativeEvent }) => handleMpinKeyPress(i, nativeEvent.key)}
                        keyboardType="number-pad"
                        maxLength={1}
                        secureTextEntry
                        style={[
                          styles.mpinBox,
                          { backgroundColor: cardBg, borderColor },
                          mpinDigits[i] && styles.mpinBoxFilled,
                          focusedField === `mpin-${i}` && styles.mpinBoxFocused,
                        ]}
                        onFocus={() => setFocusedField(`mpin-${i}`)}
                        onBlur={() => setFocusedField(null)}
                      />
                    ))}
                  </View>
                  <Text style={[styles.hint, { color: mutedColor }]}>💡 Choose a memorable 4-digit PIN</Text>
                </View>
                
                {/* Register Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, (!fullName.trim() || mpin.length !== 4 || submitting) && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={!fullName.trim() || mpin.length !== 4 || submitting}
                >
                  <LinearGradient colors={[SECONDARY, '#e86e00']} style={styles.btnGradient}>
                    {submitting && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
                    <Text style={styles.btnText}>{submitting ? 'Creating Account...' : 'Create Account'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Error/Success Messages */}
            {error && (
              <View style={styles.messageRow}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={styles.messageRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successText}>{success}</Text>
              </View>
            )}
            
            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: mutedColor }]}>
                By continuing, you agree to our{' '}
                <Text style={[styles.footerLink, { color: PRIMARY }]}>Terms</Text>
                {' & '}
                <Text style={[styles.footerLink, { color: PRIMARY }]}>Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
      
      {/* Forgot MPIN Modal */}
      <Modal
        visible={showReset}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowReset(false);
          setResetStage('request');
          setResetCorrelationId(null);
          setOtpDigits(['', '', '', '']);
          setResetNew(['', '', '', '']);
          setResetConfirm(['', '', '', '']);
          setResetError(null);
          setCooldown(0);
        }}
      >
        <View style={styles.resetBackdrop}>
          <View style={[styles.resetCard, { backgroundColor: bgColor }]}>
            <View style={styles.resetHeader}>
              <Text style={[styles.resetTitle, { color: textColor }]}>🔐 Reset MPIN</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReset(false);
                  setResetStage('request');
                  setResetCorrelationId(null);
                  setOtpDigits(['', '', '', '']);
                  setResetNew(['', '', '', '']);
                  setResetConfirm(['', '', '', '']);
                  setResetError(null);
                  setCooldown(0);
                }}
              >
                <Ionicons name="close-circle" size={28} color={mutedColor} />
              </TouchableOpacity>
            </View>
            
            {resetStage === 'request' && (
              <>
                <Text style={[styles.resetSubtitle, { color: mutedColor }]}>We&apos;ll send OTP to</Text>
                <Text style={[styles.resetMobile, { color: PRIMARY }]}>+91 {mobile}</Text>
                <TouchableOpacity
                  style={[styles.resetBtn, resetLoading && styles.btnDisabled]}
                  onPress={requestOtp}
                  disabled={resetLoading}
                >
                  <Text style={styles.resetBtnText}>{resetLoading ? 'Sending...' : 'Send OTP'}</Text>
                </TouchableOpacity>
              </>
            )}
            
            {resetStage === 'verify' && (
              <>
                <Text style={[styles.resetSubtitle, { color: mutedColor }]}>Enter OTP sent to +91 {mobile}</Text>
                <View style={styles.otpRow}>
                  {otpRefs.map((ref, i) => (
                    <TextInput
                      key={i}
                      ref={ref}
                      value={otpDigits[i]}
                      onChangeText={(v) => handleDigitInput(otpDigits, setOtpDigits, i, v, otpRefs, verifyOtp)}
                      onKeyPress={({ nativeEvent }) => handleDigitKeyPress(otpDigits, i, nativeEvent.key, otpRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.otpBox, { backgroundColor: cardBg, borderColor }, otpDigits[i] && styles.otpBoxFilled]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.resetBtn, (resetLoading || otpDigits.join('').length !== 4) && styles.btnDisabled]}
                  onPress={verifyOtp}
                  disabled={resetLoading || otpDigits.join('').length !== 4}
                >
                  <Text style={styles.resetBtnText}>{resetLoading ? 'Verifying...' : 'Verify OTP'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={requestOtp}
                  disabled={cooldown > 0 || resetLoading}
                  style={styles.resendBtn}
                >
                  <Text style={[styles.resendText, { color: cooldown > 0 ? mutedColor : SECONDARY }]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            
            {resetStage === 'set' && (
              <>
                <Text style={[styles.resetSubtitle, { color: mutedColor }]}>Create your new MPIN</Text>
                <Text style={[styles.resetLabel, { color: textColor }]}>New MPIN</Text>
                <View style={styles.otpRow}>
                  {resetNewRefs.map((ref, i) => (
                    <TextInput
                      key={i}
                      ref={ref}
                      value={resetNew[i]}
                      onChangeText={(v) => handleDigitInput(resetNew, setResetNew, i, v, resetNewRefs)}
                      onKeyPress={({ nativeEvent }) => handleDigitKeyPress(resetNew, i, nativeEvent.key, resetNewRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={[styles.otpBox, { backgroundColor: cardBg, borderColor }, resetNew[i] && styles.otpBoxFilled]}
                    />
                  ))}
                </View>
                <Text style={[styles.resetLabel, { color: textColor }]}>Confirm MPIN</Text>
                <View style={styles.otpRow}>
                  {resetConfirmRefs.map((ref, i) => (
                    <TextInput
                      key={i}
                      ref={ref}
                      value={resetConfirm[i]}
                      onChangeText={(v) => handleDigitInput(resetConfirm, setResetConfirm, i, v, resetConfirmRefs, submitNewMpin)}
                      onKeyPress={({ nativeEvent }) => handleDigitKeyPress(resetConfirm, i, nativeEvent.key, resetConfirmRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={[styles.otpBox, { backgroundColor: cardBg, borderColor }, resetConfirm[i] && styles.otpBoxFilled]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.resetBtn, (resetLoading || resetNew.join('') !== resetConfirm.join('') || resetNew.join('').length !== 4) && styles.btnDisabled]}
                  onPress={submitNewMpin}
                  disabled={resetLoading || resetNew.join('') !== resetConfirm.join('') || resetNew.join('').length !== 4}
                >
                  <Text style={styles.resetBtnText}>{resetLoading ? 'Saving...' : 'Save New MPIN'}</Text>
                </TouchableOpacity>
              </>
            )}
            
            {resetError && (
              <View style={styles.resetErrorRow}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.resetErrorText}>{resetError}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Success Animation */}
      {showCongrats && (
        <View style={styles.congratsOverlay} pointerEvents="none">
          <LottieView
            source={require('@/assets/lotti/congratulation.json')}
            autoPlay
            loop={false}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.congratsText}>🎉 {success || 'Success!'}</Text>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 8,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    paddingRight: 12,
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    marginRight: 10,
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '700',
  },
  mobileInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  section: {
    marginTop: 8,
  },
  maskedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  maskedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  maskedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  changeBtn: {
    fontSize: 13,
    fontWeight: '700',
  },
  mpinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  mpinBox: {
    width: 58,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  mpinBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: '#EFF6FF',
  },
  mpinBoxFocused: {
    borderColor: SECONDARY,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 14,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    fontWeight: '700',
  },
  // Reset Modal
  resetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resetCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  resetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  resetSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  resetMobile: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  resetLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  resetBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  resendBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  otpBox: {
    width: 54,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: '#EFF6FF',
  },
  resetErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  resetErrorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  // Congrats
  congratsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: -30,
  },
});

export default LoginBottomSheet;
