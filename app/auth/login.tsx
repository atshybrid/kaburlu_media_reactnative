/**
 * LoginScreen - Premium Universal Authentication
 * 
 * A stunning, industry-level login experience with:
 * - Modern glassmorphism and gradient design
 * - Universal support for all user roles
 * - Smooth micro-interactions and haptic feedback
 * - Best-in-class UI/UX patterns
 * - Seamless MPIN-based authentication
 * - Dark mode with elegant theming
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createCitizenReporterMobile, getMpinStatus, loginWithMpin, PaymentRequiredError, requestOtpForMpinReset, setNewMpin, verifyOtpForMpinReset } from '@/services/api';
import { getLastMobile, saveTokens } from '@/services/auth';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = Colors.light.primary;
const SECONDARY = Colors.light.secondary;

// ============================================================================
// ANIMATED GRADIENT BACKGROUND
// ============================================================================
const AnimatedBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(animValue, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    ).start();
  }, [animValue]);
  
  const gradientColors = isDark 
    ? ['#0a1628', '#1a2744', '#0d1a2d'] as const
    : ['#EBF4FF', '#F0F7FF', '#E8F1FF'] as const;
  
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      {/* Animated orbs */}
      <Animated.View style={[styles.orb, styles.orb1, { opacity: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }) }]} />
      <Animated.View style={[styles.orb, styles.orb2, { opacity: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.2] }) }]} />
    </View>
  );
};

// ============================================================================
// PREMIUM HEADER
// ============================================================================
const PremiumHeader: React.FC<{ onBack: () => void; isDark: boolean }> = ({ onBack, isDark }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : PRIMARY} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Image source={require('@/assets/images/app-icon.png')} style={styles.headerLogo} resizeMode="contain" />
      <Text style={[styles.headerTitle, { color: isDark ? '#fff' : PRIMARY }]}>Kaburlu</Text>
    </View>
    <View style={{ width: 44 }} />
  </View>
);

// ============================================================================
// STEP PROGRESS
// ============================================================================
const StepProgress: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <View style={styles.stepsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={styles.stepContainer}>
        <View style={[styles.stepDot, i < step && styles.stepDotDone, i === step && styles.stepDotActive]}>
          {i < step && <Ionicons name="checkmark" size={12} color="#fff" />}
          {i === step && <View style={styles.stepDotInner} />}
        </View>
        {i < total - 1 && <View style={[styles.stepLine, i < step && styles.stepLineDone]} />}
      </View>
    ))}
  </View>
);

// ============================================================================
// MPIN INPUT - Single hidden input for fast typing
// ============================================================================
type MpinInputProps = {
  digits: string[];
  onChange: (idx: number, val: string) => void;
  onKeyPress: (idx: number, key: string) => void;
  refs: React.RefObject<TextInput | null>[];
  shake?: Animated.Value;
  error?: boolean;
  isDark: boolean;
  onComplete?: (code: string) => void;
  value: string;
  onValueChange: (val: string) => void;
};

type MpinInputHandle = {
  focus: () => void;
  blur: () => void;
};

const MpinInput = React.forwardRef<MpinInputHandle, MpinInputProps>(
  ({ digits, shake, error, isDark, value, onValueChange }, ref) => {
    const hiddenInputRef = React.useRef<TextInput>(null);
    const shakeStyle = shake ? {
      transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) }],
    } : {};
    
    // Expose focus/blur to parent
    React.useImperativeHandle(ref, () => ({
      focus: () => hiddenInputRef.current?.focus(),
      blur: () => hiddenInputRef.current?.blur(),
    }));
    
    const handlePress = () => {
      hiddenInputRef.current?.focus();
    };

    const handleChange = (text: string) => {
      // Only allow digits, max 4
      const cleaned = text.replace(/\D/g, '').slice(0, 4);
      onValueChange(cleaned);
      
      // Auto-dismiss keyboard after 4 digits
      if (cleaned.length === 4) {
        setTimeout(() => {
          Keyboard.dismiss();
        }, 100);
      }
    };
    
    return (
      <Pressable onPress={handlePress}>
        <Animated.View style={[styles.mpinRow, shakeStyle]}>
          {/* Hidden input that handles all typing */}
          <TextInput
            ref={hiddenInputRef}
            value={value}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus={false}
            style={styles.hiddenInput}
            caretHidden
          />
          
          {/* Visual boxes */}
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.mpinContainer, error && styles.mpinError]}>
              <View style={[
                styles.mpinInput,
                { justifyContent: 'center', alignItems: 'center' },
                value[i] && styles.mpinInputFilled,
              ]}>
                <Text style={{ 
                  color: isDark ? '#fff' : PRIMARY, 
                  fontSize: 24, 
                  fontWeight: '700',
                }}>
                  {value[i] ? '•' : ''}
                </Text>
              </View>
              <View style={[styles.mpinUnderline, value[i] && styles.mpinUnderlineActive]} />
            </View>
          ))}
        </Animated.View>
      </Pressable>
    );
  }
);

// ============================================================================
// MAIN LOGIN SCREEN
// ============================================================================
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mobile?: string; from?: string; role?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Role hint from navigation (e.g., CITIZEN_REPORTER from Post tab)
  const requestedRole = params.role || null;
  
  // State
  const [mobile, setMobile] = useState(params.mobile || '');
  const [status, setStatus] = useState<{ mpinStatus: boolean; isRegistered: boolean; roleName: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [mpinDigits, setMpinDigits] = useState(['', '', '', '']);
  const [mpinValue, setMpinValue] = useState(''); // Single string for fast MPIN input
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [showCongrats, setShowCongrats] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Reset flow
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
  const mpinInputRef = useRef<MpinInputHandle>(null);
  const mpinRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const fullNameRef = useRef<TextInput>(null);
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const resetNewRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const resetConfirmRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const submittingRef = useRef(false);
  const didPrefillRef = useRef(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const mpinShake = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Derived
  const mpin = mpinValue; // Direct string instead of joining array
  const isExisting = status?.isRegistered === true;
  const isNew = status?.isRegistered === false;
  
  // Theme
  const cardBg = isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.95)';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(241,245,249,0.8)';
  const borderColor = isDark ? 'rgba(71,85,105,0.5)' : 'rgba(226,232,240,0.8)';
  
  // Load last mobile
  useEffect(() => {
    if (didPrefillRef.current) return;
    didPrefillRef.current = true;
    (async () => {
      if (!params.mobile) {
        try {
          const last = await getLastMobile();
          if (last) setMobile(m => m || last);
        } catch {}
      }
    })();
  }, [params.mobile]);
  
  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 100 }),
    ]).start();
    
    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, glowAnim]);
  
  // Keyboard listener
  useEffect(() => {
    const showEvent = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideEvent = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    const show = Keyboard.addListener(showEvent, (e: any) => setKeyboardHeight(e?.endCoordinates?.height || 0));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  
  // Check status when mobile is 10 digits
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
        if (!cancelled) {
          setStatus({ mpinStatus: !!r.mpinStatus, isRegistered: isReg, roleName: r.roleName });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (e: any) {
        // Handle 402 Payment Required - navigate to payment screen directly
        if (e instanceof PaymentRequiredError) {
          if (!cancelled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            
            // Extract tenant data for branding
            const tenantData = (e.data as any)?.tenant;
            
            router.push({
              pathname: '/auth/payment',
              params: {
                reporterId: e.data?.reporter?.id || '',
                tenantId: e.data?.reporter?.tenantId || '',
                mobile: mobile,
                mpin: '', // No MPIN yet - user will set after payment
                razorpayData: e.data?.razorpay ? JSON.stringify(e.data.razorpay) : '',
                breakdownData: e.data?.breakdown ? JSON.stringify(e.data.breakdown) : '',
                tenantName: tenantData?.name || '',
                tenantNativeName: tenantData?.nativeName || '',
                tenantLogo: tenantData?.logoUrl || '',
                tenantPrimaryColor: tenantData?.primaryColor || '',
                isNewReporter: 'true', // Flag to indicate MPIN change needed after payment
              },
            });
          }
          return;
        }
        if (!cancelled) setError(e?.message || 'Failed to verify number');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mobile, router]);
  
  // Auto-focus logic
  useEffect(() => {
    if (!status || checking) return;
    const t = setTimeout(() => {
      if (status.isRegistered) {
        mpinRefs[0].current?.focus();
      } else {
        fullNameRef.current?.focus();
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, checking]);
  
  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  
  // Success message auto-clear
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);
  
  // Persist auth
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
      const hasSession = !!(session.tenantId || session.domainId || session.tenant || session.domain || session.domainSettings || session.tenantReporter);
      await saveTokens({ jwt, refreshToken, expiresAt, user, languageId, session: hasSession ? session : undefined });
      if (user?.role) await AsyncStorage.setItem('profile_role', user.role);
      await AsyncStorage.setItem('is_authenticated', '1');
      await AsyncStorage.setItem('profile_mobile', mobile);
      await AsyncStorage.setItem('last_login_mobile', mobile);
    } catch (e: any) {
      console.warn('persistAuth failed', e.message);
    }
  }, [mobile]);
  
  // Shake animation
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
  
  // Navigate after auth
  const navigateAfterAuth = useCallback(async () => {
    try {
      // Get user role from stored tokens
      const jwt = await AsyncStorage.getItem('jwt');
      const accessToken = await AsyncStorage.getItem('access_token');
      
      if (accessToken) {
        // Decode access token to get role
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const role = payload?.role;
        
        console.log('[Login] User role:', role);
        
        // Route based on role
        if (role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') {
          router.replace('/tenant/dashboard');
          return;
        } else if (role === 'REPORTER') {
          router.replace('/reporter/dashboard');
          return;
        }
      }
      
      // Default flow for citizen reporters
      if (params.from === 'post') {
        router.replace('/explore');
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/news');
      }
    } catch (error) {
      console.error('[Login] Navigate after auth error:', error);
      // Fallback to default
      router.replace('/news');
    }
  }, [params.from, router]);
  
  // Handle login
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Check if MPIN is insecure (matches last 4 digits of phone)
      const last4 = mobile.slice(-4);
      if (effectiveMpin === last4) {
        // MPIN is insecure - redirect to change MPIN screen
        setSuccess('Login successful! Please change your MPIN for security.');
        setShowCongrats(true);
        setTimeout(() => {
          setShowCongrats(false);
          router.push({
            pathname: '/auth/change-mpin',
            params: {
              mobile: mobile,
              oldMpin: effectiveMpin,
              forceChange: 'true',
              from: params.from || '',
            },
          });
        }, 1500);
        return;
      }
      
      setSuccess('Welcome back!');
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        navigateAfterAuth();
      }, 1800);
    } catch (e: any) {
      // Handle 402 Payment Required - navigate to payment screen
      if (e instanceof PaymentRequiredError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Store credentials temporarily for auto-login after payment
        await AsyncStorage.setItem('pendingPaymentCredentials', JSON.stringify({
          mobile: mobile,
          mpin: mpin,
          timestamp: Date.now(),
        }));
        
        router.push({
          pathname: '/auth/payment',
          params: {
            reporterId: e.data?.reporter?.id || '',
            tenantId: e.data?.reporter?.tenantId || '',
            mobile: mobile,
            mpin: mpin,
            // Pass razorpay data as JSON string
            razorpayData: e.data?.razorpay ? JSON.stringify(e.data.razorpay) : '',
            breakdownData: e.data?.breakdown ? JSON.stringify(e.data.breakdown) : '',
          },
        });
        return;
      }
      
      if (e?.status === 401) {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        setMpinDigits(['', '', '', '']);
        setMpinValue('');
        if (remaining > 0) {
          setError(`తప్పు MPIN. ${remaining} ప్రయత్నాలు మిగిలి ఉన్నాయి.`);
        } else {
          // 5 attempts failed - show reset option, don't navigate away
          setError('5 సార్లు తప్పు. దయచేసి MPIN రీసెట్ చేయండి.');
          setShowReset(true);
          setResetStage('request');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeError();
      } else {
        setError(e?.message || 'Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, mpin, attemptsLeft, persistAuth, shakeError, navigateAfterAuth]);
  
  // Handle registration
  const handleRegister = useCallback(async () => {
    if (submittingRef.current) return;
    if (!/^\d{10}$/.test(mobile) || !fullName.trim() || !/^\d{4}$/.test(mpin)) return;
    
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    
    try {
      setLoadingContext(true);
      let languageId: string | undefined;
      try { const raw = await AsyncStorage.getItem('selectedLanguage'); if (raw) languageId = JSON.parse(raw)?.id; } catch {}
      if (!languageId) languageId = 'en';
      const device = await getDeviceIdentity();
      let pushToken: string | undefined;
      let location: any;
      // Only check existing permissions - don't request during registration (Play Store policy)
      try {
        const { checkPermissionsOnly } = await import('@/services/permissions');
        const perms = await checkPermissionsOnly();
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
      setLoadingContext(false);
      
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess('Account created!');
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        navigateAfterAuth();
      }, 1800);
    } catch (e: any) {
      setError(e?.message || 'Registration failed. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
      setLoadingContext(false);
      submittingRef.current = false;
    }
     
  }, [mobile, fullName, mpin, persistAuth, navigateAfterAuth]);
  
  // MPIN value change handler - single string approach for fast input
  const handleMpinValueChange = useCallback((val: string) => {
    setMpinValue(val);
    setMpinDigits(val.padEnd(4, '').split('').slice(0, 4)); // Keep sync for compatibility
    setError(null);
    
    // Auto submit when 4 digits entered
    if (val.length === 4 && /^\d{4}$/.test(val)) {
      setSubmitting(true);
      Keyboard.dismiss();
      setTimeout(() => {
        if (isExisting) {
          handleLogin(val);
        } else if (isNew && fullName.trim()) {
          handleRegister();
        } else {
          setSubmitting(false);
        }
      }, 50);
    }
  }, [isExisting, isNew, fullName, handleLogin, handleRegister]);

  // Legacy handlers for compatibility - not used in new approach
  const handleMpinChange = useCallback((idx: number, val: string) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...mpinDigits];
    next[idx] = c;
    setMpinDigits(next);
    setMpinValue(next.join(''));
    setError(null);
  }, [mpinDigits]);
  
  const handleMpinKeyPress = useCallback((idx: number, key: string) => {
    // Not needed in new approach
  }, []);

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
  
  // Reset MPIN handlers
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
      setSuccess('MPIN updated!');
      setTimeout(() => mpinRefs[0].current?.focus(), 150);
    } catch (e: any) {
      setResetError(e?.message || 'Failed to set MPIN');
    } finally {
      setResetLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNew, resetConfirm, resetCorrelationId, mobile, resetLoading]);
  
  // Generic digit handler
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
  
  const handleDigitKeyPress = useCallback((arr: string[], idx: number, key: string, refs: React.RefObject<TextInput | null>[]) => {
    if (key === 'Backspace' && !arr[idx] && idx > 0) {
      setTimeout(() => refs[idx - 1].current?.focus(), 30);
    }
  }, []);
  
  // Close reset modal
  const closeReset = useCallback(() => {
    setShowReset(false);
    setResetStage('request');
    setResetCorrelationId(null);
    setOtpDigits(['', '', '', '']);
    setResetNew(['', '', '', '']);
    setResetConfirm(['', '', '', '']);
    setResetError(null);
    setCooldown(0);
  }, []);
  
  // Glow style
  const glowStyle = useMemo(() => ({
    shadowColor: SECONDARY,
    shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }),
    shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 25] }),
  }), [glowAnim]);
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <AnimatedBackground isDark={isDark} />
      
      {/* Header */}
      <PremiumHeader onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} isDark={isDark} />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + keyboardHeight }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Card */}
          <Animated.View style={[styles.card, { backgroundColor: cardBg, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Glow effect */}
            <Animated.View style={[styles.cardGlow, glowStyle as any]} />
            
            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={[styles.welcomeTitle, { color: textColor }]}>
                {isExisting ? 'Welcome Back!' : isNew ? 'Create Account' : 'Sign In'}
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: mutedColor }]}>
                {isExisting 
                  ? 'Enter your MPIN to continue' 
                  : isNew 
                    ? 'Set up your account in seconds'
                    : 'Enter your mobile number to get started'}
              </Text>
            </View>
            
            {/* Step Progress */}
            {status && <StepProgress step={isExisting ? 1 : (fullName && mpin.length === 4) ? 2 : fullName ? 1 : 0} total={2} />}
            
            {/* Mobile Input */}
            {(!status || isNew) && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: textColor }]}>Mobile Number</Text>
                <View style={[styles.mobileRow, { backgroundColor: inputBg, borderColor }]}>
                  <View style={styles.countryCode}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={[styles.countryText, { color: PRIMARY }]}>+91</Text>
                  </View>
                  <TextInput
                    ref={mobileRef}
                    value={mobile}
                    onChangeText={(t) => {
                      const clean = t.replace(/\D/g, '').slice(0, 10);
                      setMobile(clean);
                      setStatus(null);
                      setMpinDigits(['', '', '', '']);
                      setMpinValue('');
                      setAttemptsLeft(3);
                      setError(null);
                      
                      // Auto-focus MPIN after 10 digits entered
                      if (clean.length === 10) {
                        setTimeout(() => {
                          mpinInputRef.current?.focus();
                        }, 500);
                      }
                    }}
                    placeholder="10-digit number"
                    placeholderTextColor={mutedColor}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoFocus={!params.mobile}
                    style={[styles.mobileInput, { color: textColor }]}
                  />
                  {checking && <ActivityIndicator size="small" color={SECONDARY} style={{ marginRight: 8 }} />}
                  {mobile.length === 10 && !checking && status && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    </View>
                  )}
                </View>
              </View>
            )}
            
            {/* Existing User - MPIN */}
            {isExisting && (
              <View style={styles.section}>
                {/* Masked Mobile */}
                <View style={[styles.maskedMobile, { backgroundColor: inputBg, borderColor }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color={SECONDARY} />
                  <Text style={[styles.maskedText, { color: textColor }]}>
                    +91 {mobile.replace(/^(\d{3})\d{4}(\d{3})$/, '$1 •••• $2')}
                  </Text>
                  <TouchableOpacity onPress={() => { setStatus(null); setMpinDigits(['', '', '', '']); setMpinValue(''); setAttemptsLeft(3); }}>
                    <Text style={[styles.changeText, { color: SECONDARY }]}>Change</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.inputLabel, { color: textColor, marginTop: 24 }]}>Enter MPIN</Text>
                <MpinInput
                  ref={mpinInputRef}
                  digits={mpinDigits}
                  onChange={handleMpinChange}
                  onKeyPress={handleMpinKeyPress}
                  refs={mpinRefs}
                  shake={mpinShake}
                  error={!!error}
                  isDark={isDark}
                  value={mpinValue}
                  onValueChange={handleMpinValueChange}
                />
                
                <TouchableOpacity onPress={openReset} style={styles.forgotBtn}>
                  <Text style={[styles.forgotText, { color: SECONDARY }]}>Forgot MPIN?</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.primaryBtn, (mpin.length !== 4 || submitting || attemptsLeft <= 0) && styles.btnDisabled]}
                  onPress={() => handleLogin()}
                  disabled={mpin.length !== 4 || submitting || attemptsLeft <= 0}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={attemptsLeft <= 0 ? ['#6B7280', '#4B5563'] : [PRIMARY, '#1e40af']}
                    style={styles.btnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>
                          {attemptsLeft <= 0 ? 'Account Locked' : 'Continue'}
                        </Text>
                        {attemptsLeft > 0 && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {/* New User - Registration */}
            {isNew && (
              <View style={styles.section}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: textColor }]}>Your Name</Text>
                  <View style={[styles.textInputRow, { backgroundColor: inputBg, borderColor }]}>
                    <Ionicons name="person-outline" size={18} color={mutedColor} style={{ marginRight: 12 }} />
                    <TextInput
                      ref={fullNameRef}
                      value={fullName}
                      onChangeText={(t) => setFullName(t.replace(/[^a-zA-Z\s.-]/g, '').slice(0, 50))}
                      placeholder="Enter your full name"
                      placeholderTextColor={mutedColor}
                      style={[styles.textInput, { color: textColor }]}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: textColor }]}>Create MPIN</Text>
                  <MpinInput
                    ref={mpinInputRef}
                    digits={mpinDigits}
                    onChange={handleMpinChange}
                    onKeyPress={handleMpinKeyPress}
                    refs={mpinRefs}
                    isDark={isDark}
                    value={mpinValue}
                    onValueChange={handleMpinValueChange}
                  />
                  <Text style={[styles.hint, { color: mutedColor }]}>
                    This 4-digit PIN will be your secure login key
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.primaryBtn, (!fullName.trim() || mpin.length !== 4 || submitting) && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={!fullName.trim() || mpin.length !== 4 || submitting}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[SECONDARY, '#ea580c']}
                    style={styles.btnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {(submitting || loadingContext) ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Error/Success Messages */}
            {error && (
              <View style={[styles.messageBox, styles.errorBox]}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={[styles.messageBox, styles.successBox]}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successText}>{success}</Text>
              </View>
            )}
          </Animated.View>
          
          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: mutedColor }]}>
              By continuing, you agree to our{' '}
              <Text style={{ color: PRIMARY, fontWeight: '600' }} onPress={() => router.push('/terms-and-conditions')}>Terms</Text>
              {' & '}
              <Text style={{ color: PRIMARY, fontWeight: '600' }} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>
            </Text>
            <View style={styles.securityBadge}>
              <MaterialCommunityIcons name="shield-check" size={14} color={mutedColor} />
              <Text style={[styles.securityText, { color: mutedColor }]}>Secured with encryption</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Forgot MPIN Modal */}
      <Modal visible={showReset} transparent animationType="fade" onRequestClose={closeReset}>
        <BlurView intensity={isDark ? 40 : 20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
          <Pressable style={styles.resetBackdrop} onPress={closeReset}>
            <Pressable style={[styles.resetCard, { backgroundColor: isDark ? '#1e293b' : '#fff' }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.resetHandle} />
              
              <View style={styles.resetHeader}>
                <Text style={[styles.resetTitle, { color: textColor }]}>
                  {resetStage === 'request' ? '🔐 Reset MPIN' : resetStage === 'verify' ? '📱 Verify OTP' : '🔑 New MPIN'}
                </Text>
                <TouchableOpacity onPress={closeReset} style={[styles.closeBtn, { backgroundColor: inputBg }]}>
                  <Ionicons name="close" size={20} color={mutedColor} />
                </TouchableOpacity>
              </View>
              
              {resetStage === 'request' && (
                <View style={styles.resetContent}>
                  <Text style={[styles.resetSubtitle, { color: mutedColor }]}>We&apos;ll send a verification code to</Text>
                  <Text style={[styles.resetMobile, { color: PRIMARY }]}>+91 {mobile}</Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, resetLoading && styles.btnDisabled]}
                    onPress={requestOtp}
                    disabled={resetLoading}
                  >
                    <LinearGradient colors={[PRIMARY, '#1e40af']} style={styles.btnGradient}>
                      {resetLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
              
              {resetStage === 'verify' && (
                <View style={styles.resetContent}>
                  <Text style={[styles.resetSubtitle, { color: mutedColor }]}>Enter the 4-digit code sent to your phone</Text>
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
                        style={[styles.otpBox, { backgroundColor: inputBg, borderColor, color: textColor }, otpDigits[i] && styles.otpBoxFilled]}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.resetBtn, (resetLoading || otpDigits.join('').length !== 4) && styles.btnDisabled]}
                    onPress={verifyOtp}
                    disabled={resetLoading || otpDigits.join('').length !== 4}
                  >
                    <LinearGradient colors={[PRIMARY, '#1e40af']} style={styles.btnGradient}>
                      {resetLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={requestOtp} disabled={cooldown > 0 || resetLoading} style={styles.resendBtn}>
                    <Text style={[styles.resendText, { color: cooldown > 0 ? mutedColor : SECONDARY }]}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {resetStage === 'set' && (
                <View style={styles.resetContent}>
                  <Text style={[styles.resetSubtitle, { color: mutedColor }]}>Create your new MPIN</Text>
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
                        style={[styles.otpBox, { backgroundColor: inputBg, borderColor, color: textColor }, resetNew[i] && styles.otpBoxFilled]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.resetSubtitle, { color: mutedColor, marginTop: 16 }]}>Confirm MPIN</Text>
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
                        style={[styles.otpBox, { backgroundColor: inputBg, borderColor, color: textColor }, resetConfirm[i] && styles.otpBoxFilled]}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.resetBtn, (resetLoading || resetNew.join('') !== resetConfirm.join('') || resetNew.join('').length !== 4) && styles.btnDisabled]}
                    onPress={submitNewMpin}
                    disabled={resetLoading || resetNew.join('') !== resetConfirm.join('') || resetNew.join('').length !== 4}
                  >
                    <LinearGradient colors={[SECONDARY, '#ea580c']} style={styles.btnGradient}>
                      {resetLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Save MPIN</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
              
              {resetError && (
                <View style={[styles.messageBox, styles.errorBox, { marginTop: 12 }]}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{resetError}</Text>
                </View>
              )}
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>
      
      {/* Success Celebration */}
      {showCongrats && (
        <View style={styles.congratsOverlay} pointerEvents="none">
          <LottieView
            source={require('@/assets/lotti/congratulation.json')}
            autoPlay
            loop={false}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.congratsText}>{success || 'Success!'}</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 300,
    height: 300,
    backgroundColor: SECONDARY,
    top: -100,
    right: -100,
    opacity: 0.3,
  },
  orb2: {
    width: 200,
    height: 200,
    backgroundColor: PRIMARY,
    bottom: 100,
    left: -50,
    opacity: 0.2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  card: {
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: SECONDARY,
  },
  stepDotDone: {
    backgroundColor: '#10B981',
  },
  stepDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineDone: {
    backgroundColor: '#10B981',
  },
  section: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  countryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  mobileInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  verifiedBadge: {
    paddingRight: 14,
  },
  maskedMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  maskedText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mpinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
    position: 'relative',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  mpinContainer: {
    width: 60,
  },
  mpinInput: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
  },
  mpinInputFilled: {
    // Additional styling when filled
  },
  mpinUnderline: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  mpinUnderlineActive: {
    backgroundColor: SECONDARY,
  },
  mpinError: {
    // Error styling
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 16,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
  },
  successBox: {
    backgroundColor: '#ECFDF5',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
    flex: 1,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  securityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Reset Modal
  resetBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resetCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 24,
  },
  resetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  resetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  resetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetContent: {
    alignItems: 'center',
  },
  resetSubtitle: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  resetMobile: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  resetBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  resendBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: SECONDARY,
    backgroundColor: 'rgba(250,124,5,0.08)',
  },
  congratsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  congratsText: {
    fontSize: 26,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: -20,
  },
  // Payment Modal
  paymentBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paymentCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentAmountBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 36,
    fontWeight: '800',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  paymentCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  paymentPayBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paymentPayText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  paymentSecure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  paymentSecureText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
