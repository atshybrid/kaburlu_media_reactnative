import { isExpired, loadTokens, Tokens } from '@/services/auth';
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

        if (valid || storedLanguage?.id || storedLanguage?.code) {
          targetRouteRef.current = '/news';
        } else {
          targetRouteRef.current = '/language';
        }
      } catch {
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

