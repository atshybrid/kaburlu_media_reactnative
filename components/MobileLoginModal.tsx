import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createCitizenReporterMobile, getMpinStatus, loginWithMpin, PaymentRequiredError } from '../services/api';
import { gatherRegistrationContext } from '../services/contextGather';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (data: { jwt: string; refreshToken: string; user?: any }) => void;
}

// States: idle (typing mobile), mpin (existing user w/ mpin), register (needs creation)
type Status = 'idle' | 'mpin' | 'register';

export const MobileLoginModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const lookedUpRef = useRef<string | null>(null);
  // React Native setTimeout returns NodeJS.Timeout; use appropriate type
  const lookupTimer = useRef<NodeJS.Timeout | null>(null);
  // Input refs and focus guards
  const mobileRef = useRef<TextInput>(null);
  const mpinRef = useRef<TextInput>(null);
  const confirmMpinRef = useRef<TextInput>(null);
  const fullNameRef = useRef<TextInput>(null);
  const mpinAutofocusedRef = useRef<boolean>(false);
  const didAutoBlurMpinRef = useRef<boolean>(false);
  const didAutoBlurConfirmMpinRef = useRef<boolean>(false);
  const didAutoFocusConfirmMpinRef = useRef<boolean>(false);
  const [mpinFocused, setMpinFocused] = useState(false);
  const [confirmMpinFocused, setConfirmMpinFocused] = useState(false);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Blinking cursor animation for MPIN - always blink when on MPIN screen
  useEffect(() => {
    if (status === 'mpin' && mpin.length < 4) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      blink.start();
      return () => blink.stop();
    }
  }, [status, mpin.length, blinkAnim]);

  const reset = () => {
    setMobile(''); setMpin(''); setConfirmMpin(''); setFullName(''); setStatus('idle'); setError(null); setRoleName(null); setIsRegistered(null); lookedUpRef.current = null;
    mpinAutofocusedRef.current = false;
    didAutoBlurMpinRef.current = false;
    didAutoBlurConfirmMpinRef.current = false;
    didAutoFocusConfirmMpinRef.current = false;
    setMpinFocused(false);
    setConfirmMpinFocused(false);
  };

  // Debounced auto lookup when 10 digits entered OR when user presses Continue
  const triggerLookup = (force = false) => {
    console.log('[MOBILE_LOGIN] triggerLookup called', { mobile, force, length: mobile.length, alreadyLookedUp: lookedUpRef.current });
    
    if (lookupTimer.current) { 
      console.log('[MOBILE_LOGIN] Clearing existing timer');
      clearTimeout(lookupTimer.current); 
      lookupTimer.current = null; 
    }
    
    if (mobile.length !== 10) {
      console.log('[MOBILE_LOGIN] Mobile length not 10, skipping lookup');
      return;
    }
    
    if (!force && lookedUpRef.current === mobile) {
      console.log('[MOBILE_LOGIN] Already looked up this number, skipping');
      return; // already looked
    }
    
    console.log('[MOBILE_LOGIN] Setting timer for lookup', { delay: force ? 0 : 350 });
    lookupTimer.current = setTimeout(async () => {
      console.log('[MOBILE_LOGIN] Timer fired, starting API call');
      setError(null);
      setLoading(true);
      
      try {
        console.log('[MOBILE_LOGIN] Calling getMpinStatus API', { mobile });
        const res: any = await getMpinStatus(mobile);
        console.log('[MOBILE_LOGIN] getMpinStatus response', res);
        
        const registered = res.isRegistered !== undefined ? res.isRegistered : !!res.mpinStatus || !!res.roleName;
        console.log('[MOBILE_LOGIN] Determined registration status', { 
          registered, 
          isRegistered: res.isRegistered, 
          mpinStatus: res.mpinStatus, 
          roleName: res.roleName 
        });
        
        setIsRegistered(registered);
        setRoleName(res.roleName || null);
        
        if (registered && res.mpinStatus) {
          console.log('[MOBILE_LOGIN] Setting status to mpin');
          setStatus('mpin');
        } else {
          console.log('[MOBILE_LOGIN] Setting status to register');
          setStatus('register');
        }
        
        lookedUpRef.current = mobile;
        console.log('[MOBILE_LOGIN] Lookup completed successfully');
        
      } catch (e: any) {
        console.error('[MOBILE_LOGIN] Lookup failed', e);
        console.log('[MOBILE_LOGIN] Full error object', { 
          message: e?.message, 
          status: e?.status, 
          body: e?.body,
          stack: e?.stack 
        });
        setError(e?.message || 'Lookup failed');
        setStatus('idle');
      } finally { 
        console.log('[MOBILE_LOGIN] Setting loading to false');
        setLoading(false); 
      }
    }, force ? 0 : 350); // small debounce
  };

  // Auto lookup when 10 digits entered
  useEffect(() => {
    console.log('[MOBILE_LOGIN] useEffect triggered', { mobile, length: mobile.length });
    
    if (mobile.length === 10) {
      console.log('[MOBILE_LOGIN] Mobile is 10 digits, triggering lookup');
      triggerLookup(false);
    } else {
      console.log('[MOBILE_LOGIN] Mobile not 10 digits, resetting state');
      setStatus('idle'); 
      setIsRegistered(null); 
      setRoleName(null); 
      lookedUpRef.current = null;
    }
    // triggerLookup intentionally not added to deps to avoid recreating timers on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  // Manage initial focus when switching to sections, but avoid re-opening after auto-blur
  useEffect(() => {
    if (!visible) return;
    if (status === 'mpin') {
      // Focus MPIN immediately when status becomes mpin (after 10 digit lookup)
      if (!mpinAutofocusedRef.current) {
        mpinAutofocusedRef.current = true;
        // Small delay to ensure TextInput is mounted and ready
        setTimeout(() => {
          mpinRef.current?.focus();
        }, 200);
      }
    } else if (status === 'register') {
      // Focus full name first time
      if (!fullName && !loading) {
        setTimeout(() => fullNameRef.current?.focus(), 150);
      }
    }
  }, [status, visible, fullName, loading]);

  // When MPIN reaches 4 digits in login mode, blur and dismiss keyboard
  useEffect(() => {
    if (status === 'mpin' && mpin.length >= 4 && !didAutoBlurMpinRef.current) {
      didAutoBlurMpinRef.current = true;
      mpinRef.current?.blur();
      Keyboard.dismiss();
    }
    if (mpin.length < 4) {
      // Allow another auto-blur after corrections
      didAutoBlurMpinRef.current = false;
    }
  }, [mpin, status]);

  // When MPIN reaches 4 digits in register mode, auto-focus Confirm MPIN
  useEffect(() => {
    if (status === 'register' && mpin.length >= 4 && !didAutoFocusConfirmMpinRef.current) {
      didAutoFocusConfirmMpinRef.current = true;
      setTimeout(() => {
        confirmMpinRef.current?.focus();
      }, 100);
    }
    if (mpin.length < 4) {
      didAutoFocusConfirmMpinRef.current = false;
    }
  }, [mpin, status]);

  // When Confirm MPIN reaches 4 digits in register mode, blur and dismiss keyboard
  useEffect(() => {
    if (status === 'register' && confirmMpin.length >= 4 && !didAutoBlurConfirmMpinRef.current) {
      didAutoBlurConfirmMpinRef.current = true;
      confirmMpinRef.current?.blur();
      Keyboard.dismiss();
    }
    if (confirmMpin.length < 4) {
      didAutoBlurConfirmMpinRef.current = false;
    }
  }, [confirmMpin, status]);

  const doLogin = async () => {
    console.log('[MOBILE_LOGIN] doLogin called', { mobile, mpinLength: mpin.length, loading });
    
    if (loading) {
      console.log('[MOBILE_LOGIN] Already loading, preventing double tap');
      return; // prevent double tap
    }
    
    setError(null);
    // Close keyboard for clearer progress feedback
    Keyboard.dismiss();
    
    if (!/^\d{4}$/.test(mpin)) { 
      console.log('[MOBILE_LOGIN] Invalid MPIN format');
      setError('Enter 4 digit MPIN'); 
      return; 
    }
    
    console.log('[MOBILE_LOGIN] Starting login process');
    setLoading(true);
    
    try {
      console.log('[MOBILE_LOGIN] Calling loginWithMpin API');
      const data = await loginWithMpin({ mobileNumber: mobile, mpin });
      console.log('[MOBILE_LOGIN] Login successful', { hasJwt: !!data.jwt, hasUser: !!data.user });
      
      await AsyncStorage.setItem('jwt', data.jwt);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      if (data.user?.languageId) await AsyncStorage.setItem('languageId', data.user.languageId);
      
      console.log('[MOBILE_LOGIN] Calling onSuccess callback');
      onSuccess({ jwt: data.jwt, refreshToken: data.refreshToken, user: data.user });
      reset();
    } catch (e: any) {
      console.error('[MOBILE_LOGIN] Login failed', e);
      
      // Handle 402 Payment Required - navigate to payment screen
      if (e instanceof PaymentRequiredError) {
        console.log('[MOBILE_LOGIN] Payment required, navigating to payment screen');
        onClose(); // Close modal
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
      
      setError(e?.message || 'Login failed');
    } finally { 
      console.log('[MOBILE_LOGIN] Login process finished');
      setLoading(false); 
    }
  };

  const doRegister = async () => {
    console.log('[MOBILE_LOGIN] doRegister called', { mobile, fullName: fullName.trim(), mpinLength: mpin.length, loading });
    
    if (loading) {
      console.log('[MOBILE_LOGIN] Already loading, preventing double submission');
      return;
    }
    
    setError(null);
  Keyboard.dismiss();
    
    if (!fullName.trim()) { 
      console.log('[MOBILE_LOGIN] Full name missing');
      setError('Enter full name'); 
      return; 
    }
    
    if (!/^\d{4}$/.test(mpin)) { 
      console.log('[MOBILE_LOGIN] Invalid MPIN format');
      setError('Set a 4 digit MPIN'); 
      return; 
    }

    if (mpin !== confirmMpin) {
      console.log('[MOBILE_LOGIN] MPIN mismatch');
      setError('MPIN and Confirm MPIN do not match');
      return;
    }
    
    console.log('[MOBILE_LOGIN] Starting registration process');
    setLoading(true);
    
    try {
      console.log('[MOBILE_LOGIN] Gathering registration context');
      const ctx = await gatherRegistrationContext();
      console.log('[MOBILE_LOGIN] Registration context', { hasLanguageId: !!ctx.languageId, hasLocation: !!ctx.location, hasPushToken: !!ctx.pushToken });
      
      if (!ctx.languageId) {
        console.log('[MOBILE_LOGIN] No languageId in context, trying AsyncStorage fallback');
        // fallback read selectedLanguage object
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) { 
          try { 
            ctx.languageId = JSON.parse(raw)?.id; 
            console.log('[MOBILE_LOGIN] Found languageId in AsyncStorage', ctx.languageId);
          } catch (e) {
            console.log('[MOBILE_LOGIN] Failed to parse selectedLanguage from AsyncStorage', e);
          }
        }
      }
      
      if (!ctx.languageId) {
        console.error('[MOBILE_LOGIN] No language ID available');
        throw new Error('Language not set');
      }
      
      const pseudoDeviceId = `dev_${Platform.OS}_${Math.random().toString(36).slice(2,10)}`;
      console.log('[MOBILE_LOGIN] Generated device ID', pseudoDeviceId);
      
      console.log('[MOBILE_LOGIN] Calling createCitizenReporterMobile API');
      const data = await createCitizenReporterMobile({
        mobileNumber: mobile,
        mpin,
        fullName: fullName.trim(),
        deviceId: pseudoDeviceId,
        pushToken: ctx.pushToken,
        languageId: ctx.languageId,
        location: ctx.location,
      });
      console.log('[MOBILE_LOGIN] Registration successful', { hasJwt: !!data.jwt, hasUser: !!data.user });
      
      await AsyncStorage.setItem('jwt', data.jwt);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      if (data.user?.languageId) await AsyncStorage.setItem('languageId', data.user.languageId);
      
      console.log('[MOBILE_LOGIN] Calling onSuccess callback');
      onSuccess({ jwt: data.jwt, refreshToken: data.refreshToken, user: data.user });
      reset();
    } catch (e: any) {
      console.error('[MOBILE_LOGIN] Registration failed', e);
      console.log('[MOBILE_LOGIN] Full registration error', { 
        message: e?.message, 
        status: e?.status, 
        body: e?.body 
      });
      setError(e?.message || 'Registration failed');
    } finally { 
      console.log('[MOBILE_LOGIN] Registration process finished');
      setLoading(false); 
    }
  };
  const renderBody = () => {
    return (
      <>
        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          value={mobile}
          ref={mobileRef}
          onChangeText={(t) => {
            const cleaned = t.replace(/\D/g, '');
            console.log('[MOBILE_LOGIN] Mobile input changed', { original: t, cleaned, length: cleaned.length });
            setMobile(cleaned);
          }}
          placeholder="Enter 10 digit mobile"
          editable={!loading}
        />
        {mobile.length === 10 && status === 'idle' && !loading && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => triggerLookup(true)}>
            <Text style={styles.secondaryText}>Continue</Text>
          </TouchableOpacity>
        )}
        {loading && mobile.length === 10 && (
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" />
            <Text style={{ fontSize: 12, color: '#475569' }}>Checking…</Text>
          </View>
        )}
        {status !== 'idle' && (
          <>
            <View style={styles.mobileRow}>
              <Text style={styles.mobileHeading}>{mobile}</Text>
              <TouchableOpacity 
                style={styles.changeBtn} 
                onPress={() => {
                  // Clear phone number and reset to idle state
                  setMobile('');
                  setMpin('');
                  setFullName('');
                  setStatus('idle');
                  setError(null);
                  setRoleName(null);
                  setIsRegistered(null);
                  lookedUpRef.current = null;
                  mpinAutofocusedRef.current = false;
                  didAutoBlurMpinRef.current = false;
                  // Focus mobile input after reset
                  setTimeout(() => mobileRef.current?.focus(), 150);
                }}
              >
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
            {roleName && status === 'mpin' && <Text style={styles.roleTag}>{roleName}</Text>}
          </>
        )}
        {status === 'mpin' && (
          <>
            {/* Prominent instruction banner */}
            <View style={styles.mpinBanner}>
              <Text style={styles.mpinBannerIcon}>🔐</Text>
              <View style={styles.mpinBannerTextWrap}>
                <Text style={styles.mpinBannerTitle}>Enter your 4-digit MPIN</Text>
                <Text style={styles.mpinBannerSubtitle}>Type your secret PIN to login</Text>
              </View>
            </View>
            {/* Custom MPIN boxes with blinking cursor */}
            <TouchableOpacity 
              style={styles.mpinBoxesContainer} 
              activeOpacity={0.9}
              onPress={() => mpinRef.current?.focus()}
            >
              {[0, 1, 2, 3].map((i) => (
                <View 
                  key={i} 
                  style={[
                    styles.mpinBox,
                    mpin.length === i && styles.mpinBoxActive,
                    mpin.length > i && styles.mpinBoxFilled,
                  ]}
                >
                  {mpin.length > i ? (
                    <Text style={styles.mpinDot}>●</Text>
                  ) : mpin.length === i ? (
                    <Animated.View style={[styles.blinkingCursor, { opacity: blinkAnim }]} />
                  ) : (
                    <Text style={styles.mpinUnderscore}>_</Text>
                  )}
                </View>
              ))}
            </TouchableOpacity>
            {/* Hidden actual input */}
            <TextInput
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={4}
              value={mpin}
              onChangeText={setMpin}
              ref={mpinRef}
              editable={!loading}
              blurOnSubmit
              onSubmitEditing={doLogin}
              onFocus={() => setMpinFocused(true)}
              onBlur={() => setMpinFocused(false)}
              autoFocus={false}
              caretHidden
            />
            <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} onPress={doLogin} disabled={loading}>
              {loading ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryText}>Logging in…</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Login</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        {status === 'register' && (
          <>
            {!isRegistered && <Text style={styles.subtle}>New user • Create account</Text>}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              ref={fullNameRef}
              editable={!loading}
            />
            <Text style={styles.label}>Set MPIN</Text>
            <TextInput
              style={[styles.input, mpinFocused && styles.inputFocused]}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={mpin}
              onChangeText={setMpin}
              placeholder="4 digit MPIN"
              ref={mpinRef}
              editable={!loading}
              onFocus={() => setMpinFocused(true)}
              onBlur={() => setMpinFocused(false)}
            />
            <Text style={styles.label}>Confirm MPIN</Text>
            <TextInput
              style={[styles.input, confirmMpinFocused && styles.inputFocused]}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={confirmMpin}
              onChangeText={setConfirmMpin}
              placeholder="Re-enter MPIN"
              ref={confirmMpinRef}
              editable={!loading}
              onFocus={() => setConfirmMpinFocused(true)}
              onBlur={() => setConfirmMpinFocused(false)}
            />
            <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} onPress={doRegister} disabled={loading}>
              {loading ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryText}>Creating…</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Create & Login</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Citizen Reporter</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  close: { fontSize: 18 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: '500', fontSize: 13, color: '#333' },
  input: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 15, textAlign: 'left', borderWidth: 2, borderColor: 'transparent' },
  inputFocused: { borderColor: '#f97316', backgroundColor: '#fffbeb' },
  labelFocused: { color: '#f97316', fontWeight: '700', fontSize: 14 },
  mpinLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 },
  mpinHint: { fontSize: 11, color: '#f97316', fontWeight: '500' },
  // Prominent MPIN banner styles
  mpinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#f97316',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 12,
  },
  mpinBannerIcon: { fontSize: 28 },
  mpinBannerTextWrap: { flex: 1 },
  mpinBannerTitle: { fontSize: 16, fontWeight: '700', color: '#c2410c' },
  mpinBannerSubtitle: { fontSize: 12, color: '#ea580c', marginTop: 2 },
  // MPIN boxes with blinking cursor
  mpinBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 8,
  },
  mpinBox: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mpinBoxActive: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
    borderWidth: 3,
  },
  mpinBoxFilled: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  mpinDot: {
    fontSize: 28,
    color: '#1f2937',
  },
  mpinUnderscore: {
    fontSize: 24,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  blinkingCursor: {
    width: 3,
    height: 32,
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  primaryBtn: { backgroundColor: '#2563eb', paddingVertical: 12, alignItems: 'center', borderRadius: 8, marginTop: 20 },
  primaryBtnDisabled: { opacity: 0.8 },
  primaryText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626', marginTop: 8 },
  mobileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  mobileHeading: { fontSize: 16, fontWeight: '600' },
  changeBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  changeText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  roleTag: { backgroundColor: '#e0f2fe', color: '#075985', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start', fontSize: 12 },
  subtle: { color: '#6b7280', marginTop: 4, fontSize: 12 },
  secondaryBtn: { backgroundColor: '#e2e8f0', paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginTop: 12 },
  secondaryText: { color: '#1e293b', fontWeight: '600' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

export default MobileLoginModal;
