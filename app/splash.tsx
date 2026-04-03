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

  const decideRouteFromLocalState = async (): Promise<'/news' | '/language'> => {
    const tokens = await loadTokens().catch(() => null);
    const valid = !!(tokens && tokens.expiresAt && !isExpired(tokens.expiresAt));

    let storedLanguage: any = null;
    try {
      const langRaw = await AsyncStorage.getItem('selectedLanguage');
      storedLanguage = safeJsonParse(langRaw, null);
    } catch {
      storedLanguage = null;
    }

    return (valid || storedLanguage?.id || storedLanguage?.code) ? '/news' : '/language';
  };

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
        
        // Determine route from local state first (never block on network prefetch)
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

        // GUEST MODE: Allow users to proceed even without auth or language
        // This prevents "stuck on splash" crashes during Google Play review
        targetRouteRef.current = (valid || storedLanguage?.id || storedLanguage?.code)
          ? '/news'
          : '/language';

        // Prefetch shortnews while splash is visible, but do not block route decision.
        // Fire-and-forget so slow network cannot force fallback navigation.
        void (async () => {
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
            console.warn('[SPLASH] Cache prefetch failed (OK):', e);
            try {
              await refreshLanguageDependentCaches('en');
            } catch {
              console.warn('[SPLASH] Fallback cache failed - will use empty state');
            }
          }
        })();
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
            // Re-check local state if intro finished before async bootstrap route assignment.
            if (!targetRouteRef.current) {
              targetRouteRef.current = await decideRouteFromLocalState();
            }
            router.replace(targetRouteRef.current);
          })();
        }}
      />
    </>
  );
}

