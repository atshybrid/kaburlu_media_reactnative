import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%' as `${number}%`,
  height = 16,
  borderRadius = 8,
  color,
  style,
}) => {
  const scheme = useColorScheme() ?? 'light';
  // Pick a base that contrasts with the page background in each theme.
  // Keep opacity range high enough to be obviously visible.
  const bg = useMemo(() => {
    if (color) return color;
    return scheme === 'dark' ? Colors.dark.card : Colors.light.border;
  }, [color, scheme]);
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, opacity, backgroundColor: bg },
        style,
      ]}
    />
  );
};

export default Skeleton;
