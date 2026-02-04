// Digital Daily Viewer - Full newspaper reader with pinch-zoom and page swipe
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DigitalPaper, getDigitalPaperPages } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoomable Image Component with pinch-to-zoom
function ZoomableImage({ uri, onZoomChange }: { uri: string; onZoomChange?: (zoomed: boolean) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [loading, setLoading] = useState(true);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond if zoomed or if it's a multi-touch gesture
          return isZoomed || gestureState.numberActiveTouches > 1;
        },
        onPanResponderGrant: () => {
          // Store current values
          lastTranslateX.current = (translateX as any)._value || 0;
          lastTranslateY.current = (translateY as any)._value || 0;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.numberActiveTouches === 2) {
            // Pinch zoom - simple distance-based scaling
            const newScale = Math.max(1, Math.min(4, lastScale.current * (1 + gestureState.dy / 500)));
            scale.setValue(newScale);
          } else if (isZoomed) {
            // Pan when zoomed
            translateX.setValue(lastTranslateX.current + gestureState.dx);
            translateY.setValue(lastTranslateY.current + gestureState.dy);
          }
        },
        onPanResponderRelease: () => {
          lastScale.current = (scale as any)._value || 1;
          lastTranslateX.current = (translateX as any)._value || 0;
          lastTranslateY.current = (translateY as any)._value || 0;

          const zoomed = lastScale.current > 1.1;
          setIsZoomed(zoomed);
          onZoomChange?.(zoomed);

          // Reset if scale is too small
          if (lastScale.current < 1.1) {
            Animated.parallel([
              Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            ]).start();
            lastScale.current = 1;
            lastTranslateX.current = 0;
            lastTranslateY.current = 0;
          }
        },
      }),
    [isZoomed, onZoomChange, scale, translateX, translateY]
  );

  // Double tap to zoom
  const handleDoubleTap = useCallback(() => {
    if (isZoomed) {
      // Reset zoom
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
      lastScale.current = 1;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
      setIsZoomed(false);
      onZoomChange?.(false);
    } else {
      // Zoom in to 2x
      Animated.spring(scale, { toValue: 2, useNativeDriver: true }).start();
      lastScale.current = 2;
      setIsZoomed(true);
      onZoomChange?.(true);
    }
  }, [isZoomed, onZoomChange, scale, translateX, translateY]);

  const lastTap = useRef<number>(0);
  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  }, [handleDoubleTap]);

  return (
    <View style={styles.zoomContainer} {...panResponder.panHandlers}>
      <Pressable onPress={handlePress} style={styles.zoomPressable}>
        <Animated.View
          style={[
            styles.zoomImageWrapper,
            {
              transform: [
                { scale },
                { translateX },
                { translateY },
              ],
            },
          ]}
        >
          {loading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          <Image
            source={{ uri }}
            style={styles.pageImage}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function DigitalDailyViewer() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { paperData } = useLocalSearchParams<{ id: string; paperData: string }>();

  const paper: DigitalPaper | null = useMemo(() => {
    try {
      return paperData ? JSON.parse(paperData) : null;
    } catch {
      return null;
    }
  }, [paperData]);

  const pages = useMemo(() => {
    if (!paper) return [];
    return getDigitalPaperPages(paper);
  }, [paper]);

  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / SCREEN_WIDTH);
      if (page !== currentPage && page >= 0 && page < pages.length) {
        setCurrentPage(page);
      }
    },
    [currentPage, pages.length]
  );

  const goToPage = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  if (!paper) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.tabIconDefault} />
          <Text style={[styles.errorText, { color: theme.text }]}>Failed to load newspaper</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderPage = ({ item }: { item: string }) => (
    <View style={styles.pageContainer}>
      <ZoomableImage uri={item} onZoomChange={setIsZoomed} />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <Pressable
              style={styles.headerButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {paper.tenant.nativeName || paper.tenant.name}
              </Text>
              <Text style={styles.headerSubtitle}>
                Page {currentPage + 1} of {pages.length}
              </Text>
            </View>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>

        {/* Page Carousel using FlatList */}
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={renderPage}
          keyExtractor={(_, index) => `page-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isZoomed}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
        />

        {/* Page indicator */}
        <View style={styles.pageIndicator}>
          <View style={styles.pageIndicatorInner}>
            {pages.map((_, index) => (
              <Pressable
                key={index}
                style={[
                  styles.dot,
                  currentPage === index && styles.dotActive,
                ]}
                onPress={() => goToPage(index)}
              />
            ))}
          </View>
        </View>

        {/* Zoom hint */}
        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.zoomHintText}>
            Double-tap to zoom • Swipe to turn pages
          </Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSafeArea: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pageIndicatorInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
