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

  // Decide route fast (no network), and navigate after exactly 8 seconds (video length).
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

    const timer = setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      (async () => {
        try { await ExpoSplashScreen.hideAsync(); } catch {}
        router.replace(targetRouteRef.current || '/language');
      })();
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Handled by Video's onPlaybackStatusUpdate and onReadyForDisplay below

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.View style={[styles.video, { opacity: fade }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
          onLayout={() => {
            // When the view is laid out, give the decoder a brief moment, then reveal smoothly
            if (!videoReadyRef.current) {
              videoReadyRef.current = true;
              Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
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

