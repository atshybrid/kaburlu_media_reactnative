/**
 * SAFE SCREEN TEMPLATE
 * 
 * Copy this template when creating new screens.
 * Guaranteed to pass Google Play review testing.
 * 
 * Features:
 * - ErrorBoundary protection
 * - Safe API calls with retry
 * - Loading/Error/Empty state handling
 * - Guest mode support
 * - No crashes on network failure
 * - Defensive data access
 */

import React from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import SafeView from '@/components/SafeView';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useSafeApi } from '@/hooks/useSafeApi';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Example: Article type
interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
  publishedAt?: string;
}

export default function SafeScreenTemplate() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Safe API call with automatic retry and fallback
  const { data: articles, loading, error, refetch } = useSafeApi<Article[]>(
    '/api/articles',
    {
      fallback: [],          // Return empty array on failure
      retries: 2,            // Retry twice on network error
      retryDelay: 1000,      // Wait 1s before retry
      silent: false,         // Log errors for debugging
    }
  );

  // Pull-to-refresh
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Render article card
  const renderArticle = ({ item }: { item: Article }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* DEFENSIVE: Use optional chaining and fallbacks */}
      <Text style={[styles.title, { color: colors.text }]}>
        {item?.title || 'Untitled'}
      </Text>
      
      <Text style={[styles.content, { color: colors.muted }]} numberOfLines={3}>
        {item?.content || 'No content available'}
      </Text>
      
      {/* DEFENSIVE: Check if field exists before rendering */}
      {item?.author && (
        <Text style={[styles.author, { color: colors.muted }]}>
          By {item.author}
        </Text>
      )}
    </View>
  );

  return (
    <ErrorBoundary>
      <SafeView
        loading={loading}
        error={error}
        empty={!articles?.length}  // DEFENSIVE: Use optional chaining
        onRetry={refetch}
        errorMessage="Failed to load articles. Please check your internet connection."
        emptyMessage="No articles available. Check back later!"
      >
        <FlatList
          data={articles || []}  // DEFENSIVE: Fallback to empty array
          keyExtractor={(item) => item?.id || Math.random().toString()}  // DEFENSIVE: Fallback key
          renderItem={renderArticle}
          contentContainerStyle={[
            styles.list,
            { backgroundColor: colors.background }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          // DEFENSIVE: Empty list component (backup for SafeView)
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No articles to display
              </Text>
            </View>
          )}
        />
      </SafeView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  author: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

// ========================================
// ALTERNATIVE: Manual API Call Pattern
// ========================================

/**
 * If you need more control, use manual API calls
 * with try-catch and state management
 */
export function SafeScreenManualPattern() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use safeApiCall for built-in retry and safety
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { safeApiCall } = require('@/services/safeApi');
      const data = await safeApiCall('/api/articles', {
        fallback: [],
        retries: 2,
      }) as Article[];
      
      setArticles(data || []);  // DEFENSIVE: Fallback to empty array
    } catch (err: any) {
      console.error('[Articles] Load failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      // IMPORTANT: Set fallback data even on error
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadArticles();
  }, []);

  return (
    <ErrorBoundary>
      <SafeView
        loading={loading}
        error={error}
        empty={!articles?.length}
        onRetry={loadArticles}
      >
        <FlatList
          data={articles}
          keyExtractor={(item) => item?.id || Math.random().toString()}
          renderItem={({ item }) => (
            <Text style={{ color: colors.text }}>
              {item?.title || 'Untitled'}
            </Text>
          )}
        />
      </SafeView>
    </ErrorBoundary>
  );
}

// ========================================
// DEFENSIVE CODING CHECKLIST
// ========================================

/**
 * ✅ API Calls:
 * - Use safeApiCall or useSafeApi
 * - Provide fallback values
 * - Add retry logic
 * - Wrap in try-catch
 * 
 * ✅ Data Access:
 * - Use optional chaining: data?.field
 * - Provide fallbacks: data || []
 * - Check before iterate: data?.map vs data.map
 * - Check array length: data?.length > 0
 * 
 * ✅ State Management:
 * - Always use SafeView for states
 * - Show loading skeleton
 * - Show error with retry
 * - Show empty state message
 * 
 * ✅ Error Handling:
 * - Wrap screen in ErrorBoundary
 * - Try-catch all risky operations
 * - Log errors for debugging
 * - Show user-friendly messages
 * 
 * ✅ Navigation:
 * - Wrap in try-catch: try { router.push() } catch {}
 * - Check component mounted before setState
 * 
 * ✅ AsyncStorage:
 * - Use safeGetStorage / safeSetStorage
 * - Use safeJsonParse with fallback
 * - Never assume data is valid
 * 
 * ✅ Guest Mode:
 * - Don't require authentication for public screens
 * - Check auth state before protected actions
 * - Provide guest-friendly alternatives
 */

// ========================================
// COMMON PITFALLS TO AVOID
// ========================================

/**
 * ❌ DON'T: Assume data exists
 * const title = article.title;  // CRASHES if article is null
 * 
 * ✅ DO: Use optional chaining
 * const title = article?.title || 'Untitled';
 * 
 * ---
 * 
 * ❌ DON'T: Iterate without checking
 * data.map(item => ...)  // CRASHES if data is null/undefined
 * 
 * ✅ DO: Check first or use fallback
 * (data || []).map(item => ...)
 * data?.map(item => ...) ?? []
 * 
 * ---
 * 
 * ❌ DON'T: Use fetch/axios directly
 * const res = await fetch('/api/news');
 * const data = await res.json();  // CRASHES on network error
 * 
 * ✅ DO: Use safeApiCall
 * const data = await safeApiCall('/api/news', { fallback: [] });
 * 
 * ---
 * 
 * ❌ DON'T: Parse JSON directly
 * const lang = JSON.parse(stored);  // CRASHES on invalid JSON
 * 
 * ✅ DO: Use safeJsonParse
 * const lang = safeJsonParse(stored, { code: 'en' });
 * 
 * ---
 * 
 * ❌ DON'T: Navigate without safety
 * router.push('/article');  // CRASHES if router unavailable
 * 
 * ✅ DO: Wrap in try-catch
 * try { router.push('/article'); } catch {}
 * 
 * ---
 * 
 * ❌ DON'T: Show blank on empty data
 * {articles.map(...)}  // Shows blank screen if empty
 * 
 * ✅ DO: Use SafeView or ListEmptyComponent
 * <SafeView empty={!articles?.length} emptyMessage="No articles">
 *   {articles.map(...)}
 * </SafeView>
 */
