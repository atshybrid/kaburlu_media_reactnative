import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_ROLE_KEY = 'profile_role';

export function normalizeRole(role: string | null | undefined): string {
  return String(role || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

export function canAccessPostNewsByRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (!r) return false;

  // Exact matches (expected backend role enums)
  const allowed = new Set([
    'TENANT_ADMIN',
    'TENANT_EDITOR',
    'CHIEF_EDITOR',
    'DESK_EDITOR',
    'REPORTER',
    'CHIEF_EDITOR',
    'CHIF_EDITOR', // tolerate common typo
    // tolerant legacy/alt names
    'TENANT_REPORTER',
    'NEWS_DESK',
    'NEWS_DESK_EDITOR',
    'NEWS_DESK_USER',
    'NEWSDESK',
  ]);
  if (allowed.has(r)) return true;

  // Tolerant matching for variants
  if (r.includes('TENANT') && r.includes('ADMIN')) return true;
  if (r.includes('TENANT') && r.includes('EDITOR')) return true;
  if (r.includes('NEWS') && r.includes('DESK')) return true;
  if (r.includes('CHIEF') && r.includes('EDITOR')) return true;
  if (r.includes('DESK') && r.includes('EDITOR')) return true;

  return false;
}

export async function getCachedProfileRole(): Promise<string> {
  try {
    return String((await AsyncStorage.getItem(PROFILE_ROLE_KEY)) || '').trim();
  } catch {
    return '';
  }
}
