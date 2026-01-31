import { useThemeColor } from '@/hooks/useThemeColor';
import { AppLockMode, getLockMode, promptBiometric, setMpin as saveMpin, verifyMpin } from '@/services/appLock';
import { requestOtpForMpinReset, verifyOtpForMpinReset, setNewMpin } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = { visibleOverride?: boolean };

type ResetStep = 'none' | 'otp' | 'new-mpin' | 'confirm-mpin';

export default function AppLockGate(_props: Props) {
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const primary = useThemeColor({}, 'tint');
  const errorColor = '#e53935';

  const [mode, setMode] = useState<AppLockMode>('off');
  const [visible, setVisible] = useState(false);
  const [mpin, setMpin] = useState('');
  const [tries, setTries] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset flow states
  const [resetStep, setResetStep] = useState<ResetStep>('none');
  const [otpId, setOtpId] = useState(''); // correlation id from request-otp
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newMpinValue, setNewMpinValue] = useState('');
  const [confirmMpinValue, setConfirmMpinValue] = useState('');

  const gateCheck = async () => {
    const m = await getLockMode();
    setMode(m);
    if (m === 'off') {
      setVisible(false);
      return;
    }
    // Try biometric first for biometric/both
    if (m === 'biometric' || m === 'both') {
      const ok = await promptBiometric('Unlock Kaburlu');
      if (ok) { setVisible(false); return; }
      if (m === 'biometric') { setVisible(true); return; } // stay visible, show message
    }
    // Fallback to MPIN for mpin/both
    if (m === 'mpin' || m === 'both') {
      setVisible(true);
      return;
    }
    setVisible(false);
  };

  useEffect(() => {
    // initial
    gateCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') gateCheck();
    });
    return () => { try { sub.remove(); } catch {} };
  }, []);

  // Load stored mobile on mount
  useEffect(() => {
    (async () => {
      const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
      setMobileNumber(mobile);
    })();
  }, []);

  const resetState = () => {
    setMpin('');
    setError('');
    setResetStep('none');
    setOtp('');
    setNewMpinValue('');
    setConfirmMpinValue('');
    setOtpId('');
  };

  const onSubmitMpin = async () => {
    if (!mpin.trim()) {
      setError('MPIN ఇవ్వండి');
      return;
    }
    setError('');
    const ok = await verifyMpin(mpin);
    if (ok) {
      setVisible(false);
      setMpin('');
      setTries(0);
      setError('');
    } else {
      const newTries = tries + 1;
      setTries(newTries);
      setMpin('');
      if (newTries >= 5) {
        setError('5 సార్లు తప్పు. దయచేసి MPIN రీసెట్ చేయండి.');
      } else {
        setError(`తప్పు MPIN. ${5 - newTries} ప్రయత్నాలు మిగిలి ఉన్నాయి.`);
      }
    }
  };

  const onStartReset = async () => {
    if (!mobileNumber) {
      Alert.alert('Error', 'మొబైల్ నంబర్ కనుగొనబడలేదు. దయచేసి మళ్ళీ లాగిన్ అవ్వండి.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await requestOtpForMpinReset(mobileNumber);
      if (res.success && res.id) {
        setOtpId(res.id);
        setResetStep('otp');
      } else {
        setError('OTP పంపడం విఫలమైంది. మళ్ళీ ప్రయత్నించండి.');
      }
    } catch (e: any) {
      setError(e?.message || 'OTP పంపడం విఫలమైంది.');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) {
      setError('సరైన OTP ఇవ్వండి');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtpForMpinReset({ id: otpId, otp: otp.trim() });
      if (res.success) {
        setResetStep('new-mpin');
        setOtp('');
      } else {
        setError('తప్పు OTP. మళ్ళీ ప్రయత్నించండి.');
      }
    } catch (e: any) {
      setError(e?.message || 'OTP వెరిఫికేషన్ విఫలమైంది.');
    } finally {
      setLoading(false);
    }
  };

  const onSetNewMpin = async () => {
    if (!newMpinValue || !/^\d{4,6}$/.test(newMpinValue)) {
      setError('MPIN 4-6 అంకెలు ఉండాలి');
      return;
    }
    setError('');
    setResetStep('confirm-mpin');
  };

  const onConfirmNewMpin = async () => {
    if (confirmMpinValue !== newMpinValue) {
      setError('MPIN లు సరిపోలలేదు. మళ్ళీ ప్రయత్నించండి.');
      setConfirmMpinValue('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Save to backend
      const res = await setNewMpin({ id: otpId, mobileNumber, mpin: newMpinValue });
      if (res.success) {
        // Also save locally
        await saveMpin(newMpinValue);
        Alert.alert('విజయం', 'MPIN విజయవంతంగా రీసెట్ అయింది!');
        resetState();
        setTries(0);
        // Unlock after successful reset
        setVisible(false);
      } else {
        setError('MPIN సేవ్ విఫలమైంది.');
      }
    } catch (e: any) {
      setError(e?.message || 'MPIN సేవ్ విఫలమైంది.');
    } finally {
      setLoading(false);
    }
  };

  const renderResetFlow = () => {
    if (resetStep === 'otp') {
      return (
        <>
          <Text style={[styles.subtitle, { color: muted }]}>
            {mobileNumber ? `${mobileNumber.slice(0, 2)}****${mobileNumber.slice(-2)}` : ''} కు OTP పంపబడింది
          </Text>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="OTP ఇవ్వండి"
            placeholderTextColor={muted}
            keyboardType="number-pad"
            onSubmitEditing={onVerifyOtp}
            style={[styles.input, { borderColor: border, color: text }]}
            maxLength={6}
            autoFocus
          />
          {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
          <Pressable
            style={[styles.button, { backgroundColor: primary }]}
            onPress={onVerifyOtp}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>వెరిఫై</Text>}
          </Pressable>
          <Pressable onPress={resetState} style={styles.link}>
            <Text style={[styles.linkText, { color: muted }]}>రద్దు</Text>
          </Pressable>
        </>
      );
    }

    if (resetStep === 'new-mpin') {
      return (
        <>
          <Text style={[styles.subtitle, { color: muted }]}>కొత్త MPIN (4-6 అంకెలు) ఇవ్వండి</Text>
          <TextInput
            value={newMpinValue}
            onChangeText={setNewMpinValue}
            placeholder="కొత్త MPIN"
            placeholderTextColor={muted}
            keyboardType="number-pad"
            secureTextEntry
            onSubmitEditing={onSetNewMpin}
            style={[styles.input, { borderColor: border, color: text }]}
            maxLength={6}
            autoFocus
          />
          {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
          <Pressable
            style={[styles.button, { backgroundColor: primary }]}
            onPress={onSetNewMpin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>తదుపరి</Text>
          </Pressable>
          <Pressable onPress={resetState} style={styles.link}>
            <Text style={[styles.linkText, { color: muted }]}>రద్దు</Text>
          </Pressable>
        </>
      );
    }

    if (resetStep === 'confirm-mpin') {
      return (
        <>
          <Text style={[styles.subtitle, { color: muted }]}>MPIN నిర్ధారించండి</Text>
          <TextInput
            value={confirmMpinValue}
            onChangeText={setConfirmMpinValue}
            placeholder="MPIN మళ్ళీ ఇవ్వండి"
            placeholderTextColor={muted}
            keyboardType="number-pad"
            secureTextEntry
            onSubmitEditing={onConfirmNewMpin}
            style={[styles.input, { borderColor: border, color: text }]}
            maxLength={6}
            autoFocus
          />
          {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
          <Pressable
            style={[styles.button, { backgroundColor: primary }]}
            onPress={onConfirmNewMpin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>సేవ్ చేయండి</Text>}
          </Pressable>
          <Pressable onPress={() => setResetStep('new-mpin')} style={styles.link}>
            <Text style={[styles.linkText, { color: muted }]}>వెనుకకు</Text>
          </Pressable>
        </>
      );
    }

    return null;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.title, { color: text }]}>
            {resetStep === 'none' ? 'అన్‌లాక్' : 'MPIN రీసెట్'}
          </Text>

          {resetStep === 'none' ? (
            <>
              <Text style={[styles.subtitle, { color: muted }]}>
                {mode === 'biometric' ? 'బయోమెట్రిక్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.' : 'కొనసాగించడానికి మీ MPIN ఇవ్వండి'}
              </Text>
              {(mode === 'mpin' || mode === 'both') && (
                <>
                  <TextInput
                    value={mpin}
                    onChangeText={(v) => { setMpin(v); setError(''); }}
                    placeholder="MPIN ఇవ్వండి"
                    placeholderTextColor={muted}
                    keyboardType="number-pad"
                    secureTextEntry
                    onSubmitEditing={onSubmitMpin}
                    style={[styles.input, { borderColor: error ? errorColor : border, color: text }]}
                    maxLength={6}
                  />
                  {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
                  <Pressable
                    style={[styles.button, { backgroundColor: primary }]}
                    onPress={onSubmitMpin}
                  >
                    <Text style={styles.buttonText}>అన్‌లాక్</Text>
                  </Pressable>
                  {tries >= 5 && (
                    <Pressable onPress={onStartReset} style={styles.link} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color={primary} size="small" />
                      ) : (
                        <Text style={[styles.linkText, { color: primary }]}>MPIN మర్చిపోయారా? రీసెట్ చేయండి</Text>
                      )}
                    </Pressable>
                  )}
                </>
              )}
            </>
          ) : (
            renderResetFlow()
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '86%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, marginBottom: 8, textAlign: 'center', letterSpacing: 4 },
  error: { fontSize: 12, marginBottom: 8, textAlign: 'center' },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { fontSize: 14 },
});
