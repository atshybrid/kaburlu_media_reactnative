// Full-screen LOLz video screen with close button
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const lolzVideo = require('../../assets/Kaburlu_lolz.mp4');

export default function LolzScreen() {
  const router = useRouter();

  const player = useVideoPlayer(lolzVideo, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 1.0;
    p.play();
  });

  // Ensure we stop playback when leaving the screen
  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]}> 
      {/* Full-screen video */}
      <View style={styles.videoContainer}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </View>

      {/* Close button (X) overlay in top-right */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close video"
        onPress={() => {
          try { player.pause(); } catch {}
          router.replace('/news');
        }}
        style={[styles.closeBtn, { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.3)' }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="x" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  videoContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
