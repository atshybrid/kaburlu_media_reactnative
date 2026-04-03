import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageContentFit, type ImageContentPosition } from 'expo-image';
import { Animated, StyleProp, StyleSheet, View, type ImageStyle } from 'react-native';

type ImageWithSkeletonProps = {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
  transition?: number;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  skeletonColor?: string;
};

export default function ImageWithSkeleton({
  uri,
  style,
  contentFit = 'cover',
  contentPosition,
  transition,
  cachePolicy,
  skeletonColor = '#E5E7EB',
}: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    setLoaded(false);
  }, [uri]);

  useEffect(() => {
    if (loaded) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [loaded, opacity]);

  const hasUri = typeof uri === 'string' && uri.trim().length > 0;

  return (
    <View style={[style, styles.container]}>
      {hasUri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          contentPosition={contentPosition}
          transition={transition}
          cachePolicy={cachePolicy}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : null}

      {!loaded && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: skeletonColor,
              opacity,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
