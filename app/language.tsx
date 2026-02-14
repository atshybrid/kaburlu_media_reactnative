import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// import * as Location from 'expo-location';
// import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { LanguageSkeleton } from '@/components/ui/LanguageSkeleton';
import { getLanguageIcon } from '@/icons/languageIcons';
import { getStateSymbol } from '@/components/languageSymbols';
import { saveTokens } from '@/services/auth';
import { getDeviceIdentity } from '@/services/device';
import { Language } from '../constants/languages';
import { afterPreferencesUpdated, getLanguages, registerGuestUser, updatePreferences } from '../services/api';
import Spacing from '@/constants/Spacing';
import Typography from '@/constants/Typography';
import BorderRadius from '@/constants/BorderRadius';
import Shadows from '@/constants/Shadows';

const LanguageSelectionScreen = () => {
  // use expo-router to navigate to the News tab after selection
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [languages, setLanguages] = useState<Language[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [storedLanguage, setStoredLanguage] = useState<Language | null>(null);
  const [hasTokens, setHasTokens] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) setStoredLanguage(JSON.parse(raw));
      } catch {}
      try {
        const existingJwt = await AsyncStorage.getItem('jwt');
        const existingRefresh = await AsyncStorage.getItem('refreshToken');
        setHasTokens(!!(existingJwt && existingRefresh));
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await getLanguages();
        setLanguages(list);
        // Prefer previously chosen language if it exists
        if (list?.length) {
          const byId = storedLanguage?.id ? list.find((l) => l.id === storedLanguage.id) : undefined;
          const byCode = !byId && storedLanguage?.code ? list.find((l) => l.code === storedLanguage.code) : undefined;
          setSelectedLanguage(byId || byCode || list[0]);
        }
        setLoadError(null);
      } catch {
        setLoadError('Failed to load languages');
      } finally {
        setLoading(false);
      }
    })();
  }, [storedLanguage?.id, storedLanguage?.code]);

  const handleLanguageSelect = async (language: Language) => {
    if (submitting || loading) return;
    setSelectedLanguage(language);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(language));

    const deviceDetails = await getDeviceIdentity();

    try {
      setSubmitting(true);
      // Don't show errors to user
      setSubmitError(null);
      // If we already have tokens, skip re-registering
      const existingJwt = await AsyncStorage.getItem('jwt');
      const existingRefresh = await AsyncStorage.getItem('refreshToken');
      if (existingJwt && existingRefresh) {
        try {
          await updatePreferences({ languageId: language.id, languageCode: language.code });
          await afterPreferencesUpdated({ languageIdChanged: language.id, languageCode: language.code });
        } catch {}
        router.replace('/news');
        return;
      }

      // Best Practice: Request notification permission on user action (Play Store compliant)
      // User clicked language = user-initiated action, so we can request permission here
      const { ensureNotificationsSetup } = await import('@/services/notifications');
      const notifResult = await ensureNotificationsSetup();
      const pushToken = notifResult.fcmToken || notifResult.expoToken || notifResult.deviceToken;
      console.log('[LANG] Notification permission:', notifResult.status, 'FCM Token:', pushToken ? `${pushToken.slice(0, 20)}...` : 'NOT AVAILABLE');

      // Also get location if already granted (don't request - that's separate)
      const { checkPermissionsOnly } = await import('@/services/permissions');
      const perms = await checkPermissionsOnly();

      const authResponse = await registerGuestUser({
        // Backend expects string IDs like "cmfdwhqk80009ugtof37yt8vv"
        languageId: language.id,
        deviceDetails,
        location: perms.coords ? { latitude: perms.coords.latitude, longitude: perms.coords.longitude } : undefined,
        pushToken: pushToken,
      });

      console.log('Guest user registered:', authResponse);
      await saveTokens({
        jwt: authResponse.jwt,
        refreshToken: authResponse.refreshToken,
        expiresAt: authResponse.expiresAt || (Date.now() + 24 * 3600 * 1000),
        languageId: authResponse.languageId || language.id,
        user: authResponse.user,
      });

      try {
        // Warm caches for the chosen language
        await afterPreferencesUpdated({ languageIdChanged: language.id, languageCode: language.code });
      } catch {}

      // await requestPermissions();
      router.replace('/news');
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      // In Expo dev, console.error triggers the red error overlay; treat this as a handled UI error.
      try {
        console.warn('[AUTH] Guest registration failed', rawMsg);
      } catch {}

      const lower = String(rawMsg || '').toLowerCase();
      const statusMatch = String(rawMsg || '').match(/\((\d{3})\)/) || String(rawMsg || '').match(/http\s*(\d{3})/i);
      const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;
      const isCloudflare = lower.includes('cloudflare') || lower.includes('just a moment') || lower.includes('/cdn-cgi/');

      const friendlyMsg = (statusCode === 429)
        ? 'Too many requests right now. Please wait 10 seconds and try again.'
        : (statusCode === 503)
          ? 'Service temporarily unavailable (503). Please try again in a minute.'
        : isCloudflare
          ? 'Service is temporarily blocked by protection (Cloudflare). Please try again later.'
          : /\(500\)/.test(rawMsg)
            ? 'Server error (500). Please try again in a moment.'
            : rawMsg || 'Failed to register. Please try again.';

      // Silent error - don't show to user, just log it
      console.log('[AUTH] Registration error (silent):', friendlyMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // const requestPermissions = async () => {
  //   let { status } = await Location.requestForegroundPermissionsAsync();
  //   if (status !== 'granted') {
  //     console.log('Permission to access location was denied');
  //     return;
  //   }
  //
  //   let location = await Location.getCurrentPositionAsync({});
  //   await AsyncStorage.setItem('userLocation', JSON.stringify(location));

    // const { status: existingStatus } = await Notifications.getPermissionsAsync();        
    // let finalStatus = existingStatus;
    // if (existingStatus !== 'granted') {
    //   const { status } = await Notifications.requestPermissionsAsync();
    //   finalStatus = status;
    // }
    // if (finalStatus !== 'granted') {
    //   console.log('Failed to get push token for push notification!');
    //   return;
    // }

    // const token = (await Notifications.getExpoPushTokenAsync()).data;
    // console.log('FCM Token:', token);
  // };

  const renderLanguageItem = (item: Language, isSelected: boolean) => {
    const StateSymbol = getStateSymbol(item.code);
    
    // Professional gradient - subtle and elegant
    const gradientColors = [
      '#FFFFFF',
      '#FFFFFF',
      item.color + '15',
    ];

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => handleLanguageSelect(item)}
        style={isSelected ? styles.fullWidthContainer : styles.gridItemContainer}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel={`Select ${item.nativeName} language`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.item,
            isSelected && styles.selectedItem,
            { borderLeftColor: item.color },
          ]}
        >
          {/* State Symbol as elegant background */}
          {StateSymbol && (
            <View style={styles.symbolBackground}>
              <StateSymbol size={isSelected ? 120 : 90} color={item.color} />
            </View>
          )}
          
          {/* Content with professional spacing */}
          <View style={styles.cardContent}>
            <View style={styles.languageInfo}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <View style={styles.languageNames}>
                <Text style={[styles.nativeName, { color: '#1a1a1a' }]}>{item.nativeName}</Text>
                <Text style={styles.englishName}>{item.name}</Text>
              </View>
            </View>
            
            {/* Checkmark for selected */}
            {isSelected && (
              <View style={styles.checkmarkContainer}>
                <View style={[styles.checkmarkCircle, { backgroundColor: item.color }]}>
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Show only the first language as the top card; remaining languages follow as grid, in the same API order
  const otherLanguages = (languages || []).slice(1);

  return (
    <View style={styles.container}>
      {/* Header */}
      {!loading && !loadError && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose your language</Text>
          <Text style={styles.headerSubtitle}>మీకు ఇష్టమైన భాష ఎంచుకోండి</Text>
        </View>
      )}
      
      {loading && <LanguageSkeleton />}
      {!loading && loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Unable to load languages.</Text>
          <TouchableOpacity
            onPress={async () => {
              setLoading(true);
              setLoadError(null);
              try {
                const list = await getLanguages();
                setLanguages(list);
              } catch {
                setLoadError('Retry failed');
              } finally {
                setLoading(false);
              }
            }}
            style={styles.retryBtn}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !loadError && (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
          {hasTokens && storedLanguage && (
            <View style={styles.continueBox}>
              <Text style={styles.continueText} numberOfLines={2}>
                Continue with {storedLanguage.nativeName || storedLanguage.name}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/news')}
                style={styles.continueBtn}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
          {selectedLanguage && renderLanguageItem(selectedLanguage, true)}
          <View style={styles.gridContainer}>
            {otherLanguages.map((item) => renderLanguageItem(item, false))}
          </View>
        </ScrollView>
      )}

      {submitting && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <MaterialCommunityIcons name="loading" size={22} color="#444" />
            <Text style={styles.overlayText}>Setting up your experience…</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: 55,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: Typography.h3,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: Typography.h4,
    fontWeight: '600',
    color: '#f1c40f',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  continueBox: {
    marginHorizontal: Spacing.md + 2,
    marginTop: Spacing.sm + 2,
    marginBottom: Spacing.md + 2,
    padding: Spacing.md,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(2, 60, 105, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm + 2,
    ...Shadows.sm,
  },
  continueText: {
    flex: 1,
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: Typography.bodySmall,
  },
  continueBtn: {
    backgroundColor: '#023c69',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.md,
  },
  fullWidthContainer: {
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm + 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  gridItemContainer: {
    width: '50%',
    padding: Spacing.xs + 2,
  },
  item: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 5,
    ...Shadows.sm,
    minHeight: 140,
    position: 'relative',
  },
  selectedItem: {
    minHeight: 180,
    ...Shadows.md,
    borderWidth: 2,
    borderColor: '#e8e8e8',
  },
  symbolBackground: {
    position: 'absolute',
    right: -15,
    bottom: -10,
    opacity: 0.08,
  },
  cardContent: {
    padding: 18,
    minHeight: 140,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  languageNames: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  nativeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  englishName: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  checkmarkContainer: {
    marginLeft: 8,
  },
  checkmarkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  // Error and retry UI
  errorBox: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: '#fdecea',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f5c6cb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#b00020',
    fontSize: Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  errorHint: {
    color: '#666',
    fontSize: Typography.bodySmall,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    ...Shadows.sm,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: Typography.body,
  },
  // Submitting overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.lg,
  },
  overlayText: {
    marginLeft: Spacing.sm + 2,
    color: '#333',
    fontWeight: '600',
    fontSize: Typography.bodySmall,
  },
});

export default LanguageSelectionScreen;
