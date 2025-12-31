import { isExpired, loadTokens, Tokens } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
// MP4 splash asset
const splashVideo = require('../assets/spash_kaburlu.mp4');

export default function SplashScreen() {
  const targetRouteRef = useRef<'/news' | '/language' | null>(null);
  const navigatedRef = useRef(false);
  const videoReadyRef = useRef(false);
  const player = useVideoPlayer(splashVideo, (p) => {
    p.loop = false;
    p.muted = false; // enable audio
    p.volume = 1.0;  // full volume
    p.play();
  });
  const fade = useRef(new Animated.Value(0)).current;

  // Keep native splash visible until the video is actually ready to render a frame.
  useEffect(() => {
    // No early hide; we'll hide in onReadyForDisplay, and also when navigating as a final safety.
  }, []);

  // Decide route fast (no network). We'll navigate on video end, with a safe fallback timeout.
  useEffect(() => {
    (async () => {
      try {
        // Determine route purely from local state: tokens and stored language
        let tokens: Tokens | null = await loadTokens();
        const valid = !!(tokens && tokens.expiresAt && !isExpired(tokens.expiresAt));

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

    // Fallback: in case events never fire, navigate after a short timeout (approx video length)
    const fallback = setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      (async () => {
        try { await ExpoSplashScreen.hideAsync(); } catch {}
        router.replace(targetRouteRef.current || '/language');
      })();
    }, 4000);
    return () => {
      clearTimeout(fallback);
    };
  }, []);

  // Navigate as soon as the video finishes playing
  useEffect(() => {
    // Listen for time updates and navigate when we reach the end
    const sub = (player as any)?.addListener?.('timeUpdate', (e: any) => {
      const ct: number = e?.currentTime ?? e?.position ?? 0;
      const dur: number = e?.duration ?? e?.seekableDuration ?? 0;
      if (!navigatedRef.current && dur > 0 && ct >= dur - 0.05) {
        navigatedRef.current = true;
        (async () => {
          try { await ExpoSplashScreen.hideAsync(); } catch {}
          router.replace(targetRouteRef.current || '/language');
        })();
      }
    });
    return () => {
      try {
        if (sub && typeof sub.remove === 'function') sub.remove();
      } catch {}
    };
  }, [player]);

  // Handled by Video's onPlaybackStatusUpdate and onReadyForDisplay below

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {/*
        To avoid any logo/black screen before the splash video:
        - Set your native splash in app.json and android/app/src/main/res/drawable/splash.xml to pure black (no logo).
        - The video will show instantly as soon as it is ready.
      */}
      <Animated.View style={[styles.video, { opacity: fade }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
          onLayout={() => {
            // Instantly show video, no fade
            if (!videoReadyRef.current) {
              videoReadyRef.current = true;
              fade.setValue(1); // no animation
              ExpoSplashScreen.hideAsync().catch(() => {});
            }
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
});

