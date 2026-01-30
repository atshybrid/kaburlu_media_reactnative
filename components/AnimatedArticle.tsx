
import { Article } from '@/types';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { pickLayoutWithInfo } from './articleLayouts/registry';

interface AnimatedArticleProps {
  article: Article;
  index: number;
  activeIndex: SharedValue<number>;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  totalArticles: number;
  forceVisible?: boolean;
  // Actual rendered page height from parent (measured). Falls back to window height.
  pageHeight?: number;
}

// Note: Do NOT capture window height at module scope for layouts that react to system UI changes.
// We'll use a shared value that updates with useWindowDimensions inside the component.

const AnimatedArticle: React.FC<AnimatedArticleProps> = ({
  article,
  index,
  activeIndex,
  onSwipeUp,
  onSwipeDown,
  totalArticles,
  forceVisible = false,
  pageHeight,
}) => {
  // Keep track of current window height to avoid "peeking" when Android system bars hide/show
  const { height: windowHeight } = useWindowDimensions();
  const h = useSharedValue(Dimensions.get('window').height);
  useEffect(() => {
    // Prefer measured height from parent; fallback to window height
    h.value = (pageHeight && pageHeight > 0 ? pageHeight : windowHeight);
  }, [windowHeight, pageHeight, h]);

  const animatedStyle = useAnimatedStyle(() => {
    // Keep the current and adjacent pages rendered during the spring animation
    // to avoid a blank screen when activeIndex is between integers.
    const distance = Math.abs(index - activeIndex.value);
    const translate = Math.round((index - activeIndex.value) * h.value);
    const style: any = {
      transform: [{ translateY: translate }],
      // Show the current and immediate neighbor to be robust against tiny float drift
      // Use a tighter threshold so neighbors don't "peek" when idle
      opacity: distance < 1.01 ? 1 : 0,
      // Keep the most relevant page on top
      zIndex: distance < 0.5 ? 2 : 1,
      // On Android, elevation participates in stacking; mirror zIndex for reliability
      elevation: distance < 0.5 ? 2 : 1,
    };
    if (forceVisible) {
      style.opacity = 1;
      style.zIndex = 3;
      style.elevation = 3;
      style.transform = [{ translateY: Math.round((index - activeIndex.value) * h.value) }];
    }
    return style;
  });

  const gesture = Gesture.Pan()
    .activeOffsetY([-20, 20]) // require a more intentional swipe
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -500) { // Quick flick up
        runOnJS(onSwipeUp)();
      } else if (event.translationY > 50 && event.velocityY > 500) { // Quick flick down
        runOnJS(onSwipeDown)();
      }
    });

  // Get layout with style info for debugging
  const layoutInfo = useMemo(() => pickLayoutWithInfo(article, index), [article, index]);
  const LayoutComponent = layoutInfo.component;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Debug Style Badge */}
        <View style={styles.debugBadge}>
          <Text style={styles.debugText}>
            Style {layoutInfo.styleNumber}: {layoutInfo.styleName}
          </Text>
        </View>
        {React.createElement(LayoutComponent, { article, index, totalArticles })}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
  overflow: 'hidden',
  },
  debugBadge: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AnimatedArticle;
