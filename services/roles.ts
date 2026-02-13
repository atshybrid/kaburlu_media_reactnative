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

  // CITIZEN_REPORTER uses the old explore/short news flow
  if (r === 'CITIZEN_REPORTER' || r.includes('CITIZEN')) return false;

  // PUBLIC_FIGURE has own dashboard, no post-news access
  if (r === 'PUBLIC_FIGURE' || r.includes('PUBLIC_FIGURE')) return false;

  // These roles can access AI Rewrite (4 screens) post-news flow
  const allowed = new Set([
    'TENANT_ADMIN',
    'REPORTER',
    'CHIEF_EDITOR',
    'CHIF_EDITOR', // tolerate common typo
    'DESK_EDITOR',
  ]);
  if (allowed.has(r)) return true;

  // Tolerant matching for variants
  if (r.includes('TENANT') && r.includes('ADMIN')) return true;
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

export function isPublicFigure(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === 'PUBLIC_FIGURE' || r.includes('PUBLIC_FIGURE');
}

export function getPublicFigureIdFromName(name: string | null | undefined): string {
  const n = String(name || '').toLowerCase().trim();
  if (n.includes('bandi') || n.includes('sanjay')) return 'bandisanjay';
  if (n.includes('revanth') || n.includes('cm') || n.includes('chief')) return 'cm';
  if (n.includes('ktr') || n.includes('rama rao')) return 'ktr';
  return 'bandisanjay'; // default
}
