import { useState, useEffect, useCallback, useRef } from 'react';
import { safeApiCall, SafeApiOptions } from '@/services/safeApi';

export interface UseSafeApiOptions<T> extends SafeApiOptions<T> {
  /** Auto-fetch on mount (default: true) */
  immediate?: boolean;
  /** Dependencies for refetch */
  deps?: any[];
}

export interface UseSafeApiResult<T> {
  /** Response data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error if request failed */
  error: Error | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Safe data fetching hook - prevents crashes from API failures
 * Automatically handles loading, error, and success states
 * 
 * Critical for Google Play review compliance
 * 
 * @example
 * function ArticleList() {
 *   const { data: articles, loading, error, refetch } = useSafeApi(
 *     '/api/articles',
 *     { fallback: [] }
 *   );
 * 
 *   return (
 *     <SafeView loading={loading} error={error} empty={!articles?.length} onRetry={refetch}>
 *       <FlatList data={articles} {...} />
 *     </SafeView>
 *   );
 * }
 */
export function useSafeApi<T>(
  path: string | null,
  options: UseSafeApiOptions<T> = {}
): UseSafeApiResult<T> {
  const { immediate = true, deps = [], ...apiOptions } = options;
  
  const [data, setData] = useState<T | null>(options.fallback ?? null);
  const [loading, setLoading] = useState<boolean>(immediate && !!path);
  const [error, setError] = useState<Error | null>(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  
  const fetchData = useCallback(async () => {
    if (!path) {
      setData(options.fallback ?? null);
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeApiCall<T>(path, apiOptions);
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        // Keep previous data on error if available
        if (data === null && options.fallback !== undefined) {
          setData(options.fallback);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  const reset = useCallback(() => {
    setData(options.fallback ?? null);
    setLoading(false);
    setError(null);
  }, [options.fallback]);
  
  return {
    data,
    loading,
    error,
    refetch: fetchData,
    reset,
  };
}

/**
 * Hook for safe AsyncStorage access
 * Never throws - returns null on failure
 * 
 * @example
 * const { data: language, loading } = useAsyncStorage('selectedLanguage');
 */
export function useAsyncStorage(key: string) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const value = await AsyncStorage.getItem(key);
        setData(value);
      } catch (error) {
        console.error(`[useAsyncStorage] Failed to read "${key}":`, error);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);
  
  return { data, loading };
}
