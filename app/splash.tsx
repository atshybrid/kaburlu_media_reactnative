import { refreshLanguageDependentCaches } from '@/services/api';
import { checkAndClearOnFreshInstall, isExpired, loadTokens, Tokens } from '@/services/auth';
import { safeJsonParse } from '@/services/safeApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import LogoIntro from '../screens/LogoIntro';

export default function SplashScreen() {
  const targetRouteRef = useRef<'/news' | '/language' | null>(null);
  const navigatedRef = useRef(false);

  // Decide route fast (no network). We'll navigate after the SVG intro completes.
  useEffect(() => {
    (async () => {
      try {
        // Check for fresh install and clear stale data if needed
        // Wrapped in try-catch to prevent crashes
        try {
          await checkAndClearOnFreshInstall();
        } catch (e) {
          console.warn('[SPLASH] Fresh install check failed:', e);
        }

        const looksLikeLangCode = (v: string) => /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(String(v || '').trim());
        
        // Determine route purely from local state: tokens and stored language
        let tokens: Tokens | null = null;
        try {
          tokens = await loadTokens();
        } catch (e) {
          console.warn('[SPLASH] Token load failed:', e);
          tokens = null;
        }
        
        const valid = !!(tokens && tokens.expiresAt && !isExpired(tokens.expiresAt));

        if (valid && tokens?.user?.role === 'TENANT_ADMIN') {
          // Never auto-open tenant dashboard; always land on News first.
          targetRouteRef.current = '/news';
          return;
        }

        let storedLanguage: any = null;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          storedLanguage = safeJsonParse(langRaw, null);
        } catch (e) {
          console.warn('[SPLASH] Language load failed:', e);
        }

        // Prefetch shortnews (public API) while splash is visible.
        // This warms the AsyncStorage cache used by getNews() so /news doesn't “wait after splash”.
        // CRITICAL: Wrapped in try-catch to prevent splash crash on network failure
        try {
          const storedCode = String(storedLanguage?.code || '').trim();
          const storedId = String(storedLanguage?.id || '').trim();
          const tokenLang = String(tokens?.languageId || '').trim();
          const preferred = (looksLikeLangCode(storedCode) && storedCode)
            || (looksLikeLangCode(storedId) && storedId)
            || (looksLikeLangCode(tokenLang) && tokenLang)
            || 'en';
          await refreshLanguageDependentCaches(preferred);
        } catch (e) {
          // Network failure is OK - app will load cached data or show empty state
          console.warn('[SPLASH] Cache prefetch failed (OK):', e);
          // Try fallback to English
          try {
            await refreshLanguageDependentCaches('en');
          } catch {
            // Even fallback failed - that's OK, we'll show empty state
            console.warn('[SPLASH] Fallback cache failed - will use empty state');
          }
        }

        // GUEST MODE: Allow users to proceed even without auth or language
        // This prevents "stuck on splash" crashes during Google Play review
        if (valid || storedLanguage?.id || storedLanguage?.code) {
          targetRouteRef.current = '/news';
        } else {
          targetRouteRef.current = '/language';
        }
      } catch (e) {
        // Complete failure - still allow app to open
        // Guest users should see language selection
        console.error('[SPLASH] Critical error (recovering):', e);
        targetRouteRef.current = '/language';
        
        // Best-effort prefetch even if everything failed
        try {
          await refreshLanguageDependentCaches('en');
        } catch {
          // Silent failure - app will handle empty state
        }
      }
    })();
  }, []);

  return (
    <>
      <StatusBar hidden />
      <LogoIntro
        onDone={() => {
          if (navigatedRef.current) return;
          navigatedRef.current = true;
          (async () => {
            try {
              await ExpoSplashScreen.hideAsync();
            } catch (e) {
              console.warn('[SPLASH] Hide splash failed:', e);
            }
            // Guaranteed navigation - always proceed even if target is null
            router.replace(targetRouteRef.current || '/language');
          })();
        }}
      />
    </>
  );
}

