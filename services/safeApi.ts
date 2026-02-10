import { http, RequestOptions } from '@/api/httpClient';

/**
 * Safe API Wrapper - prevents crashes from network failures
 * - Automatic retry on network errors
 * - Timeout protection
 * - Safe fallback values
 * - No crashes on slow/no internet
 * 
 * Critical for Google Play review compliance
 */

export interface SafeApiOptions<T> extends RequestOptions {
  /** Number of retry attempts (default: 2) */
  retries?: number;
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Fallback value if all attempts fail */
  fallback?: T;
  /** Silent mode - don't log errors */
  silent?: boolean;
}

/**
 * Safe API call with automatic retry
 * Returns fallback value instead of throwing on failure
 * 
 * @example
 * const articles = await safeApiCall('/api/news', {
 *   fallback: [],
 *   retries: 2
 * });
 */
export async function safeApiCall<T>(
  path: string,
  options: SafeApiOptions<T> = {}
): Promise<T> {
  const {
    retries = 2,
    retryDelay = 1000,
    fallback,
    silent = false,
    ...requestOpts
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await http<T>(path, requestOpts);
      return result;
    } catch (error: any) {
      lastError = error;
      
      const isLastAttempt = attempt === retries;
      const shouldRetry = error?.retryable !== false && !isLastAttempt;
      
      if (!silent) {
        console.warn(
          `[SafeAPI] Attempt ${attempt + 1}/${retries + 1} failed:`,
          error?.message || error
        );
      }
      
      if (shouldRetry) {
        // Wait before retry (exponential backoff)
        const delay = retryDelay * Math.pow(2, attempt);
        if (!silent) {
          console.log(`[SafeAPI] Retrying in ${delay}ms...`);
        }
        await sleep(delay);
        continue;
      }
      
      // All attempts failed
      break;
    }
  }
  
  // Return fallback instead of throwing
  if (fallback !== undefined) {
    if (!silent) {
      console.warn('[SafeAPI] All attempts failed, using fallback:', fallback);
    }
    return fallback;
  }
  
  // No fallback - throw the last error
  throw lastError || new Error('Request failed');
}

/**
 * Safe API call that NEVER throws
 * Always returns { data, error } tuple
 * 
 * @example
 * const { data, error } = await safeApiCallNoThrow('/api/news', { fallback: [] });
 * if (error) {
 *   console.error('Failed to load news:', error);
 * }
 */
export async function safeApiCallNoThrow<T>(
  path: string,
  options: SafeApiOptions<T> = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await safeApiCall(path, options);
    return { data, error: null };
  } catch (error: any) {
    return {
      data: options.fallback ?? null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Check if device has internet connectivity
 * Returns false on network error (safe for offline testing)
 */
export async function hasInternet(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type-safe wrapper for AsyncStorage with error handling
 * Never throws - returns null on failure
 */
export async function safeGetStorage(key: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`[SafeAPI] Failed to read storage key "${key}":`, error);
    return null;
  }
}

/**
 * Type-safe wrapper for AsyncStorage setItem
 * Never throws - logs error and continues
 */
export async function safeSetStorage(key: string, value: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`[SafeAPI] Failed to write storage key "${key}":`, error);
    return false;
  }
}

/**
 * Safe JSON parse - returns fallback on error
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
