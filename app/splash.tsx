import { refreshLanguageDependentCaches } from '@/services/api';
import { checkAndClearOnFreshInstall, isExpired, loadTokens, Tokens } from '@/services/auth';
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
        await checkAndClearOnFreshInstall();

        const looksLikeLangCode = (v: string) => /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(String(v || '').trim());
        // Determine route purely from local state: tokens and stored language
        const tokens: Tokens | null = await loadTokens();
        const valid = !!(tokens && tokens.expiresAt && !isExpired(tokens.expiresAt));

        if (valid && tokens?.user?.role === 'TENANT_ADMIN') {
          // Never auto-open tenant dashboard; always land on News first.
          targetRouteRef.current = '/news';
          return;
        }

        let storedLanguage: any = null;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) storedLanguage = JSON.parse(langRaw);
        } catch {}

        // Prefetch shortnews (public API) while splash is visible.
        // This warms the AsyncStorage cache used by getNews() so /news doesn't “wait after splash”.
        try {
          const storedCode = String(storedLanguage?.code || '').trim();
          const storedId = String(storedLanguage?.id || '').trim();
          const tokenLang = String(tokens?.languageId || '').trim();
          const preferred = (looksLikeLangCode(storedCode) && storedCode)
            || (looksLikeLangCode(storedId) && storedId)
            || (looksLikeLangCode(tokenLang) && tokenLang)
            || 'en';
          void refreshLanguageDependentCaches(preferred);
        } catch {
          void refreshLanguageDependentCaches('en');
        }

        if (valid || storedLanguage?.id || storedLanguage?.code) {
          targetRouteRef.current = '/news';
        } else {
          targetRouteRef.current = '/language';
        }
      } catch {
        // Best-effort prefetch even if auth/lang read fails
        try { void refreshLanguageDependentCaches('en'); } catch {}
        targetRouteRef.current = '/language';
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
            } catch {}
            router.replace(targetRouteRef.current || '/language');
          })();
        }}
      />
    </>
  );
}

