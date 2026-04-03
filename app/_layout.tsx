import AppLockGate from '@/components/AppLockGate';
import LoginBottomSheet from '@/components/LoginBottomSheet';
import Toast from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { initCrashlytics } from '@/services/crashlytics';
import { checkForAppUpdates } from '@/services/appUpdates';
import { ensureFirebaseAuthAsync, isFirebaseConfigComplete, logFirebaseGoogleAlignment } from '@/services/firebaseClient';
import { setupNotificationListeners, syncPushTokenOnForeground } from '@/services/notifications';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AppState, LogBox, Platform, StyleSheet, Text, View } from 'react-native';
// removed duplicate react-native import (merged above)
import { useAppFonts } from '@/components/fonts';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { AuthModalProvider } from '../context/AuthModalContext';
import { ThemeProviderLocal, useThemePref } from '../context/ThemeContext';
import { UiPrefsProvider } from '../context/UiPrefsContext';
import { useColorScheme } from '../hooks/useColorScheme';

// Suppress expo-keep-awake activation errors (expo-video compatibility issue)
LogBox.ignoreLogs(['Unable to activate keep awake']);

// Hide native splash immediately - we show our own multi-language animated splash
SplashScreen.hideAsync().catch(() => {});

// Setup notification listeners early to catch notification clicks
// even when app is opened from quit state
setupNotificationListeners();

// Custom Header Component
const CustomHeader = () => {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>
        Choose your preferred <Text style={styles.boldText}>language</Text> to read the <Text style={styles.boldText}>news</Text>
        {'\n'}
        మీకు ఇష్టమైన <Text style={styles.boldText}>భాష</Text> ఎంచుకోండి
        {'\n'}
        अपनी पसंदीदा <Text style={styles.boldText}>भाषा</Text> चुनें
      </Text>
    </View>
  );
};

function ThemedApp() {
  const system = useColorScheme();
  const { themePref } = useThemePref();
  const effective = themePref === 'system' ? system : themePref;
  const router = useRouter();
  // Non-blocking font loader (Mandali)
  useAppFonts();

  // Dev-only keep-awake guard to avoid activation errors on some devices
  React.useEffect(() => {
    if (__DEV__ && Platform.OS !== 'web') {
      // Lazy import to avoid initializing keep-awake too early
      (async () => {
        try {
          const mod = await import('expo-keep-awake');
          if (mod?.deactivateKeepAwake) {
            await mod.deactivateKeepAwake();
          } else if ((mod as any)?.deactivateKeepAwakeAsync) {
            await (mod as any).deactivateKeepAwakeAsync();
          }
        } catch (e) {
          // Swallow – keep awake isn’t critical to functionality
          console.log('[KEEP_AWAKE] skip', (e as any)?.message);
        }
      })();
    }
  }, []);

  // Request App Tracking Transparency permission (iOS 14+ required by App Store guideline 5.1.2)
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    (async () => {
      try {
        const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
        await requestTrackingPermissionsAsync();
      } catch (e: any) {
        console.log('[ATT] Permission request skipped:', e?.message);
      }
    })();
  }, []);

  // Defer preload to allow Firebase modules to register (RN 0.81 timing)
  React.useEffect(() => {
    (async () => {
      try {
        // Initialize Crashlytics first
        await initCrashlytics();
        
        if (isFirebaseConfigComplete()) {
          const auth = await ensureFirebaseAuthAsync();
          console.log('[AUTH_INIT] Layout ensured auth (async)', { appId: auth.app.options.appId, hasUser: !!auth.currentUser });
          logFirebaseGoogleAlignment();
        }
      } catch (e:any) {
        console.log('[AUTH_INIT] Layout init skipped', e?.message);
      }
    })();
  }, []);

  // Notifications permission prompt is intentionally deferred until after splash.

  // Sync push token when app comes to foreground
  // Handles case where user grants permission later from device settings
  React.useEffect(() => {
    const appStateRef = React.createRef<string>() as any;
    appStateRef.current = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current?.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground - sync push token
        syncPushTokenOnForeground().catch(() => {});
      }
      appStateRef.current = nextState;
    });

    // Also sync on initial mount
    syncPushTokenOnForeground().catch(() => {});

    return () => subscription.remove();
  }, []);

  // Check for OTA updates on app launch
  React.useEffect(() => {
    // Small delay to not block initial render
    const timer = setTimeout(() => {
      checkForAppUpdates(true).catch(() => {}); // silent check
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Deep link & App Link handler for:
  // - https://s.kaburlumedia.com/<shortId>          → article
  // - https://kaburlumedia.com/article/<id>          → article
  // - https://www.kaburlumedia.com/article/<id>      → article
  // - https://kaburlumedia.com/category/<slug>       → category
  // - https://www.kaburlumedia.com/category/<slug>   → category
  // - https://kaburlumedia.com/                      → home
  // - kaburlu://article/<id>                         → article (custom scheme)
  React.useEffect(() => {
    const handleUrl = (url?: string | null) => {
      if (!url) return;
      try {
        console.log('[DEEP_LINK] Received URL:', url);

        // ── 1. Short-link domain ──────────────────────────────────────────
        if (url.includes('s.kaburlumedia.com')) {
          const match = url.match(/s\.kaburlumedia\.com\/([a-zA-Z0-9]+)/);
          if (match?.[1]) {
            console.log('[DEEP_LINK] Short URL, shortId:', match[1]);
            router.push({ pathname: '/article/[id]', params: { id: match[1], isShortId: 'true' } });
            return;
          }
        }

        // ── 2. Main / www domain ──────────────────────────────────────────
        if (url.match(/(?:www\.)?kaburlumedia\.com/)) {
          let pathname = '';
          try {
            pathname = new URL(url).pathname;
          } catch {
            // fallback: extract path manually
            pathname = url.replace(/^https?:\/\/(?:www\.)?kaburlumedia\.com/, '') || '/';
          }

          // /article/<id>
          const articleMatch = pathname.match(/^\/article\/([a-zA-Z0-9_-]+)/);
          if (articleMatch?.[1]) {
            console.log('[DEEP_LINK] Article URL, id:', articleMatch[1]);
            router.push({ pathname: '/article/[id]', params: { id: articleMatch[1] } });
            return;
          }

          // /category/<slug>
          const categoryMatch = pathname.match(/^\/category\/([a-zA-Z0-9_-]+)/);
          if (categoryMatch?.[1]) {
            console.log('[DEEP_LINK] Category URL, slug:', categoryMatch[1]);
            router.push({ pathname: '/category/[slug]', params: { slug: categoryMatch[1] } });
            return;
          }

          // /open/article/<id> or /open/shortnews/<id>
          const openTypedMatch = pathname.match(/^\/open\/(article|shortnews)\/([a-zA-Z0-9_-]+)/i);
          if (openTypedMatch?.[2]) {
            console.log('[DEEP_LINK] Open typed URL, id:', openTypedMatch[2]);
            router.push({ pathname: '/article/[id]', params: { id: openTypedMatch[2] } });
            return;
          }

          // /open/<id> (shortId style fallback)
          const openIdMatch = pathname.match(/^\/open\/([a-zA-Z0-9_-]+)/);
          if (openIdMatch?.[1]) {
            console.log('[DEEP_LINK] Open URL shortId:', openIdMatch[1]);
            router.push({ pathname: '/article/[id]', params: { id: openIdMatch[1], isShortId: 'true' } });
            return;
          }

          // Root URL → home tab
          if (pathname === '/' || pathname === '') {
            console.log('[DEEP_LINK] Root URL → home');
            router.push('/(tabs)');
            return;
          }

          // Unrecognised path – fall through to home gracefully
          console.log('[DEEP_LINK] Unrecognised path, falling back to home:', pathname);
          router.push('/(tabs)');
          return;
        }

        // ── 3. Custom scheme: kaburlu://article/<id> ──────────────────────
        const parsed = Linking.parse(url);
        const segments = (parsed?.path ?? '').replace(/^\//, '').split('/').filter(Boolean);

        if (segments[0] === 'article' && segments[1]) {
          console.log('[DEEP_LINK] Custom scheme article, id:', segments[1]);
          router.push({ pathname: '/article/[id]', params: { id: segments[1] } });
          return;
        }

        if (segments[0] === 'shortnews' && segments[1]) {
          console.log('[DEEP_LINK] Custom scheme shortnews, id:', segments[1]);
          router.push({ pathname: '/article/[id]', params: { id: segments[1] } });
          return;
        }

        // kaburlu://open/article/<id> OR kaburlu://open/shortnews/<id>
        if (segments[0] === 'open' && segments[2] && (segments[1] === 'article' || segments[1] === 'shortnews')) {
          console.log('[DEEP_LINK] Custom scheme open typed, id:', segments[2]);
          router.push({ pathname: '/article/[id]', params: { id: segments[2] } });
          return;
        }

        if (segments[0] === 'category' && segments[1]) {
          console.log('[DEEP_LINK] Custom scheme category, slug:', segments[1]);
          router.push({ pathname: '/category/[slug]', params: { slug: segments[1] } });
          return;
        }

      } catch (e) {
        // Never crash from a deep-link parse failure
        console.warn('[DEEP_LINK] Failed to parse URL:', url, e);
      }
    };

    // Cold-start: app opened via link
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    // Warm-start: app already running and receives a link
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => { try { sub.remove(); } catch {} };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <AuthModalProvider>
            <ThemeProvider value={effective === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack
                initialRouteName="splash"
                screenOptions={{
                  headerShown: false,
                  // Avoid freezing previous screen during gestures to prevent blank screen
                  freezeOnBlur: false,
                  // Ensure a solid background during transitions using theme colors
                  contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                  gestureEnabled: true,
                  animationTypeForReplace: 'push',
                }}
              >
              <Stack.Screen name="splash" options={{ animation: 'none', contentStyle: { backgroundColor: '#FFFFFF' } }} />
              <Stack.Screen
                name="language"
                options={{
                  headerShown: false,
                }}
              />
              {/* Keep previous screen attached to avoid blank screen when swiping back from article */}
              <Stack.Screen
                name="article/[id]"
                options={{
                  headerShown: false,
                  freezeOnBlur: false,
                  animation: 'slide_from_right',
                  contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false, freezeOnBlur: false }} />
              <Stack.Screen
                name="comments"
                options={{
                  title: 'Comments',
                  // Bottom-to-top slide
                  animation: 'slide_from_bottom',
                  // iOS modal presentation style
                  presentation: 'modal',
                  // Keep underlying screen alive to prevent blank screen on gesture back
                  freezeOnBlur: false,
                  // Solid background during transitions
                  contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                }}
              />
              <Stack.Screen 
                name="post-news" 
                options={{ 
                  headerShown: false, 
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="congrats" 
                options={{ 
                  headerShown: false, 
                  gestureEnabled: false, // Disable back gesture on success screen
                  animation: 'fade',
                }} 
              />
              <Stack.Screen
                name="category/[slug]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  freezeOnBlur: false,
                  contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                }}
              />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar
              style={effective === 'dark' ? 'light' : 'dark'}
              translucent={false}
              backgroundColor={effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background}
            />
            <Toast />
            <AppLockGate />
            <LoginBottomSheet />
          </ThemeProvider>
        </AuthModalProvider>
      </AuthProvider>
    </BottomSheetModalProvider>
  </GestureHandlerRootView>
);
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProviderLocal>
        <UiPrefsProvider>
          <ThemedApp />
        </UiPrefsProvider>
      </ThemeProviderLocal>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 10,
    justifyContent: 'center',
    height: 140,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
  },
  boldText: {
    fontWeight: 'bold',
  },
});
