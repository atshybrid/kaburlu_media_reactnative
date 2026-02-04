import { ApiErrorShape } from '../types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL placeholder - override via env or runtime injection
const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.yourdomain.com';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions<TBody = any> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  auth?: boolean; // include Authorization header if true
  signal?: AbortSignal;
  // Raw mode (skip JSON) could be added later if needed
}

let authToken: string | undefined; // backend session/JWT (NOT firebase custom token)

export function setAuthToken(token?: string) { authToken = token; }
export function getAuthToken() { return authToken; }

async function parseJsonSafe(resp: Response) {
  const text = await resp.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

export class HttpError extends Error implements ApiErrorShape {
  status?: number;
  code?: string;
  retryable?: boolean;
  constructor(message: string, init?: Partial<ApiErrorShape>) {
    super(message);
    Object.assign(this, init);
  }
}

export async function http<TResp = any, TBody = any>(path: string, opts: RequestOptions<TBody> = {}): Promise<TResp> {
  const base = DEFAULT_BASE_URL.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...opts.headers,
  };
  if (opts.auth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // Add timeout (60 seconds for AI requests)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  const fetchInit: RequestInit = {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    signal: opts.signal || controller.signal,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };

  let resp: Response;
  try {
    console.log(`[HTTP ${fetchInit.method}] ${url}`);
    if (opts.body) {
      console.log('[HTTP Body]', JSON.stringify(opts.body).substring(0, 200));
    }
    
    resp = await fetch(url, fetchInit);
    clearTimeout(timeoutId);
    
    console.log(`[HTTP Response] ${resp.status} ${resp.statusText}`);
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new HttpError('Request timeout - please try again', { retryable: true });
    }
    throw new HttpError(e?.message || 'Network error', { retryable: true });
  }
  const json = await parseJsonSafe(resp);
  if (!resp.ok) {
    const message = (json && (json.message || json.error)) || `Request failed (${resp.status})`;
    console.error('[HTTP Error]', message, json);
    
    // Handle 401 Unauthorized - token expired
    if (resp.status === 401) {
      console.warn('[HTTP] 401 Unauthorized - Token expired');
      // Clear tokens asynchronously to prevent blocking
      AsyncStorage.multiRemove(['jwt', 'refreshToken', 'expiresAt', 'languageId', 'user', 'session'])
        .catch(e => console.error('[HTTP] Failed to clear tokens:', e));
    }
    
    throw new HttpError(message, { status: resp.status, code: json?.code, retryable: resp.status >= 500 });
  }
  return json as TResp;
}

// Convenience helpers
export const get = <T = any>(path: string, opts?: RequestOptions) => http<T>(path, { ...(opts || {}), method: 'GET' });
export const post = <T = any, B = any>(path: string, body?: B, opts?: RequestOptions) => http<T, B>(path, { ...(opts || {}), body, method: 'POST' });

// TODO: add put/patch/delete if needed later.
