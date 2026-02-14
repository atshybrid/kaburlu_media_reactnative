import AnimatedArticle from '@/components/AnimatedArticle';
import { ArticleSkeleton } from '@/components/ui/ArticleSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { Colors } from '@/constants/Colors';
import { useCategory } from '@/context/CategoryContext';
import { useColorScheme } from '@/hooks/useColorScheme';
// import { sampleArticles } from '@/data/sample-articles';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { getNews } from '@/services/api';
import { ensureNotificationsSetupOnceAfterSplash } from '@/services/notifications';
import type { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import Spacing from '@/constants/Spacing';
import Typography from '@/constants/Typography';
import BorderRadius from '@/constants/BorderRadius';

const DEV_MODE = (() => {
  const raw = String(process.env.EXPO_PUBLIC_DEVELOPER_MODE ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();

const NewsScreen = () => {
  const router = useRouter();
  const { setTabBarVisible } = useTabBarVisibility();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  useEffect(() => {
    console.log('[NAV] ArticleScreen (news) mounted');
    // Always allow users to access the bottom navigation from News,
    // especially when there are 0 items (no swipe gestures available).
    try { setTabBarVisible(true); } catch {}
  }, []);

  // Handle screen focus - restore state when returning from comments modal
  useFocusEffect(
    useCallback(() => {
      console.log('[NAV] News screen focused - ensuring tab bar visible');
      // Ensure tab bar is visible when returning to news screen
      try { setTabBarVisible(true); } catch {}
      
      // Force a re-render to prevent blank screen after gesture back
      // This helps restore the animated article positions
      return () => {
        // Cleanup if needed
        console.log('[NAV] News screen unfocused');
      };
    }, [setTabBarVisible])
  );

  // Ask for push notification permission AFTER splash/intro (and only once).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      ensureNotificationsSetupOnceAfterSplash()
        .then((res) => {
          console.log('[NOTIF_INIT] (after splash) status', res.status, 
            'fcmToken?', !!res.fcmToken, 
            'expoToken?', !!res.expoToken);
          // FCM token is now preferred for Firebase backend
          if (res.fcmToken) {
            console.log('[NOTIF_INIT] Using FCM token:', res.fcmToken.substring(0, 20) + '...');
          }
        })
        .catch((e: any) => {
          console.log('[NOTIF_INIT] (after splash) failed', e?.message);
        });
    });
    return () => {
      try { (task as any)?.cancel?.(); } catch {}
    };
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);
  // Preserve active index ref to prevent reset on re-render after navigation
  const activeIndexRef = useRef(0);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [langLabel, setLangLabel] = useState<string>('');
  const [langCodeDebug, setLangCodeDebug] = useState<string>('');
  const [langRawDebug, setLangRawDebug] = useState<string>('');
  const { selectedCategory } = useCategory();
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);
  const loadSeqRef = useRef(0);
  const lastHeightRef = useRef(0);
  
  // Restore active index when screen regains focus (after returning from comments)
  useFocusEffect(
    useCallback(() => {
      // Restore the saved index position to prevent blank screen
      if (activeIndexRef.current !== activeIndex) {
        console.log('[NAV] Restoring activeIndex:', activeIndexRef.current);
        setActiveIndex(activeIndexRef.current);
        activeIndexShared.value = activeIndexRef.current;
      }
    }, [activeIndex, activeIndexShared])
  );
  
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h && Math.abs(h - lastHeightRef.current) > 1) {
      lastHeightRef.current = h;
      setPageHeight(h);
    }
  };

  const loadNews = async () => {
    const seq = ++loadSeqRef.current;
    const map: Record<string, string> = {
      top: 'Top',
      india: 'India',
      world: 'World',
      business: 'Business',
      tech: 'Technology',
      sports: 'Sports',
      ent: 'Entertainment',
    };
    // Treat "Top" as the default, i.e. no filter
    const mapped = selectedCategory ? (map[selectedCategory] || selectedCategory) : undefined;
    const filterKey = mapped && mapped.toLowerCase() === 'top' ? undefined : mapped;

    // Best practice: show cached short news immediately (stale-while-revalidate).
    // Only show skeleton when cache is empty.
    let langCode = 'en';
    let label = 'English';
    let hadCache = false;
    try {
      const stored = await AsyncStorage.getItem('selectedLanguage');
      if (__DEV__) {
        try { setLangRawDebug(String(stored || '')); } catch {}
      }
      if (stored) {
        try {
          const parsed: any = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            langCode = String(parsed.code || parsed.languageCode || parsed.slug || 'en');
            label = String(parsed.nativeName || parsed.name || langCode.toUpperCase());
          } else if (typeof parsed === 'string') {
            langCode = parsed;
            label = parsed.toUpperCase();
          }
        } catch {
          // raw might be a plain code string
          langCode = stored;
          label = stored.toUpperCase();
        }
      }
      if (__DEV__) {
        try { setLangCodeDebug(langCode); } catch {}
      }
      setLangLabel(label);

      // Try cached list first
      const cacheKey = `news_cache:${langCode}:${filterKey || 'all'}`;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Article[];
          if (Array.isArray(parsed) && parsed.length) {
            hadCache = true;
            // Apply same filter fallback logic as live response
            let filtered = filterKey
              ? parsed.filter((a) => (a.category || '').toLowerCase().includes(filterKey.toLowerCase()))
              : parsed;
            if (filterKey && filtered.length === 0) filtered = parsed;
            setArticles(filtered);
          }
        }
      } catch {
        // ignore cache read errors
      }

      if (seq !== loadSeqRef.current) return;
      setError(null);
      setLoading(!hadCache);

      // Fetch live (updates cache in services/api.ts)
      const list = await getNews(langCode, filterKey || undefined);
      const safe = Array.isArray(list) ? list : [];
      // If API doesn't filter by category, filter client-side as a fallback
      let filtered = filterKey
        ? safe.filter((a) => (a.category || '').toLowerCase().includes(filterKey.toLowerCase()))
        : safe;
      // Avoid an empty UI: if nothing matches the filter, show the full list
      if (filterKey && filtered.length === 0) {
        console.warn('[News] No items matched category filter, showing all');
        filtered = safe;
      }
      if (seq !== loadSeqRef.current) return;
      setArticles(filtered);
      console.log('[News] articles loaded:', filtered.length, '| lang=', langCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Failed to load news', msg);
      // If we already showed cached content, don't replace it with an error screen.
      if (!hadCache) {
        setError(msg || 'Failed to load news');
        setArticles([]);
      }
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
      try { setTabBarVisible(true); } catch {}
    }
  };

  useEffect(() => {
    loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // removed right-side language FAB state

  const handleSwipeUp = () => {
  if (activeIndex < articles.length - 1) {
      const newIndex = activeIndex + 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
      activeIndexRef.current = newIndex; // Preserve for navigation back
    }
  };

  const handleSwipeDown = () => {
  if (activeIndex > 0) {
      const newIndex = activeIndex - 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
      activeIndexRef.current = newIndex; // Preserve for navigation back
    }
  };

  const [showCongrats, setShowCongrats] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location && window.location.hash.includes('congrats')) {
      setShowCongrats(true);
      setTimeout(() => setShowCongrats(false), 2000);
    }
  }, []);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {showCongrats && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
          <LottieView source={require('@/assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 320, height: 320 }} />
        </View>
      )}
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {loading && (
          <ArticleSkeleton />
        )}
        {!loading && !error && articles.length === 0 && (
          <EmptyState
            icon="article"
            title={`No short news published yet${langLabel ? ` in ${langLabel}` : ''}`}
            description="Try changing language or pull to refresh"
            actionLabel="Change Language"
            onAction={() => {
              try { router.replace('/language'); } catch {}
            }}
          />
        )}
        {!loading && !error && articles.map((article, index) => (
          <AnimatedArticle
            key={article.id}
            article={article}
            index={index}
            activeIndex={activeIndexShared}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
            totalArticles={articles.length}
            forceVisible={index === 0}
            pageHeight={pageHeight}
          />
        ))}
        {!loading && error && (
          <ErrorState
            title="Failed to load news"
            message={error}
            onRetry={loadNews}
            retryLabel="Retry"
            variant="error"
          />
        )}
        {__DEV__ && DEV_MODE && (
          <View style={styles.debugOverlay} pointerEvents="none">
            <Text style={styles.debugText}>articles: {articles.length} | activeIndex: {activeIndex}</Text>
            <Text style={styles.debugText}>langCode: {langCodeDebug || '-'}</Text>
            <Text style={styles.debugText} numberOfLines={2}>selectedLanguage: {langRawDebug ? langRawDebug.slice(0, 120) : '-'}</Text>
          </View>
        )}
      </View>
      {/* Language FAB removed - center FAB now reflects language */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // background is set from theme inline
  },
  debugOverlay: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  debugText: { 
    color: '#fff', 
    fontSize: Typography.caption,
  },
});

export default NewsScreen;
