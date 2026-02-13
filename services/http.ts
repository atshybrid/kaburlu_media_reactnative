import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Environment-based URL selection
const EXPLICIT_URL = process.env.EXPO_PUBLIC_API_URL; // Highest priority override
const DEV_URL = process.env.EXPO_PUBLIC_API_URL_DEV;  // Used only in dev when no explicit URL
const PROD_URL = process.env.EXPO_PUBLIC_API_URL_PROD; // Used only in prod when no explicit URL

// Helpful default for local development over LAN/USB
const devHost = (Constants.expoConfig?.hostUri ?? '').split(':')[0];
const defaultHost = devHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const FALLBACK_DEV_URL = `http://${defaultHost}:3000`;

const isDev = __DEV__ === true;

// In production builds we must use the final API host. This prevents accidental
// EAS environment overrides (or old configs) from pointing the app to a Cloudflare/
// Render endpoint that can block mobile traffic.
const EXPECTED_PROD_BASE_URL = 'https://api.kaburlumedia.com/api/v1';

const APP_UA = (() => {
  const v = Constants.expoConfig?.version || '0';
  // Keep this simple and consistent so Cloudflare/WAF rules can allowlist it.
  return `Kaburlu/${v} (${Platform.OS})`;
})();

// Resolve final base URL with sensible precedence
let BASE_URL =
  EXPLICIT_URL ||
  (isDev ? (DEV_URL || FALLBACK_DEV_URL) : (PROD_URL || FALLBACK_DEV_URL));

if (!isDev) {
  try {
    const u = new URL(String(BASE_URL));
    if (u.host !== 'api.kaburlumedia.com') {
      BASE_URL = EXPECTED_PROD_BASE_URL;
    }
  } catch {
    BASE_URL = EXPECTED_PROD_BASE_URL;
  }
}

export function getBaseUrl() {
  return BASE_URL;
}

// Debug controls
const DEBUG_HTTP = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
// Optional: log request body (can be large)
const DEBUG_HTTP_BODY = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG_BODY ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
// Optional: log full request body (VERY large). Prefer enabling only temporarily.
const DEBUG_HTTP_BODY_FULL = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG_BODY_FULL ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
const TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_HTTP_TIMEOUT_MS || '30000');
if (DEBUG_HTTP) {
  console.log('[HTTP] BASE_URL =', BASE_URL, '| DEV =', isDev);
}

export class HttpError extends Error {
  status: number;
  body?: any;
  retryAfterMs?: number;
  isCloudflare?: boolean;
  constructor(status: number, body?: any, message?: string, init?: { retryAfterMs?: number; isCloudflare?: boolean }) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
    if (init?.retryAfterMs != null) this.retryAfterMs = init.retryAfterMs;
    if (init?.isCloudflare != null) this.isCloudflare = init.isCloudflare;
  }
}

function isProbablyHtml(text: string): boolean {
  const t = text.trim().slice(0, 300).toLowerCase();
  return t.includes('<!doctype html') || t.includes('<html') || t.includes('<head') || t.includes('<title');
}

function isCloudflareChallenge(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('cloudflare') ||
    t.includes('just a moment') ||
    t.includes('attention required') ||
    t.includes('cf-ray') ||
    t.includes('/cdn-cgi/')
  );
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) return undefined;
  const raw = retryAfterHeader.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function safeApiHint(): string {
  try {
    const u = new URL(BASE_URL);
    const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '';
    return `${u.host}${path}`;
  } catch {
    return String(BASE_URL || '').slice(0, 80);
  }
}

// Simple error event emitter for toasts or global logging
type ErrorListener = (error: Error | HttpError, context: { path: string; method: HttpMethod }) => void;
const listeners = new Set<ErrorListener>();
export function onHttpError(listener: ErrorListener) { listeners.add(listener); return () => listeners.delete(listener); }
function emitError(err: Error | HttpError, context: { path: string; method: HttpMethod }) {
  // Log to Crashlytics (production only, lazy load to avoid initialization issues)
  if (!__DEV__) {
    const status = (err as HttpError)?.status || 0;
    // Skip 404 errors from Crashlytics
    if (status !== 404) {
      (async () => {
        try {
          const { logError } = await import('./crashlytics');
          await logError(err instanceof Error ? err : new Error(String(err)), {
            path: context.path,
            method: context.method,
            status: String(status),
          });
        } catch {
          // Silent fail - crashlytics not critical for error reporting
        }
      })();
    }
  }
  listeners.forEach(l => l(err, context));
}

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out')), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

// Keys must match services/auth.ts
const JWT_KEY = 'jwt';
const REFRESH_KEY = 'refreshToken';
const EXPIRES_AT_KEY = 'jwtExpiresAt';

function isAuthError(err: any): boolean {
  if (!(err instanceof HttpError)) return false;
  const s = err.status;
  const msg = String(err.body?.message || '').toLowerCase();
  return s === 401 || s === 403 || (s === 400 && (msg.includes('unauthor') || msg.includes('expired') || msg.includes('token')));
}

export async function tryRefreshJwt(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token');
  const res = await withTimeout(fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': APP_UA },
    body: JSON.stringify({ refreshToken }),
  }));
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new HttpError(res.status, json, json?.message || `HTTP ${res.status}`);
  const payload = json?.data ?? json;
  const token: string = payload?.jwt || payload?.token;
  const newRefresh: string = payload?.refreshToken || refreshToken;
  const expiresAt: number | undefined = payload?.expiresAt
    ?? (payload?.expiresInSec ? Date.now() + payload.expiresInSec * 1000 : undefined)
    ?? (payload?.expiresIn ? Date.now() + payload.expiresIn * 1000 : undefined);
  if (!token) throw new Error('Missing token in refresh response');
  await AsyncStorage.multiSet([
    [JWT_KEY, token],
    [REFRESH_KEY, newRefresh],
    [EXPIRES_AT_KEY, expiresAt ? String(expiresAt) : ''],
  ]);
  return token;
}

export async function clearStoredTokens() {
  await AsyncStorage.multiRemove([JWT_KEY, REFRESH_KEY, EXPIRES_AT_KEY]);
}

export async function request<T = any>(path: string, options: { method?: HttpMethod; body?: any; headers?: Record<string, string>; timeoutMs?: number; noAuth?: boolean } = {}): Promise<T> {
  const method: HttpMethod = options.method || 'GET';
  const jwt = options.noAuth ? null : await AsyncStorage.getItem(JWT_KEY);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': APP_UA,
    ...(options.headers || {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };

  const doOnce = async (): Promise<T> => {
    const url = `${BASE_URL}${path}`;
    const started = Date.now();
    if (DEBUG_HTTP) {
      console.log('[HTTP] →', method, url);
    }

     if (DEBUG_HTTP && options.body != null && method !== 'GET' && (DEBUG_HTTP_BODY || DEBUG_HTTP_BODY_FULL)) {
      try {
        const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        const len = bodyStr.length;
        const maxPreview = 600;
        const preview = bodyStr.slice(0, maxPreview);
        console.log('[HTTP]   body:', `(len=${len})`, preview);
        if (DEBUG_HTTP_BODY_FULL) {
          const maxFull = 20000;
          if (len > maxFull) {
            console.log('[HTTP]   body(full) truncated:', bodyStr.slice(0, maxFull));
          } else {
            console.log('[HTTP]   body(full):', bodyStr);
          }
        }
      } catch {
        // ignore logging failures
      }
    }

    let res: Response;
    try {
      res = await withTimeout(fetch(url, {
        method,
        headers,
        // Allow passing either an object (we JSON encode) or a pre-encoded string body.
        body: options.body
          ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
          : undefined,
      }), options.timeoutMs ?? TIMEOUT_MS);
    } catch (e: any) {
      const msg = String(e?.message || e || '').trim();
      const tagged = msg ? `${msg} (${method} ${url})` : `Request failed (${method} ${url})`;
      throw new Error(tagged);
    }
    const ct = res.headers.get('content-type') || '';
    const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
    const text = await res.text();
    let data: any = undefined;
    if (text) {
      const looksJson = ct.includes('application/json') || /^[\[{]/.test(text.trim());
      if (looksJson) {
        try { data = JSON.parse(text); }
        catch (e) {
          if (DEBUG_HTTP) console.warn('[HTTP] JSON parse failed', (e as Error)?.message || e);
          // keep raw text when parse fails
          data = text;
        }
      } else {
        data = text; // preserve non-JSON bodies (e.g., HTML error pages)
      }
    }
    if (DEBUG_HTTP) {
      const elapsed = Date.now() - started;
      const preview = typeof data === 'string'
        ? String(data).slice(0, 160).replace(/\n/g, ' ')
        : (data ? JSON.stringify(data).slice(0, 160).replace(/\n/g, ' ') : undefined);
      console.log('[HTTP] ←', method, url, res.status, `${elapsed}ms`, ct || '(no-ct)', preview ? `| body: ${preview}` : '');
    }
    if (!res.ok) {
      const isHtml = typeof data === 'string' && isProbablyHtml(data);
      const isCf = isHtml && typeof data === 'string' && isCloudflareChallenge(data);
      const message = isCf
        ? `Request blocked by Cloudflare protection (HTTP ${res.status}) on ${safeApiHint()}. Please try again shortly.`
        : (typeof data === 'string' ? data.slice(0, 200) : (data?.message || `HTTP ${res.status}`));
      throw new HttpError(res.status, data, message, { retryAfterMs, isCloudflare: isCf });
    }
    // Ensure we return parsed JSON; if body isn't JSON, error out so callers can handle explicitly
    if (typeof data === 'string') {
      const isHtml = isProbablyHtml(data);
      const isCf = isHtml && isCloudflareChallenge(data);
      const message = isCf
        ? `Request returned HTML (likely Cloudflare) (HTTP ${res.status}) on ${safeApiHint()}.`
        : 'Expected JSON response but received text';
      throw new HttpError(res.status, data, message, { retryAfterMs, isCloudflare: isCf });
    }
    return (data as T);
  };

  // Retry policy: retry up to 2 times on network errors or 5xx
  const maxRetries = 2;
  let attempt = 0;
  let attemptedRefresh = false;
  while (true) {
    try {
      return await doOnce();
    } catch (err: any) {
      const isHttp = err instanceof HttpError;
      const status = isHttp ? err.status : 0;
      // Handle auth errors by attempting a token refresh once per request
      // Skip auth refresh for noAuth requests (like login) - they handle 401 themselves
      if (!options.noAuth && !attemptedRefresh && isAuthError(err) && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
        try {
          const newJwt = await tryRefreshJwt();
          headers.Authorization = `Bearer ${newJwt}`;
          attemptedRefresh = true;
          // retry immediately with refreshed token
          continue;
        } catch {
          // Refresh failed: clear tokens and navigate to login (preserve user data)
          await clearStoredTokens();
          try { router.replace('/auth/login'); } catch {}
          emitError(err, { path, method });
          throw err;
        }
      }

      const retryAfter = isHttp ? (err as HttpError).retryAfterMs : undefined;
      const transient = !isHttp || (status >= 500 && status < 600) || status === 408 || status === 425 || status === 429;
      if (attempt < maxRetries && transient) {
        const base = retryAfter != null
          ? Math.min(Math.max(retryAfter, 500), 15000)
          : (300 * Math.pow(2, attempt) + Math.random() * 200);
        const backoff = Math.min(base, 15000);
        await new Promise(r => setTimeout(r, backoff));
        attempt++;
        continue;
      }
      emitError(err, { path, method });
      throw err;
    }
  }
}
