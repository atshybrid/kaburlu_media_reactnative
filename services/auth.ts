import AsyncStorage from '@react-native-async-storage/async-storage';
import { request } from './http';

export type Tokens = {
  jwt: string;
  refreshToken: string;
  // epoch millis when the jwt expires
  expiresAt?: number;
  // optional extras we persist if provided by backend
  languageId?: string;
  user?: any;
  // optional session payload (e.g., tenant/domain/domainSettings)
  session?: any;
};

const JWT_KEY = 'jwt';
const REFRESH_KEY = 'refreshToken';
const EXPIRES_AT_KEY = 'jwtExpiresAt';
const LANGUAGE_ID_KEY = 'authLanguageId';
const USER_JSON_KEY = 'authUserJSON';
const SESSION_JSON_KEY = 'authSessionJSON';

export async function saveTokens(t: Tokens) {
  const items: [string, string][] = [
    [JWT_KEY, t.jwt],
    [REFRESH_KEY, t.refreshToken],
    [EXPIRES_AT_KEY, t.expiresAt ? String(t.expiresAt) : ''],
  ];
  if (t.languageId) items.push([LANGUAGE_ID_KEY, t.languageId]);
  if (t.user) items.push([USER_JSON_KEY, JSON.stringify(t.user)]);
  if (t.session) items.push([SESSION_JSON_KEY, JSON.stringify(t.session)]);
  await AsyncStorage.multiSet(items);
}

export async function loadTokens(): Promise<Tokens | null> {
  const [[, jwt], [, refreshToken], [, expiresAtStr], [, languageId], [, userJson], [, sessionJson]] = await AsyncStorage.multiGet([
    JWT_KEY,
    REFRESH_KEY,
    EXPIRES_AT_KEY,
    LANGUAGE_ID_KEY,
    USER_JSON_KEY,
    SESSION_JSON_KEY,
  ]);
  if (!jwt || !refreshToken) return null;
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : undefined;
  const user = userJson ? JSON.parse(userJson) : undefined;
  const session = sessionJson ? JSON.parse(sessionJson) : undefined;
  return { jwt, refreshToken, expiresAt, languageId: languageId || undefined, user, session };
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([JWT_KEY, REFRESH_KEY, EXPIRES_AT_KEY, LANGUAGE_ID_KEY, USER_JSON_KEY, SESSION_JSON_KEY]);
}

// Soft logout: keep non-auth profile data & last used mobile number for faster re-login.
// Provide mobile explicitly so caller can prefill login screen later.
export async function softLogout(preserveKeys: string[] = [] , mobileNumber?: string) {
  // Keys we always preserve: selectedLanguage, profile_role, profile_name, etc.
  // Remove only auth token keys defined above.
  await clearTokens();
  if (mobileNumber) {
    try { await AsyncStorage.setItem('last_login_mobile', mobileNumber); } catch {}
  }
  // Optionally re-persist keys requested if they were inadvertently removed (none by default now)
  if (preserveKeys.length) {
    // No-op placeholder for future extension
  }
}

export async function getLastMobile(): Promise<string | null> {
  try { return (await AsyncStorage.getItem('last_login_mobile')) || null; } catch { return null; }
}

export function isExpired(expiresAt?: number, skewSec = 60): boolean {
  if (!expiresAt) return false; // if server didn't provide, treat as non-expiring
  const now = Date.now();
  return now >= (expiresAt - skewSec * 1000);
}

export type RefreshResponse = {
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
  expiresInSec?: number;
  expiresIn?: number;
  // backend may wrap in { success, data }
  success?: boolean;
  data?: { jwt?: string; token?: string; refreshToken?: string; expiresAt?: number; expiresIn?: number; expiresInSec?: number };
};
export async function refreshTokens(): Promise<Tokens> {
  const current = await loadTokens();
  if (!current) throw new Error('No tokens');
  const res = await request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: current.refreshToken },
  });
  const payload = (res as any)?.data ?? res;
  const jwt = payload.jwt || payload.token;
  const nextRefresh = payload.refreshToken || current.refreshToken;
  const expiresAt = payload.expiresAt
    ?? (payload.expiresInSec ? Date.now() + payload.expiresInSec * 1000 : undefined)
    ?? (payload.expiresIn ? Date.now() + payload.expiresIn * 1000 : undefined);
  const next: Tokens = {
    jwt,
    refreshToken: nextRefresh,
    expiresAt,
    languageId: payload.languageId || current.languageId,
    user: payload.user || current.user,
  };
  await saveTokens(next);
  return next;
}

// Role verification utilities
export async function getCurrentUserRole(): Promise<string | null> {
  try {
    const tokens = await loadTokens();
    return tokens?.user?.role || null;
  } catch {
    return null;
  }
}

export async function isCitizenReporter(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === 'CITIZEN_REPORTER';
}

export async function requireCitizenReporter(): Promise<boolean> {
  const isReporter = await isCitizenReporter();
  if (!isReporter) {
    console.warn('[AUTH] Access denied: CITIZEN_REPORTER role required');
  }
  return isReporter;
}

// Comprehensive check for post article access
export async function checkPostArticleAccess(): Promise<{
  canAccess: boolean;
  reason?: string;
  isGuest: boolean;
  hasToken: boolean;
  hasValidRole: boolean;
}> {
  try {
    // Check if tokens exist
    const tokens = await loadTokens();
    const hasToken = !!tokens?.jwt;
    
    // Check role
    const role = tokens?.user?.role;
    const hasValidRole = role === 'CITIZEN_REPORTER';
    const isGuest = !hasToken || role === 'Guest' || !role;
    
    // If guest user, definitely redirect to login
    if (isGuest) {
      return {
        canAccess: false,
        reason: 'Guest user - authentication required',
        isGuest: true,
        hasToken,
        hasValidRole: false
      };
    }
    
    // Check if token is expired
    if (tokens?.expiresAt && isExpired(tokens.expiresAt)) {
      return {
        canAccess: false,
        reason: 'Token expired - re-authentication required',
        isGuest: false,
        hasToken: false,
        hasValidRole
      };
    }
    
    // Check role authorization
    if (!hasValidRole) {
      return {
        canAccess: false,
        reason: 'Insufficient permissions - CITIZEN_REPORTER role required',
        isGuest: false,
        hasToken,
        hasValidRole: false
      };
    }
    
    return {
      canAccess: true,
      isGuest: false,
      hasToken: true,
      hasValidRole: true
    };
    
  } catch (error) {
    console.warn('[AUTH] checkPostArticleAccess failed:', error);
    return {
      canAccess: false,
      reason: 'Authentication check failed',
      isGuest: true,
      hasToken: false,
      hasValidRole: false
    };
  }
}

// ----------------------------
// FRESH INSTALL DETECTION
// ----------------------------
// On iOS, Keychain/AsyncStorage can persist through app reinstall.
// This creates a "fresh install marker" to detect if user uninstalled/reinstalled.
const INSTALL_MARKER_KEY = 'app_install_marker';
const INSTALL_VERSION = '1'; // Bump this to force a fresh start on next update if needed

/**
 * Check if this is a fresh install and clear stale data if so.
 * Should be called early in app boot (e.g., splash screen).
 * Returns true if data was cleared.
 */
export async function checkAndClearOnFreshInstall(): Promise<boolean> {
  try {
    const marker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
    
    if (marker === INSTALL_VERSION) {
      // Same install, nothing to do
      return false;
    }
    
    // Fresh install or version bump - clear ALL app data
    console.log('[AUTH] Fresh install detected, clearing all app data...');
    
    // Get all keys
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Clear everything except essential onboarding keys
    const keysToPreserve = [
      'selectedLanguage',       // Keep language selection
      'last_login_mobile',      // Keep last mobile for convenience
      'app_sound_muted',        // Keep sound preference
    ];
    
    const keysToRemove = allKeys.filter(k => !keysToPreserve.includes(k));
    
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('[AUTH] Cleared', keysToRemove.length, 'stale keys');
    }
    
    // Set the marker for future boots
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, INSTALL_VERSION);
    console.log('[AUTH] Fresh install cleanup complete');
    
    return true;
  } catch (e) {
    console.warn('[AUTH] checkAndClearOnFreshInstall failed:', e);
    // Still set marker to avoid repeating
    try { await AsyncStorage.setItem(INSTALL_MARKER_KEY, INSTALL_VERSION); } catch {}
    return false;
  }
}

/**
 * Force clear all app data (for debug/logout flows)
 */
export async function clearAllAppData(): Promise<void> {
  try {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, INSTALL_VERSION);
    console.log('[AUTH] All app data cleared');
  } catch (e) {
    console.warn('[AUTH] clearAllAppData failed:', e);
  }
}
