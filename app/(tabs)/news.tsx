import AnimatedArticle from '@/components/AnimatedArticle';
import { ArticleSkeleton } from '@/components/ui/ArticleSkeleton';
import { Colors } from '@/constants/Colors';
import { useCategory } from '@/context/CategoryContext';
import { useColorScheme } from '@/hooks/useColorScheme';
// import { sampleArticles } from '@/data/sample-articles';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { getNews } from '@/services/api';
import type { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [langLabel, setLangLabel] = useState<string>('');
  const [langCodeDebug, setLangCodeDebug] = useState<string>('');
  const [langRawDebug, setLangRawDebug] = useState<string>('');
  const { selectedCategory } = useCategory();
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);
  const lastHeightRef = useRef(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h && Math.abs(h - lastHeightRef.current) > 1) {
      lastHeightRef.current = h;
      setPageHeight(h);
    }
  };

  const loadNews = async () => {
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
    setLoading(true);
    setError(null);
    try {
      const stored = await AsyncStorage.getItem('selectedLanguage');
      if (__DEV__) {
        try { setLangRawDebug(String(stored || '')); } catch {}
      }
      let langCode = 'en';
      let label = 'English';
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
      setArticles(filtered);
      console.log('[News] articles loaded:', filtered.length, '| lang=', langCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Failed to load news', msg);
      setError(msg || 'Failed to load news');
      setArticles([]);
    } finally {
      setLoading(false);
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
    }
  };

  const handleSwipeDown = () => {
  if (activeIndex > 0) {
      const newIndex = activeIndex - 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
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
          <View style={styles.centerMessage}>
            <Text style={[styles.messageText, { color: theme.text }]}>No short news published yet{langLabel ? ` in ${langLabel}` : ''}.</Text>
            <Text style={[styles.messageSubText, { color: theme.muted }]}>Try changing language or refresh.</Text>
            <View style={styles.actionsRow}>
              <Text
                style={[styles.actionBtn, { color: theme.text, borderColor: theme.border }]}
                onPress={() => {
                  try { router.replace('/language'); } catch {}
                }}
              >
                Change language
              </Text>
              <Text
                style={[styles.actionBtn, { color: theme.text, borderColor: theme.border }]}
                onPress={() => {
                  loadNews();
                }}
              >
                Retry
              </Text>
            </View>
          </View>
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
          <View style={styles.centerMessage}>
            <Text style={[styles.messageText, { color: theme.text }]}>Failed to load news.</Text>
            <Text style={[styles.messageSubText, { color: theme.muted }]} numberOfLines={3}>{error}</Text>
          </View>
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
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  messageText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  messageSubText: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: '600',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  debugText: { color: '#fff', fontSize: 12 },
});

export default NewsScreen;
