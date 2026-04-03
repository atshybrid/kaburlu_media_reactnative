/**
 * Category Deep-Link Screen — /category/:slug
 *
 * Handles Android App Links and custom-scheme links that target a news category:
 *   https://kaburlumedia.com/category/<slug>
 *   https://www.kaburlumedia.com/category/<slug>
 *   kaburlu://category/<slug>
 *
 * Renders matched articles for the category. Gracefully handles missing or
 * invalid slugs so the app never crashes from a bad deep link.
 */

import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Article } from '@/types';
import { getArticlesByCategory } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Format a raw slug string into a human-readable title */
function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CategoryScreen() {
  // `slug` may be undefined/null if the deep link was malformed — handle safely
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: missing slug → show error, do not crash
    if (!slug) {
      setError('Category not found.');
      setLoading(false);
      return;
    }

    console.log('[CATEGORY] Fetching slug:', slug);

    getArticlesByCategory(slug)
      .then((data) => {
        setArticles(data ?? []);
        setError(null);
      })
      .catch((err: Error) => {
        console.warn('[CATEGORY] Fetch error:', err.message);
        setError(err.message || 'Failed to load category. Please check your connection.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleRetry = () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getArticlesByCategory(slug)
      .then((data) => {
        setArticles(data ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  };

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ErrorState message={error} onRetry={slug ? handleRetry : undefined} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backButton}
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {slug ? slugToTitle(slug) : 'Category'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Article list */}
      <FlatList
        data={articles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No articles found in this category.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.articleCard}
            onPress={() =>
              router.push({ pathname: '/article/[id]', params: { id: String(item.id) } })
            }
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.articleTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.category ? (
              <Text style={styles.articleMeta}>{item.category}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: '#333',
    lineHeight: 32,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 34, android: 16, default: 16 }),
  },
  articleCard: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    lineHeight: 22,
  },
  articleMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
});
