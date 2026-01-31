/**
 * Change MPIN Screen
 * 
 * Dedicated screen for changing MPIN after login when:
 * - MPIN is insecure (matches last 4 digits of phone number)
 * - User is forced to change MPIN for security reasons
 */

import { useColorScheme } from '@/hooks/useColorScheme';
import { changeMpin } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChangeMpinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mobile?: string;
    oldMpin?: string;
    forceChange?: string;
    from?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs
  const newMpinRef = useRef<TextInput>(null);
  const confirmMpinRef = useRef<TextInput>(null);

  // Theme
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  // Handle MPIN change
  const handleChangeMpin = useCallback(async () => {
    const mobile = params.mobile || '';
    const oldMpin = params.oldMpin || '';
    const last4 = mobile.slice(-4);

    // Validate
    if (newMpin.length !== 4) {
      setError('MPIN 4 అంకెలు ఉండాలి');
      return;
    }
    if (newMpin !== confirmMpin) {
      setError('MPIN లు సరిపోలలేదు');
      return;
    }
    if (newMpin === last4) {
      setError('మీ ఫోన్ నంబర్ చివరి 4 అంకెలు MPIN గా ఉపయోగించవద్దు');
      return;
    }
    if (newMpin === oldMpin) {
      setError('కొత్త MPIN పాత MPIN కంటే భిన్నంగా ఉండాలి');
      return;
    }

    setError(null);
    setChanging(true);

    try {
      await changeMpin({
        mobileNumber: mobile,
        oldMpin: oldMpin,
        newMpin: newMpin,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);

      // Navigate to appropriate destination after short delay
      setTimeout(() => {
        if (params.from === 'post') {
          router.replace('/explore');
        } else {
          router.replace('/news');
        }
      }, 2000);
    } catch (e: any) {
      console.error('Change MPIN error:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message || 'MPIN మార్చడంలో లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి.');
    } finally {
      setChanging(false);
    }
  }, [params.mobile, params.oldMpin, params.from, newMpin, confirmMpin, router]);

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
          <Text style={[styles.successTitle, { color: textColor }]}>MPIN మార్చబడింది! 🎉</Text>
          <Text style={[styles.successSubtitle, { color: mutedColor }]}>
            మీ కొత్త MPIN సెట్ అయింది
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 44 }} />
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/app-icon.png')} style={styles.headerLogo} />
          <Text style={[styles.headerTitle, { color: textColor }]}>Kaburlu</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* Icon */}
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            style={styles.iconContainer}
          >
            <Ionicons name="shield-half-outline" size={36} color="#fff" />
          </LinearGradient>

          <Text style={[styles.title, { color: textColor }]}>MPIN మార్చండి</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            మీ అకౌంట్ భద్రత కోసం కొత్త 4-అంకెల MPIN సెట్ చేయండి.{'\n'}
            ఫోన్ నంబర్ చివరి 4 అంకెలు సురక్షితం కాదు.
          </Text>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* New MPIN Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: textColor }]}>కొత్త MPIN</Text>
            <TextInput
              ref={newMpinRef}
              style={[styles.mpinInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: textColor, borderColor }]}
              value={newMpin}
              onChangeText={(t) => { setNewMpin(t.replace(/\D/g, '').slice(0, 4)); setError(null); }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={mutedColor}
              secureTextEntry
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => confirmMpinRef.current?.focus()}
            />
          </View>

          {/* Confirm MPIN Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: textColor }]}>MPIN నిర్ధారించండి</Text>
            <TextInput
              ref={confirmMpinRef}
              style={[styles.mpinInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: textColor, borderColor }]}
              value={confirmMpin}
              onChangeText={(t) => { setConfirmMpin(t.replace(/\D/g, '').slice(0, 4)); setError(null); }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={mutedColor}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleChangeMpin}
            />
          </View>

          {/* Change Button */}
          <TouchableOpacity
            style={[styles.button, changing && styles.buttonDisabled]}
            onPress={handleChangeMpin}
            disabled={changing}
          >
            <LinearGradient
              colors={changing ? ['#94a3b8', '#94a3b8'] : ['#10b981', '#059669']}
              style={styles.buttonGradient}
            >
              {changing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.buttonText}>MPIN మార్చండి</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.helpText, { color: mutedColor }]}>
            మీ ఫోన్ నంబర్ చివరి 4 అంకెలు MPIN గా ఉపయోగించవద్దు
          </Text>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
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
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  mpinInput: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 16,
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
});
