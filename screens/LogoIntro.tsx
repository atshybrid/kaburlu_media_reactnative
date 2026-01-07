import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import EnglishLogo from '../assets/spashlogos/english.svg';
import HindiLogo from '../assets/spashlogos/hindi.svg';
import KannadaLogo from '../assets/spashlogos/kannada.svg';
import TamilLogo from '../assets/spashlogos/tamil.svg';
import TeluguLogo from '../assets/spashlogos/telugu.svg';

const COLORS = {
  primary: '#FF9933',
  secondary: '#1F2A44',
  background: '#FFFFFF',
} as const;

const FADE_IN_MS = 160;
const FADE_OUT_MS = 140;
const VISIBLE_MS = 250;
const START_SCALE = 0.9;
const LOGO_BOX_SIZE = 280;

type LogoItem = {
  key: string;
  Svg: React.ComponentType<any>;
};

type Props = {
  onDone: () => void;
};

export default function LogoIntro({ onDone }: Props) {
  // Current logo index
  const [index, setIndex] = useState(0);

  // Shared animated values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(START_SCALE);

  // Timers cleanup (no setInterval)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const logos = useMemo<LogoItem[]>(
    () => [
      { key: 'te', Svg: TeluguLogo },
      { key: 'hi', Svg: HindiLogo },
      { key: 'en', Svg: EnglishLogo },
      { key: 'ta', Svg: TamilLogo },
      { key: 'kn', Svg: KannadaLogo },
    ],
    []
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  }, []);

  useEffect(() => {
    // Clear any scheduled timeouts from previous index.
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Reset to a known baseline to avoid flicker between logo switches.
    cancelAnimation(opacity);
    cancelAnimation(scale);
    opacity.value = 0;
    scale.value = START_SCALE;

    // Fade/scale in.
    opacity.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });

    // Hold for VISIBLE_MS, then fade out.
    const fadeOutAt = FADE_IN_MS + VISIBLE_MS;
    timeoutsRef.current.push(
      setTimeout(() => {
        opacity.value = withTiming(0, {
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
        });
        scale.value = withTiming(0.98, {
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
        });
      }, fadeOutAt)
    );

    // After fade out completes, switch to next logo (or finish).
    timeoutsRef.current.push(
      setTimeout(() => {
        const next = index + 1;
        if (next < logos.length) {
          setIndex(next);
        } else {
          onDone();
        }
      }, fadeOutAt + FADE_OUT_MS)
    );

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [index, logos.length, onDone, opacity, scale]);

  const CurrentLogo = logos[index]?.Svg ?? TeluguLogo;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, animatedStyle]}>
        <View style={styles.logoBox}>
          <CurrentLogo width={LOGO_BOX_SIZE} height={LOGO_BOX_SIZE} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: LOGO_BOX_SIZE,
    height: LOGO_BOX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
