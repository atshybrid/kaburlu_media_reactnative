import { ThemedText } from '@/components/ThemedText';
import { showToast } from '@/components/Toast';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { aiRewriteUnified, getCategoryNamesForAI, type AIRewriteUnifiedResponse } from '@/services/aiRewriteUnified';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useFocusEffect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AiRewriteResponse = {
  category?: string;
  title?: string;
  subtitle?: string;
  lead?: string;
  highlights?: string[];
  article?: {
    location_date?: string;
    body?: string;
  };
};

const POST_NEWS_TENANT_NAME_KEY = 'post_news_tenant_name';
const POST_NEWS_TENANT_NATIVE_NAME_KEY = 'post_news_tenant_native_name';
const POST_NEWS_TENANT_PRIMARY_COLOR_KEY = 'post_news_tenant_primary_color';

function isValidHexColor(s: string): boolean {
  const v = String(s || '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
}

/**
 * Safe navigation back based on user role
 * Prevents tenant admin from landing on reporter dashboard (403 error)
 */
async function navigateBack(router: ReturnType<typeof useRouter>) {
  try {
    const tokens = await loadTokens();
    const role = tokens?.decodedAccessToken?.role;
    
    // Check if we can go back in the navigation stack
    if (router.canGoBack()) {
      router.back();
      return;
    }
    
    // If no back history, route to appropriate dashboard
    if (role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') {
      router.replace('/tenant/dashboard' as any);
    } 
    else if (role === 'REPORTER') {
      router.replace('/reporter/dashboard' as any);
    }
    else {
      router.replace('/news' as any);
    }
  } catch (e) {
    console.error('[navigateBack] Error:', e);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/news' as any);
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOuterStars(input: string): string {
  let s = String(input || '').trim();
  if (!s) return '';
  // Remove pasted emphasis wrappers like "* text *" or "*text*".
  while (s.startsWith('*')) s = s.slice(1).trimStart();
  while (s.endsWith('*')) s = s.slice(0, -1).trimEnd();
  return s;
}

function stripSensitiveFromAiText(input: string, opts: { tenantName?: string; tenantNativeName?: string }): string {
  const raw = String(input || '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return '';

  const tenantNames = [opts.tenantName, opts.tenantNativeName]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const months = [
    // English
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
    // Telugu
    'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జులై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్',
  ];

  const monthWordRe = new RegExp(`\\b(?:${months.map(escapeRegExp).join('|')})\\b`, 'giu');
  const numericDateRe = /\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/g;
  const isoDateRe = /\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/g;
  const dayYearRe = /\b\d{1,2}\s*,?\s*\d{4}\b/g;

  const looksSensitive = (line: string): boolean => {
    if (monthWordRe.test(line)) return true;
    if (numericDateRe.test(line)) return true;
    if (isoDateRe.test(line)) return true;
    if (dayYearRe.test(line)) return true;
    return false;
  };

  const cleanedLines = raw.split('\n').map((line, idx) => {
    let s = String(line || '');

    // Remove tenant branding / native name (don’t send to AI)
    for (const nm of tenantNames) {
      const re = new RegExp(escapeRegExp(nm), 'giu');
      s = s.replace(re, '');
    }

    // If the user pasted a date-line/month line at the top, drop it completely.
    if (idx < 3 && looksSensitive(s)) return '';

    // Otherwise, strip month/date tokens inline.
    s = s.replace(monthWordRe, '');
    s = s.replace(isoDateRe, '');
    s = s.replace(numericDateRe, '');
    s = s.replace(dayYearRe, '');

    // Clean punctuation/whitespace artifacts.
    s = s.replace(/[\s\t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1');
    s = s.replace(/^[\s,.;:!?\-–—]+/, '').replace(/[\s,.;:!?\-–—]+$/, '');
    return s;
  });

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizePlaceCandidate(input: string): string {
  let s = String(input || '').trim();
  if (!s) return '';
  s = s
    .replace(/^[\s\(\)\[\]{}:：]+/, '')
    .replace(/[\s\(\)\[\]{}:：]+$/g, '')
    .trim();
  if (!s) return '';
  if (!/\p{L}/u.test(s)) return '';
  return s;
}

function extractPlaceFromLocationDate(locationDate?: string): string {
  const s = String(locationDate || '').trim();
  if (!s) return '';
  // Example: "కామారెడ్డి జిల్లా, జనవరి 7" => "కామారెడ్డి"
  const first = s.split(',')[0] || '';
  let place = sanitizePlaceCandidate(first);
  if (!place) return '';
  
  // Strip hierarchy words (జిల్లా, మండలం, గ్రామం, రాష్ట్రం, district, mandal, village, state)
  // so API search gets clean location name
  const hierarchyRe = /\s*(జిల్లా|మండలం|గ్రామం|రాష్ట్రం|district|mandal|village|state)\s*$/i;
  place = place.replace(hierarchyRe, '').trim();
  
  return place;
}

type ParsedPastedNews = {
  title?: string;
  subtitle?: string;
  body?: string;
  bullets: string[];
  placeQuery?: string;
};

/**
 * Parse pasted Telugu/English news article.
 *
 * Expected structure:
 *   Line 1: Title
 *   Line 2: Subtitle
 *   Line 3..N (before date line): Bullet points / headlines
 *   Date line: location + month + date (e.g., "కామారెడ్డి జిల్లా జనవరి 07:")
 *   Lines after date line: Body content
 */
function parsePastedNews(raw: string, opts?: { tenantName?: string; tenantNativeName?: string }): ParsedPastedNews {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const rawLines = text.split('\n').map((l) => stripOuterStars(String(l || '')));

  const out: ParsedPastedNews = { bullets: [] };
  if (!rawLines.length) return out;

  // Regexes for detecting date line
  const hierarchyRe = /(జిల్లా|మండలం|గ్రామం|రాష్ట్రం|district|mandal|village|state)/i;
  const monthRe = /(january|february|march|april|may|june|july|august|september|october|november|december|జనవరి|ఫిబ్రవరి|మార్చి|ఏప్రిల్|మే|జూన్|జులై|ఆగస్టు|సెప్టెంబర్|అక్టోబర్|నవంబర్|డిసెంబర్)/i;
  const dayNumberRe = /\d{1,2}/;

  const tn = String(opts?.tenantName || '').trim();
  const tnn = String(opts?.tenantNativeName || '').trim();

  // Date line = line that has (hierarchy word OR month+day)
  const looksLikeDateLine = (line: string): boolean => {
    const s = String(line || '').trim();
    if (!s) return false;
    // Must have month + day number, or hierarchy word + day number
    const hasMonth = monthRe.test(s);
    const hasDay = dayNumberRe.test(s);
    const hasHierarchy = hierarchyRe.test(s);
    // Strong signal: hierarchy word + month/day
    if (hasHierarchy && (hasMonth || hasDay)) return true;
    // Also accept: month + day (common date line format)
    if (hasMonth && hasDay) return true;
    return false;
  };

  // Find date line index (scan all lines, not just first 3)
  let dateLineIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (looksLikeDateLine(rawLines[i])) {
      dateLineIdx = i;
      break;
    }
  }

  // Split into: above date line, date line, below date line
  const linesAbove = dateLineIdx >= 0 ? rawLines.slice(0, dateLineIdx) : rawLines.slice();
  const dateLineTxt = dateLineIdx >= 0 ? rawLines[dateLineIdx] : '';
  const linesBelow = dateLineIdx >= 0 ? rawLines.slice(dateLineIdx + 1) : [];

  // Extract location from date line (strip hierarchy suffix for clean search)
  // Example: "కామారెడ్డి జిల్లా జనవరి 07" → extract "కామారెడ్డి"
  if (dateLineTxt) {
    const dlClean = dateLineTxt
      .replace(/[:：]/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(monthRe, ' ')
      .trim();
    // Split by spaces/punctuation
    const parts = dlClean.split(/[\s,|•·\-–—]+/g).map((p) => p.trim()).filter(Boolean);
    let locPart = '';

    // Find index of hierarchy word (జిల్లా, మండలం, etc.)
    const hierIdx = parts.findIndex((p) => hierarchyRe.test(p));
    if (hierIdx > 0) {
      // Location name is the word(s) BEFORE the hierarchy word
      // e.g., ["కామారెడ్డి", "జిల్లా"] → take "కామారెడ్డి"
      locPart = parts.slice(0, hierIdx).join(' ').trim();
    } else if (hierIdx === 0 && parts.length > 1) {
      // Hierarchy word is first, location might be after (less common)
      // e.g., ["జిల్లా", "కామారెడ్డి"] → take "కామారెడ్డి"
      const afterHier = parts.slice(1).filter((p) => !hierarchyRe.test(p) && !monthRe.test(p));
      locPart = afterHier[0] || '';
    } else if (hierIdx === 0) {
      // Only hierarchy word, try to extract from it (e.g., "కామారెడ్డిజిల్లా" joined)
      locPart = parts[0].replace(hierarchyRe, '').trim();
    }

    // If no hierarchy word found, take first non-month chunk
    if (!locPart && parts.length) {
      locPart = parts.find((p) => !monthRe.test(p) && !hierarchyRe.test(p)) || '';
    }

    // Strip tenant name if present
    if (locPart && tn) locPart = locPart.replace(new RegExp(escapeRegExp(tn), 'gi'), '').trim();
    if (locPart && tnn) locPart = locPart.replace(new RegExp(escapeRegExp(tnn), 'gi'), '').trim();
    if (locPart) out.placeQuery = sanitizePlaceCandidate(locPart);
  }

  // Parse lines above date line into title, subtitle, bullets
  const compactAbove = linesAbove.map((l) => l.trim()).filter(Boolean);

  if (compactAbove.length >= 1) {
    out.title = compactAbove[0];
  }
  if (compactAbove.length >= 2) {
    out.subtitle = compactAbove[1];
  }
  if (compactAbove.length >= 3) {
    // Lines 3..N (before date line) are bullet points
    const bulletCandidates = compactAbove.slice(2);
    const bulletRe = /^([-*•]|\d+[\.)])\s*/;
    for (const bc of bulletCandidates) {
      if (out.bullets.length >= 5) break;
      const cleaned = bc.replace(bulletRe, '').trim();
      if (cleaned) out.bullets.push(cleaned);
    }
  }

  // Body = everything after date line
  const bodyLines = linesBelow.filter((l) => l.trim());
  out.body = bodyLines.join('\n\n').trim();

  return out;
}

async function aiHeadlines(opts: { mainTitle: string; bullets?: string[]; maxTitles?: number; maxRewrites?: number }) {
  const payload: any = {
    mainTitle: String(opts.mainTitle || '').trim(),
    maxTitles: typeof opts.maxTitles === 'number' ? opts.maxTitles : 1,
    maxRewrites: typeof opts.maxRewrites === 'number' ? opts.maxRewrites : 1,
  };
  if (Array.isArray(opts.bullets) && opts.bullets.length) payload.bullets = opts.bullets;

  // Use fetch directly so missing endpoint doesn't break global flows.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${getBaseUrl()}/ai/headlines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json: any = await res.json();
    return (json?.data ?? json) as any;
  } catch {
    return null;
  }
}

async function aiRewriteNews(opts: { rawText: string; jwt?: string; model: string }): Promise<AiRewriteResponse> {
  const url = 'https://app.kaburlumedia.com/api/v1/ainewspaper_rewrite';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (opts.jwt) headers.Authorization = `Bearer ${opts.jwt}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: opts.model, rawText: opts.rawText }),
  });

  const text = await res.text();
  let json: any = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
  }
  if (!res.ok) {
    const msg = String(json?.message || json?.error || text || `HTTP ${res.status}`).trim();
    throw new Error(msg || 'AI rewrite failed');
  }
  const payload = json?.data ?? json;
  return payload as AiRewriteResponse;

}

export default function PostNewsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [tenantPrimary, setTenantPrimary] = useState<string>('');
  const primary = tenantPrimary || c.tint;
  const router = useRouter();

  const { draft, setDraft, setBullets, setJustPosted } = usePostNewsDraftStore();

  const rawTextInputRef = useRef<TextInput>(null);
  const pasteTextInputRef = useRef<TextInput>(null);

  const [rawText, setRawText] = useState<string>(() => String(draft.body || ''));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAudioMuted, setAiAudioMuted] = useState(false);
  const [introAudioMuted, setIntroAudioMuted] = useState(false);
  const [introAudioPlaying, setIntroAudioPlaying] = useState(false);
  const aiSoundRef = useRef<Audio.Sound | null>(null);
  const introSoundRef = useRef<Audio.Sound | null>(null);

  // Load intro mute preference from AsyncStorage
  useEffect(() => {
    const INTRO_MUTE_KEY = 'post_news_intro_muted';
    AsyncStorage.getItem(INTRO_MUTE_KEY).then((val) => {
      if (val === 'true') setIntroAudioMuted(true);
    }).catch(() => {});
  }, []);

  // Toggle intro mute and persist
  const toggleIntroMute = useCallback(async () => {
    const INTRO_MUTE_KEY = 'post_news_intro_muted';
    const newVal = !introAudioMuted;
    setIntroAudioMuted(newVal);
    try {
      await AsyncStorage.setItem(INTRO_MUTE_KEY, newVal ? 'true' : 'false');
      // If muting and audio is playing, stop it
      if (newVal && introSoundRef.current) {
        await introSoundRef.current.stopAsync();
        await introSoundRef.current.unloadAsync();
        introSoundRef.current = null;
        setIntroAudioPlaying(false);
      }
    } catch {}
  }, [introAudioMuted]);

  // Handle back button - role-based navigation
  const handleGoBack = useCallback(() => {
    navigateBack(router);
  }, [router]);

  // Handle Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true; // Prevent default behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleGoBack])
  );

  // Play intro audio on each page visit (max 3 times per day)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const INTRO_AUDIO_KEY = 'post_news_intro_audio_plays';
      const MAX_PLAYS_PER_DAY = 3;

      const playIntroAudio = async () => {
        try {
          // Check if muted
          const INTRO_MUTE_KEY = 'post_news_intro_muted';
          const mutedVal = await AsyncStorage.getItem(INTRO_MUTE_KEY);
          if (mutedVal === 'true') {
            console.log('[PostNews] Intro audio muted by user');
            return;
          }

          // Check if AI audio is already playing - don't interrupt
          if (aiSoundRef.current) {
            try {
              const status = await aiSoundRef.current.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                console.log('[PostNews] AI audio is playing, skipping intro');
                return;
              }
            } catch {}
          }

          // Check how many times played today
          const stored = await AsyncStorage.getItem(INTRO_AUDIO_KEY);
          const today = new Date().toDateString();
          let playData = { date: today, count: 0 };
          
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed.date === today) {
                playData = parsed;
              }
              // Different day - reset count
            } catch {}
          }

          // Check if limit reached
          if (playData.count >= MAX_PLAYS_PER_DAY) {
            console.log('[PostNews] Intro audio limit reached for today:', playData.count);
            return;
          }

          // Set up audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });

          // Play intro audio
          const { sound } = await Audio.Sound.createAsync(
            require('../assets/audio/postnews_intro_te.mp3'),
            { shouldPlay: true, volume: 0.8 }
          );
          
          if (!alive) {
            await sound.unloadAsync();
            return;
          }

          introSoundRef.current = sound;
          setIntroAudioPlaying(true);

          // Update play count
          playData.count += 1;
          await AsyncStorage.setItem(INTRO_AUDIO_KEY, JSON.stringify(playData));
          console.log('[PostNews] Intro audio played, count today:', playData.count);

          // Auto-cleanup when done
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              if (introSoundRef.current === sound) {
                introSoundRef.current = null;
              }
              setIntroAudioPlaying(false);
            }
          });
        } catch (err) {
          console.log('[PostNews] Intro audio error:', err);
        }
      };

      playIntroAudio();

      return () => {
        alive = false;
        if (introSoundRef.current) {
          introSoundRef.current.unloadAsync().catch(() => {});
          introSoundRef.current = null;
        }
      };
    }, [])
  );

  // Clear justPosted flag after a longer delay to allow category modal skip logic in details.tsx to run first.
  // The delay must exceed category API load time (~1-2s) to prevent category modal from auto-opening.
  useEffect(() => {
    const timer = setTimeout(() => setJustPosted(false), 3000);
    return () => clearTimeout(timer);
  }, [setJustPosted]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = String((await AsyncStorage.getItem(POST_NEWS_TENANT_PRIMARY_COLOR_KEY)) || '').trim();
        if (alive && isValidHexColor(cached)) setTenantPrimary(cached);

        const t = await loadTokens();
        const ds = (t as any)?.session?.domainSettings;
        const fromSession = String(ds?.data?.theme?.colors?.primary || ds?.theme?.colors?.primary || '').trim();
        if (isValidHexColor(fromSession)) {
          try { await AsyncStorage.setItem(POST_NEWS_TENANT_PRIMARY_COLOR_KEY, fromSession); } catch {}
          if (alive) setTenantPrimary(fromSession);
        }
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, []);

  const aiAnim = useMemo(() => require('../assets/lotti/Artificial Intelligence.json'), []);

  const MAX_AI_REWRITE_WORDS = 1500;
  const rawWordCount = useMemo(() => {
    const t = String(rawText || '').trim();
    if (!t) return 0;
    return t.split(/\s+/g).map((x) => x.trim()).filter(Boolean).length;
  }, [rawText]);
  const aiTooLong = rawWordCount > MAX_AI_REWRITE_WORDS;

  const wasTooLongRef = useRef(false);
  useEffect(() => {
    // Show toast when user crosses the limit (typed or pasted).
    if (aiTooLong && !wasTooLongRef.current) {
      showToast('1500 words కంటే ఎక్కువ AI rewrite చేయదు');
    }
    wasTooLongRef.current = aiTooLong;
  }, [aiTooLong]);

  const goDetails = useCallback(() => {
    router.push('/post-news/details' as any);
  }, [router]);

  const onProceed = useCallback(async () => {
    rawTextInputRef.current?.blur();
    pasteTextInputRef.current?.blur();
    Keyboard.dismiss();
    const text = String(rawText || '').trim();
    if (!text) {
      Alert.alert('Post News', 'Please type or paste your news article first.');
      return;
    }

    let cachedTn = '';
    let cachedTnn = '';
    try {
      cachedTn = String((await AsyncStorage.getItem(POST_NEWS_TENANT_NAME_KEY)) || '').trim();
      cachedTnn = String((await AsyncStorage.getItem(POST_NEWS_TENANT_NATIVE_NAME_KEY)) || '').trim();
    } catch {
      // ignore
    }

    const parsed = parsePastedNews(text, { tenantName: cachedTn, tenantNativeName: cachedTnn });
    const nextBody = String(parsed.body || text).trim() || text;
    const patch: any = { body: nextBody };

    const t = String(parsed.title || '').trim();
    const st = String(parsed.subtitle || '').trim();
    const pq = String(parsed.placeQuery || '').trim();
    if (t) patch.title = t;
    if (st) patch.subtitle = st;
    if (pq) patch.locationQuery = pq;

    // If title is too long, or bullets are long sentences, try to auto-shorten via AI headlines.
    const bulletsIn = (Array.isArray(parsed.bullets) ? parsed.bullets : []).slice(0, 5);
    const longBullets = bulletsIn.filter((b) => String(b || '').trim().split(/\s+/g).filter(Boolean).length > 5);
    const needsHeadlineAI = String(t).length > 100 || longBullets.length > 0;

    let finalBullets = bulletsIn;

    if (needsHeadlineAI && t) {
      const res = await aiHeadlines({
        mainTitle: t,
        bullets: bulletsIn.length ? bulletsIn : undefined,
        maxTitles: 1,
        maxRewrites: 1,
      });
      const suggested = String((res?.titles && res.titles[0]) || '').trim();
      if (suggested) patch.title = suggested;

      const rewrittenBullets = Array.isArray(res?.bullets)
        ? res.bullets
          .map((b: any) => String((b?.rewrites && b.rewrites[0]) || b?.original || '').trim())
          .filter(Boolean)
          .slice(0, 5)
        : [];
      if (rewrittenBullets.length) finalBullets = rewrittenBullets;
      const suggestedSubtitle = String(res?.subtitle || '').trim();
      if (suggestedSubtitle) patch.subtitle = suggestedSubtitle;
    }

    setDraft(patch);
    if (finalBullets.length) setBullets(finalBullets);
    goDetails();
  }, [goDetails, rawText, setBullets, setDraft]);

  const onAiNews = useCallback(async () => {
    rawTextInputRef.current?.blur();
    pasteTextInputRef.current?.blur();
    Keyboard.dismiss();
    const text = String(rawText || '').trim();
    if (!text) {
      Alert.alert('AI News', 'Please type or paste your news article first.');
      return;
    }

    const wc = text.split(/\s+/g).map((x) => x.trim()).filter(Boolean).length;
    if (wc > MAX_AI_REWRITE_WORDS) {
      showToast('1500 words కంటే ఎక్కువ AI rewrite చేయదు');
      return;
    }

    if (aiBusy) return;

    setAiBusy(true);
    
    // Stop intro audio if playing before starting AI audio
    if (introSoundRef.current) {
      try {
        await introSoundRef.current.stopAsync();
        await introSoundRef.current.unloadAsync();
        introSoundRef.current = null;
        setIntroAudioPlaying(false);
      } catch {}
    }
    
    // Start playing AI rewrite audio (looping) - respect global and local mute preference
    try {
      // Check global mute setting
      const globalMuted = await AsyncStorage.getItem('app_sound_muted');
      const shouldMute = globalMuted === 'true' || aiAudioMuted;
      
      console.log('[AI Audio] Starting audio check...', { globalMuted, aiAudioMuted, shouldMute });
      
      if (!shouldMute) {
        // Configure audio mode for playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        console.log('[AI Audio] Loading audio file...');
        const { sound: audioSound } = await Audio.Sound.createAsync(
          require('../assets/audio/newsai_te.mp3'),
          { isLooping: true, shouldPlay: true, volume: 0.7 }
        );
        aiSoundRef.current = audioSound;
        
        // Ensure audio starts playing
        await audioSound.playAsync();
        console.log('[AI Audio] ✅ Audio playing successfully');
      } else {
        console.log('[AI Audio] Audio muted, skipping playback');
      }
    } catch (audioErr) {
      console.error('[AI Audio] ❌ Audio playback failed:', audioErr);
    }
    
    try {
      const tokens = await loadTokens();
      const session = (tokens as any)?.session;
      
      // Get tenant info
      const tenant = session?.tenant;
      const tenantId = String(tenant?.id || '').trim();
      const domainId = String(session?.domainId || session?.domainSettings?.id || '').trim();
      const newspaperName = String(tenant?.nativeName || tenant?.name || '').trim() || 'Daily News';
      
      // Get language info
      const languageCode = String(session?.languageCode || tenant?.languageCode || 'te').trim();
      const language = {
        code: languageCode,
        name: languageCode === 'te' ? 'Telugu' : languageCode === 'hi' ? 'Hindi' : 'English',
        script: languageCode === 'te' ? 'Telugu' : languageCode === 'hi' ? 'Devanagari' : 'Latin',
        region: languageCode === 'te' ? 'Telangana' : null,
      };

      // Get categories (pass domainId if available)
      const categories = await getCategoryNamesForAI(tenantId, domainId || undefined);
      if (!categories || categories.length === 0) {
        Alert.alert('Error', 'Failed to load categories. Please try again.');
        return;
      }

      console.log('=== POST NEWS AI CALL DEBUG ===');
      console.log('Tenant ID:', tenantId);
      console.log('Domain ID:', domainId);
      console.log('Newspaper Name:', newspaperName);
      console.log('Language Code:', languageCode);
      console.log('Language Object:', JSON.stringify(language, null, 2));
      console.log('Categories Count:', categories.length);
      console.log('Categories:', JSON.stringify(categories, null, 2));
      console.log('Raw Text Length:', text.length);
      console.log('Raw Text Preview:', text.substring(0, 100));
      console.log('=== END DEBUG ===');

      // Call unified AI API
      const response = await aiRewriteUnified({
        rawText: text,
        categories,
        newspaperName,
        language,
        temperature: 0.2,
        model: '4o mini',  // Match swagger model name
      });

      // Store response in AsyncStorage for review screen
      await AsyncStorage.setItem('AI_REWRITE_RESPONSE', JSON.stringify(response));
      await AsyncStorage.setItem('AI_REWRITE_TENANT_ID', tenantId);
      await AsyncStorage.setItem('AI_REWRITE_LANGUAGE', languageCode);

      // Stop audio before navigation
      if (aiSoundRef.current) {
        await aiSoundRef.current.stopAsync();
        await aiSoundRef.current.unloadAsync();
        aiSoundRef.current = null;
      }

      // Navigate to review screen
      router.push('/post-news/review' as any);
    } catch (e: any) {
      Alert.alert('AI News failed', String(e?.message || 'Could not rewrite the article'));
    } finally {
      // Stop and cleanup audio if still playing
      if (aiSoundRef.current) {
        try {
          await aiSoundRef.current.stopAsync();
          await aiSoundRef.current.unloadAsync();
          aiSoundRef.current = null;
        } catch {}
      }
      setAiBusy(false);
    }
  }, [MAX_AI_REWRITE_WORDS, aiBusy, aiAudioMuted, rawText, router]);

  // Toggle mute for AI audio
  const toggleAiAudioMute = useCallback(async () => {
    setAiAudioMuted((prev) => !prev);
    if (aiSoundRef.current) {
      try {
        if (aiAudioMuted) {
          // Currently muted, unmute
          await aiSoundRef.current.setVolumeAsync(0.7);
          await aiSoundRef.current.playAsync();
        } else {
          // Currently playing, mute
          await aiSoundRef.current.pauseAsync();
        }
      } catch {}
    }
  }, [aiAudioMuted]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={handleGoBack}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <View style={styles.appBarCenter} pointerEvents="none">
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>Post News</ThemedText>
        </View>

        {/* Spacer to push mute button to right */}
        <View style={{ flex: 1 }} />

        {/* Intro Audio Mute Control - Right Corner */}
        <Pressable
          onPress={toggleIntroMute}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: c.border, backgroundColor: introAudioMuted ? '#FEE2E2' : (introAudioPlaying ? '#D1FAE5' : c.card) },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
          accessibilityLabel={introAudioMuted ? 'Unmute intro audio' : 'Mute intro audio'}
        >
          <MaterialIcons 
            name={introAudioMuted ? 'volume-off' : (introAudioPlaying ? 'volume-up' : 'volume-down')} 
            size={20} 
            color={introAudioMuted ? '#DC2626' : (introAudioPlaying ? '#059669' : c.text)} 
          />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Full Text Input */}
          <View style={[styles.mainInputContainer, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Header Row */}
            <View style={[styles.inputHeaderRow, { borderBottomColor: c.border }]}>
              <MaterialIcons name="edit-note" size={22} color={c.tint} />
              <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 15, flex: 1 }}>
                మీ వార్త రాయండి
              </ThemedText>
              {rawText.trim() && (
                <View style={[styles.wordBadge, { backgroundColor: c.tint + '15' }]}>
                  <ThemedText style={{ color: c.tint, fontSize: 11, fontWeight: '600' }}>
                    {rawText.split(/\s+/g).filter(Boolean).length} పదాలు
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Text Area */}
            <TextInput
              ref={rawTextInputRef}
              value={rawText}
              onChangeText={setRawText}
              placeholder="ఇక్కడ టైప్ చేయండి లేదా పేస్ట్ చేయండి...

• ఎవరు - వార్తలో ఎవరు పాల్గొన్నారు?
• ఏమి జరిగింది - ప్రధాన సంఘటన?  
• ఎప్పుడు - తేదీ మరియు సమయం?
• ఎక్కడ - ప్రదేశం / గ్రామం / జిల్లా?"
              placeholderTextColor={c.muted}
              style={[styles.fullTextArea, { color: c.text }]}
              multiline
              textAlignVertical="top"
            />

            {/* Bottom Hint */}
            <View style={[styles.inputFooter, { borderTopColor: c.border, backgroundColor: c.background }]}>
              <MaterialIcons name="auto-awesome" size={14} color={c.tint} />
              <ThemedText style={{ color: c.muted, fontSize: 11, flex: 1 }}>
                AI స్వయంచాలకంగా category, location గుర్తిస్తుంది
              </ThemedText>
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Pressable
            onPress={() => void onAiNews()}
            disabled={aiBusy || aiTooLong || !rawText.trim()}
            style={({ pressed }) => [
              styles.aiButton,
              { backgroundColor: primary },
              pressed && styles.pressed,
              (aiBusy || aiTooLong || !rawText.trim()) && styles.aiButtonDisabled,
            ]}
          >
            <View style={styles.aiButtonContent}>
              <View style={styles.aiButtonIcon}>
                <MaterialIcons name="auto-awesome" size={24} color="#fff" />
              </View>
              <View style={styles.aiButtonText}>
                <ThemedText style={styles.aiButtonTitle}>Generate with AI</ThemedText>
                <ThemedText style={styles.aiButtonSubtitle}>Transform into professional article</ThemedText>
              </View>
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={aiBusy} transparent animationType="fade">
        <View style={styles.aiModalOverlay}>
          {/* Mute/Unmute button - Top Right */}
          <Pressable
            onPress={toggleAiAudioMute}
            style={({ pressed }) => [
              styles.muteButtonTopRight,
              { backgroundColor: aiAudioMuted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <MaterialIcons 
              name={aiAudioMuted ? 'volume-off' : 'volume-up'} 
              size={26} 
              color="#fff" 
            />
          </Pressable>
          
          <View style={[styles.aiModalContent, { backgroundColor: 'transparent' }]}>
            <LottieView source={aiAnim} autoPlay loop style={{ width: 280, height: 280 }} />
            <ThemedText type="defaultSemiBold" style={{ color: '#fff', fontSize: 18, marginTop: 20, textAlign: 'center' }}>
              AI మీ వార్త రాస్తోంది...
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#fff" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  aiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  muteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  muteButtonTopRight: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appBarCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  step: { fontSize: 12, marginTop: 2 },
  scroll: { padding: 12, paddingBottom: 24, flex: 1 },
  // Main Input Container - Full Screen Style
  mainInputContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  wordBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullTextArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 400,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  // Legacy styles kept for compatibility
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  wordCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 280,
    fontSize: 15,
    lineHeight: 22,
  },
  tipsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomPad: { height: 100 },
  // Bottom Bar
  bottomBar: {
    borderTopWidth: 1,
    padding: 16,
  },
  // AI Button - Full Width Premium Style
  aiButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  aiButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonText: {
    flex: 1,
  },
  aiButtonTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  aiButtonSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  // Legacy styles kept for compatibility
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  bottomBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bottomBtnFull: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  pressed: { opacity: 0.85 },
});
/*
    maxTitles: typeof opts.maxTitles === 'number' ? opts.maxTitles : 5,
    maxRewrites: typeof opts.maxRewrites === 'number' ? opts.maxRewrites : 1,
  };
  if (Array.isArray(opts.bullets) && opts.bullets.length) {
    payload.bullets = opts.bullets;
  }
  // Use fetch directly (instead of services/http request) so a missing AI endpoint (404)
  // does not trigger global HTTP error toasts while navigating.
  try {
    const res = await fetch(`${getBaseUrl()}/ai/headlines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`AI headlines failed (${res.status})`);
    const json: any = await res.json();
    return (json?.data ?? json) as AiHeadlinesResponse;
  } catch {
    return {} as AiHeadlinesResponse;
  }
}

function normalizeLocationQuery(input: string): string {
  return String(input || '').trim();
}

function localeForLangCode(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c.startsWith('te')) return 'te-IN';
  if (c.startsWith('hi')) return 'hi-IN';
  if (c.startsWith('ta')) return 'ta-IN';
  if (c.startsWith('kn')) return 'kn-IN';
  return 'en-US';
}

function formatMonthDay(langCode?: string, d = new Date()): string {
  try {
    const locale = localeForLangCode(langCode);
    const parts = new Intl.DateTimeFormat(locale, { month: 'long', day: '2-digit' }).formatToParts(d);
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (month && day) return `${month} ${day}`;
  } catch {
    // ignore
  }
  const fallback = new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit' }).format(d);
  // fallback may be "January 03" already
  return fallback;
}



export default function PostNewsScreen() {
  const MAX_BULLETS = 5;
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const { draft, setDraft, setBullets, resetDraft } = usePostNewsDraftStore();

  const [selectedLangCode, setSelectedLangCode] = useState<string>(draft.languageCode || 'en');
  const [dateLineBusy, setDateLineBusy] = useState(false);
  const [dateLineResults, setDateLineResults] = useState<CombinedLocationItem[]>([]);
  const [autoDateLinePickerVisible, setAutoDateLinePickerVisible] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantNativeName, setTenantNativeName] = useState<string>('');
  const tenantNameRef = useRef<string>('');
  const tenantNativeNameRef = useRef<string>('');
  const [pasteText, setPasteText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const aiAnim = useMemo(() => require('../assets/lotti/Artificial Intelligence.json'), []);

  const [pageLoading, setPageLoading] = useState(true);
  const initDoneRef = useRef<{ lang: boolean; tenant: boolean }>({ lang: false, tenant: false });

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchKeyRef = useRef<string>('');

  const bulletRefs = useRef<(TextInput | null)[]>([]);

  const primary = useMemo(() => c.tint, [c.tint]);

  const onResetDraft = useCallback(() => {
    Alert.alert('Reset', 'Clear all fields for this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          try {
            resetDraft();
            setPasteText('');
            setDateLineResults([]);
            setAutoDateLinePickerVisible(false);
          } catch {
            // ignore
          }
        },
      },
    ]);
  }, [resetDraft]);

  const ensureBulletSlots = useCallback((arr: string[]) => {
    const next = Array.isArray(arr) ? arr.slice(0, MAX_BULLETS) : [];
    while (next.length < MAX_BULLETS) next.push('');
    return next;
  }, [MAX_BULLETS]);

  const setBulletAt = useCallback((idx: number, value: string) => {
    const next = Array.isArray(draft.bullets) ? draft.bullets.slice(0, MAX_BULLETS) : [];
    while (next.length < MAX_BULLETS) next.push('');
    next[idx] = value;
    setBullets(next);
  }, [MAX_BULLETS, draft.bullets, setBullets]);

  const maybeSuggestTitles = useCallback(async (): Promise<boolean> => {
    const title = String(draft.title || '').trim();
    const shouldCall = title.length >= 100 || wordCount(title) >= 5;
    if (!shouldCall) return false;
    if (suggestingTitles) return false;

    // If we already have suggestions for the same title, just re-open the picker.
    if (lastSuggestedTitleRef.current === title && titleSuggestions.length) {
      setTitleSuggestionsVisible(true);
      return true;
    }

    lastSuggestedTitleRef.current = title;

    setSuggestingTitles(true);
    try {
      // Gather bullets but only send when each bullet has > 5 words.
      const combined = (Array.isArray(draft.bullets) ? draft.bullets : [])
        .map((b) => String(b || '').trim())
        .filter(Boolean)
        .slice(0, 5);

      const allBulletsLongEnough = combined.length > 0 && combined.every((b) => wordCount(String(b || '')) > 5);
      const bulletsToSend = allBulletsLongEnough ? combined : undefined;

      const res = await aiHeadlines({ mainTitle: title, bullets: bulletsToSend, maxTitles: 5, maxRewrites: 1 });
      const titles = Array.isArray(res?.titles) ? res.titles.map((t) => String(t || '').trim()).filter(Boolean) : [];

      const rewrittenBullets = Array.isArray(res?.bullets)
        ? res.bullets
          .map((b) => String((b?.rewrites && b.rewrites[0]) || b?.original || '').trim())
          .filter(Boolean)
          .slice(0, 5)
        : [];

      const subtitle = res?.subtitle ? String(res.subtitle).trim() : undefined;
      headlinesPayloadRef.current = { subtitle, bullets: rewrittenBullets.length ? rewrittenBullets : undefined };

      if (titles.length) {
        setTitleSuggestions(titles.slice(0, 5).map((t) => ({ title: t })));
        setTitleSuggestionsVisible(true);
        return true;
      }
      return false;
    } catch {
      // If AI fails, fall back silently (don't block navigation)
      headlinesPayloadRef.current = null;
      return false;
    } finally {
      setSuggestingTitles(false);
    }
  }, [draft.bullets, draft.title, suggestingTitles, titleSuggestions.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const lang = await readSelectedLanguage();
      const code = normalizeLangCodeMaybe(lang?.code || draft.languageCode || 'en');
      if (alive) setSelectedLangCode(code);
      initDoneRef.current.lang = true;
      if (initDoneRef.current.lang && initDoneRef.current.tenant) setPageLoading(false);
    })();
    return () => { alive = false; };
  }, [draft.languageCode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await loadTokens();
        const tenantObj = (t as any)?.session?.tenant || (t as any)?.user?.tenant || (t as any)?.tenant || undefined;
        const tid = String(
          (tenantObj as any)?.id
          || (tenantObj as any)?._id
          || (t as any)?.session?.tenantId
          || (t as any)?.user?.tenantId
          || ''
        ).trim();
        const tn = (tenantObj as any)?.name ?? (t as any)?.session?.tenant?.name;
        const tnn = (tenantObj as any)?.nativeName ?? (t as any)?.session?.tenant?.nativeName;
        if (alive) setTenantId(tid);
        if (alive) setTenantName(typeof tn === 'string' ? tn : '');
        if (alive) setTenantNativeName(typeof tnn === 'string' ? tnn : '');
        tenantNameRef.current = typeof tn === 'string' ? tn : '';
        tenantNativeNameRef.current = typeof tnn === 'string' ? tnn : '';
      } catch {
        if (alive) setTenantId('');
        if (alive) setTenantName('');
        if (alive) setTenantNativeName('');
        tenantNameRef.current = '';
        tenantNativeNameRef.current = '';
      } finally {
        initDoneRef.current.tenant = true;
        if (initDoneRef.current.lang && initDoneRef.current.tenant) setPageLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const runDateLineSearch = useCallback(async (rawQuery: string) => {
    const raw = normalizeLocationQuery(rawQuery);
    if (raw.length < 2) {
      setDateLineResults([]);
      return;
    }
    setDateLineBusy(true);
    try {
      const key = raw;
      // avoid repeat search loops
      if (lastSearchKeyRef.current === key) return;
      lastSearchKeyRef.current = key;

      // Backend supports Unicode (e.g., Telugu) — search with raw query.
      const res = await searchCombinedLocations(raw, 20, tenantId || undefined);
      const tid = String((res as any)?.tenant?.id || '').trim();
      if (!tenantId && tid) setTenantId(tid);
      // Prefer backend tenant nativeName for date line formatting (e.g., Telugu).
      const tn = String((res as any)?.tenant?.name || '').trim();
      const tnn = String((res as any)?.tenant?.nativeName || '').trim();
      if (tn) {
        tenantNameRef.current = tn;
        setTenantName(tn);
      }
      if (tnn) {
        tenantNativeNameRef.current = tnn;
        setTenantNativeName(tnn);
      }
      const items = Array.isArray(res?.items) ? res.items : [];
      setDateLineResults(items.slice(0, 20));
    } catch (e: any) {
      setDateLineResults([]);
      const msg = e?.message || 'Search failed';
      Alert.alert('Date Line search failed', msg);
    } finally {
      setDateLineBusy(false);
    }
  }, [tenantId]);

  const onDateLineQueryChange = useCallback((t: string) => {
    setDraft({ locationQuery: t, dateLine: null });
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const next = String(t || '');
    if (next.trim().length < 2) {
      setDateLineResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      runDateLineSearch(next);
    }, 350);
  }, [runDateLineSearch, setDraft]);

  const pickDateLine = useCallback(async (item: CombinedLocationItem) => {
    try {
      const lang = await readSelectedLanguage();
      const langCodeRaw = lang?.code || draft.languageCode || 'en';
      const normalizedLangCode = normalizeLangCodeMaybe(langCodeRaw);
      const langCode = String(langCodeRaw || normalizedLangCode || 'en').toLowerCase();
      const baseCode = normalizedLangCode;

      const names = item?.match?.names || {};
      const nameEn = String(names?.en || item?.match?.name || '').trim();
      const locationId = String(item?.match?.id || '').trim();
      if (!nameEn || !locationId) return;

      // Prefer API-provided native name for the selected language (e.g., te), else fallback.
      const nameLocalized = String(names?.[baseCode] || names?.[langCode] || item?.match?.name || nameEn).trim();
      const md = formatMonthDay(baseCode, new Date());

      // Prefer tenant.nativeName for the date line (matches user expectation for native branding).
      const tnRaw = tenantNameRef.current || tenantName || 'Kaburlu';
      const tnNative = tenantNativeNameRef.current || tenantNativeName || '';
      const tnDisplay = tnNative.trim() ? tnNative.trim() : tnRaw;

      const text = `${nameLocalized} (${tnDisplay}) ${md}`;

      setDraft({
        locationQuery: text,
        dateLine: {
          locationId,
          locationType: item.type,
          nameEn,
          nameLocalized,
          text,
        },
      });
      setDateLineResults([]);
    } catch (e: any) {
      Alert.alert('Date Line', e?.message || 'Could not select date line');
    }
  }, [draft.languageCode, setDraft, tenantName, tenantNativeName]);

  const autoFillFromPaste = useCallback(async () => {
    const input = String(pasteText || '').trim();
    if (!input) {
      Alert.alert('Paste news', 'Please paste the full news text first.');
      return;
    }
    if (autoFillBusy) return;
    setAutoFillBusy(true);
    try {
      const parsed = parsePastedNews(input);
      if (!parsed.title || !parsed.body) {
        Alert.alert('Auto Fill', 'Could not detect title/body. Please check your pasted text.');
        return;
      }

      setDraft({
        title: parsed.title,
        subtitle: parsed.subtitle || '',
        body: parsed.body,
      });

      if (parsed.bullets.length) {
        setBullets(ensureBulletSlots(parsed.bullets));
      }

      if (parsed.subtitle || parsed.bullets.length) {
        setShowAdvanced(true);
      }

      // Try to resolve Date Line automatically (same UX as Style 1 picker).
      const place = sanitizePlaceCandidate(String(parsed.placeQuery || '').trim());
      if (place) {
        setDraft({ locationQuery: place, dateLine: null as any });
        setDateLineBusy(true);
        try {
          const q = normalizeLocationQuery(place);
          if (!q || q.trim().length < 2) {
            // Don't fill wrong data; let user pick manually.
            setDateLineResults([]);
            setAutoDateLinePickerVisible(true);
          } else {
            const res = await searchCombinedLocations(q, 20, tenantId || undefined);
            const tid = String((res as any)?.tenant?.id || '').trim();
            if (!tenantId && tid) setTenantId(tid);
            const tn = String((res as any)?.tenant?.name || '').trim();
            const tnn = String((res as any)?.tenant?.nativeName || '').trim();
            if (tn) {
              tenantNameRef.current = tn;
              setTenantName(tn);
            }
            if (tnn) {
              tenantNativeNameRef.current = tnn;
              setTenantNativeName(tnn);
            }
            const items = Array.isArray(res?.items) ? res.items : [];
            setDateLineResults(items.slice(0, 20));
            if (items.length === 1) {
              await pickDateLine(items[0]);
            } else {
              // 0 or many: open picker modal to avoid wrong auto-fill.
              setAutoDateLinePickerVisible(true);
            }
          }
        } catch {
          setAutoDateLinePickerVisible(true);
        } finally {
          setDateLineBusy(false);
        }
      } else {
        // Could not confidently detect place. Open picker modal instead of filling wrong text.
        setDraft({ locationQuery: '', dateLine: null as any });
        setDateLineResults([]);
        setAutoDateLinePickerVisible(true);
      }

      setAutoFillDone(true);
    } finally {
      setAutoFillBusy(false);
    }
  }, [autoFillBusy, ensureBulletSlots, pasteText, pickDateLine, setBullets, setDraft, tenantId]);

  // Style 2: Auto-run Auto Fill shortly after paste (no button click needed).
  useEffect(() => {
    if (!useStyle2) return;
    if (showEditor) return;
    if (autoFillBusy || autoFillDone) return;
    const text = String(pasteText || '').trim();
    if (text.length < 60) return;
    if (!text.includes('\n')) return;
    if (lastAutoFillTextRef.current === text) return;

    if (autoFillTimerRef.current) clearTimeout(autoFillTimerRef.current);
    autoFillTimerRef.current = setTimeout(() => {
      lastAutoFillTextRef.current = text;
      void autoFillFromPaste();
    }, 450);

    return () => {
      if (autoFillTimerRef.current) clearTimeout(autoFillTimerRef.current);
    };
  }, [autoFillBusy, autoFillDone, autoFillFromPaste, pasteText, showEditor, useStyle2]);

  const parseAndClampBullets = useCallback(async (raw: string) => {
    const lang = await readSelectedLanguage();
    const normalized = normalizeBullets(raw);
    const limited = normalized.slice(0, MAX_BULLETS);
    const needsShorten = limited.some((b) => b.length > 100);
    if (!needsShorten) return limited;
    return await aiShortenBullets({ bullets: limited, languageCode: lang?.code });
  }, [MAX_BULLETS]);

  const canContinue = useMemo(() => {
    const titleOk = String(draft.title || '').trim().length >= 3;
    const bodyOk = String(draft.body || '').trim().length >= 1;
    const dateLineOk = !!draft.dateLine?.locationId;
    return titleOk && bodyOk && dateLineOk;
  }, [draft.body, draft.dateLine?.locationId, draft.title]);

  const goDetails = useCallback(() => {
    router.push('/post-news/details' as any);
  }, [router]);

  const proceedFromText = useCallback(async () => {
    pasteTextInputRef.current?.blur();
    Keyboard.dismiss();
    const input = String(pasteText || '').trim();
    if (!input) {
      Alert.alert('Post News', 'Please type or paste your news article first.');
      return;
    }

    const parsed = parsePastedNews(input);
    // Fallbacks: if parsing fails, keep full text as body.
    const title = String(parsed.title || '').trim();
    const subtitle = String(parsed.subtitle || '').trim();
    const body = String(parsed.body || input).trim();
    const bullets = Array.isArray(parsed.bullets) ? parsed.bullets : [];

    setDraft({
      title: title || draft.title,
      subtitle: subtitle || draft.subtitle,
      body,
      categoryId: draft.categoryId,
    });
    if (bullets.length) setBullets(ensureBulletSlots(bullets));

    // Try auto date line from detected place/date line.
    const place = sanitizePlaceCandidate(String(parsed.placeQuery || '').trim());
    if (place) {
      setDraft({ locationQuery: place, dateLine: null as any });
      setDateLineBusy(true);
      try {
        const res = await searchCombinedLocations(place, 20, tenantId || undefined);
        const items = Array.isArray(res?.items) ? res.items : [];
        if (items.length === 1) {
          await pickDateLine(items[0]);
        }
      } catch {
        // ignore
      } finally {
        setDateLineBusy(false);
      }
    }

    goDetails();
  }, [draft.categoryId, draft.subtitle, draft.title, goDetails, pasteText, pickDateLine, setBullets, setDraft, tenantId]);

  const aiNewsFromText = useCallback(async () => {
    pasteTextInputRef.current?.blur();
    Keyboard.dismiss();
    const rawText = String(pasteText || '').trim();
    if (!rawText) {
      Alert.alert('AI News', 'Please type or paste your news article first.');
      return;
    }
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const model = String(process.env.EXPO_PUBLIC_AINEWS_MODEL || 'gpt-4o');
      const res = await request<any>('/ainewspaper_rewrite', {
        method: 'POST',
        body: { model, rawText },
      });
      const payload = (res as any)?.data ?? res;

      const category = String(payload?.category || '').trim();
      const title = String(payload?.title || '').trim();
      const subtitle = String(payload?.subtitle || '').trim();
      const lead = String(payload?.lead || '').trim();
      const highlights = Array.isArray(payload?.highlights) ? payload.highlights.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
      const locDate = String(payload?.article?.location_date || '').trim();
      const body = String(payload?.article?.body || '').trim();

      // Keep lead internal but ensure it gets posted by placing it as the first paragraph.
      const combinedBody = [lead, body].filter(Boolean).join('\n\n').trim();

      setDraft({
        categoryId: '',
        categoryName: category || undefined,
        title: title || draft.title,
        subtitle: subtitle || undefined,
        body: combinedBody || rawText,
      });
      if (highlights.length) setBullets(ensureBulletSlots(highlights));

      // Extract a place from "location_date" like "Venezuela, 2023" => "Venezuela"
      const place = sanitizePlaceCandidate(locDate.split(',')[0] || '');
      if (place) {
        setDraft({ locationQuery: place, dateLine: null as any });
        setDateLineBusy(true);
        try {
          const locRes = await searchCombinedLocations(place, 20, tenantId || undefined);
          const items = Array.isArray(locRes?.items) ? locRes.items : [];
          if (items.length === 1) {
            await pickDateLine(items[0]);
          }
        } catch {
          // ignore
        } finally {
          setDateLineBusy(false);
        }
      }

      goDetails();
    } catch (e: any) {
      Alert.alert('AI News failed', e?.message || 'Could not rewrite the article');
    } finally {
      setAiBusy(false);
    }
  }, [aiBusy, draft.title, goDetails, pasteText, pickDateLine, setBullets, setDraft, tenantId]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={() => navigateBack(router)}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <View style={styles.appBarCenter} pointerEvents="none">
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>Post News</ThemedText>
        </View>

        <Pressable
          onPress={onResetDraft}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: c.border, backgroundColor: c.card, width: 40, height: 40, borderRadius: 12 },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
          accessibilityLabel="Reset draft"
        >
          <MaterialIcons name="restart-alt" size={20} color={c.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <TextInput
              ref={pasteTextInputRef}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder='type or past your news article here'
              placeholderTextColor={c.muted}
              style={[styles.textAreaBig, { borderColor: c.border, color: c.text, backgroundColor: c.background, minHeight: 420 }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Pressable
            onPress={() => navigateBack(router)}
            style={({ pressed }) => [
              styles.bottomBtn,
              { borderColor: c.border, backgroundColor: c.card },
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="arrow-back" size={18} color={c.text} />
            <ThemedText style={{ color: c.text }}>Back</ThemedText>
          </Pressable>

          <Pressable
            onPress={aiNewsFromText}
            disabled={aiBusy}
            style={({ pressed }) => [
              styles.bottomBtn,
              { borderColor: primary, backgroundColor: c.card },
              pressed && styles.pressed,
              aiBusy && { opacity: 0.7 },
            ]}
          >
            <ThemedText style={{ color: primary }}>AI News</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => void proceedFromText()}
            disabled={aiBusy}
            style={({ pressed }) => [
              styles.bottomBtn,
              { borderColor: primary, backgroundColor: c.card },
              pressed && styles.pressed,
              aiBusy && { opacity: 0.7 },
            ]}
          >
            <ThemedText style={{ color: primary }}>Proceed</ThemedText>
            <MaterialIcons name="arrow-forward" size={18} color={primary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={aiBusy} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
            <LottieView source={aiAnim} autoPlay loop style={{ width: 140, height: 140 }} />
            <ThemedText style={{ color: c.text, marginTop: 10 }}>Generating…</ThemedText>
            <ActivityIndicator style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Date Line</ThemedText>
              {dateLineBusy ? <ActivityIndicator size="small" /> : null}
            </View>

            {draft.dateLine?.locationId ? (
              <>
                <View style={[styles.selectedRow, { borderColor: c.border, backgroundColor: c.background }]}>
                  <MaterialIcons name="place" size={18} color={primary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                      {draft.dateLine?.text || 'Selected'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setDraft({ dateLine: undefined, locationQuery: '' })}
                    hitSlop={10}
                    style={({ pressed }) => [styles.chipRemove, pressed && styles.pressed]}
                    accessibilityLabel="Clear date line"
                  >
                    <MaterialIcons name="close" size={18} color={c.muted} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    setDraft({ dateLine: undefined, locationQuery: '' });
                    setDateLineResults([]);
                    setTimeout(() => dateLineInputRef.current?.focus(), 80);
                  }}
                  style={({ pressed }) => [styles.linkBtn, { alignSelf: 'flex-end' }, pressed && styles.pressed]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Change date line"
                >
                  <ThemedText style={[styles.linkText, { color: primary }]}>Change</ThemedText>
                </Pressable>
              </>
            ) : null}

            {!draft.dateLine?.locationId ? (
              <TextInput
                ref={(r) => { dateLineInputRef.current = r; }}
                value={draft.locationQuery || ''}
                onChangeText={onDateLineQueryChange}
                placeholder="Search area / mandal / district…"
                placeholderTextColor={c.muted}
                style={[styles.input, styles.dateLineInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                autoCorrect={false}
              />
            ) : null}

            {(!draft.dateLine?.locationId && (draft.locationQuery || '').trim().length >= 2 && dateLineResults.length > 0) ? (
              <View style={{ marginTop: 10 }}>
                {dateLineResults.slice(0, 8).map((it, idx) => {
                  const label = String(it?.match?.name || '').trim();
                  const meta = [it?.mandal?.name, it?.district?.name, it?.state?.name].filter(Boolean).join(' • ');
                  return (
                    <Pressable
                      key={`${it?.match?.id || idx}`}
                      onPress={() => pickDateLine(it)}
                      style={({ pressed }) => [
                        styles.resultRow,
                        { borderColor: c.border, backgroundColor: c.background },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>{label}</ThemedText>
                        {!!meta ? <ThemedText style={{ color: c.muted }} numberOfLines={1}>{meta}</ThemedText> : null}
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={c.muted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, marginBottom: 8 }}>Article</ThemedText>
            <TextInput
              value={draft.body || ''}
              onChangeText={(t) => setDraft({ body: t })}
              placeholder={articlePlaceholderForLang(selectedLangCode)}
              placeholderTextColor={c.muted}
              style={[styles.textAreaBig, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <Pressable
              onPress={() => setShowAdvanced((v) => !v)}
              style={({ pressed }) => [styles.rowBetween, pressed && styles.pressed]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Advanced options"
            >
              <View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Advanced options</ThemedText>
                <ThemedText style={{ color: c.muted, marginTop: 2 }}>Subtitle + up to 5 bullets</ThemedText>
              </View>
              <MaterialIcons name={showAdvanced ? 'expand-less' : 'expand-more'} size={22} color={c.muted} />
            </Pressable>

            {showAdvanced ? (
              <View style={{ marginTop: 8, gap: 12 }}>
                <View>
                  <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Subtitle (optional)</ThemedText>
                  <TextInput
                    value={draft.subtitle || ''}
                    onChangeText={(t) => setDraft({ subtitle: t })}
                    placeholder="Subtitle…"
                    placeholderTextColor={c.muted}
                    style={[styles.input, styles.subtitleInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                    maxLength={120}
                  />
                </View>

                <View>
                  {(() => {
                    const rawBullets = Array.isArray(draft.bullets) ? draft.bullets : [];
                    const preview = rawBullets
                      .map((t, i) => ({ i, text: String(t || '').trim() }))
                      .filter((x) => x.text);
                    const showChips = preview.length > 0 && !bulletsEditing;

                    return (
                      <>
                        <View style={styles.rowBetween}>
                          <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Bullet points</ThemedText>
                          <View style={styles.rowInline}>
                            {bulletsBusy ? <ActivityIndicator size="small" /> : null}
                            {preview.length > 0 ? (
                              <Pressable
                                onPress={() => setBulletsEditing((v) => !v)}
                                hitSlop={8}
                                style={({ pressed }) => [pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityLabel={bulletsEditing ? 'Done editing bullets' : 'Edit bullets'}
                              >
                                <ThemedText style={{ color: primary }}>{bulletsEditing ? 'Done' : 'Edit'}</ThemedText>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>

                        {showChips ? (
                          <View style={styles.rowWrap}>
                            {preview.map(({ i, text }) => (
                              <Pressable
                                key={i}
                                onPress={() => {
                                  setBulletsEditing(true);
                                  setTimeout(() => bulletRefs.current[i]?.focus(), 80);
                                }}
                                style={({ pressed }) => [
                                  styles.chipPill,
                                  { borderColor: c.border, backgroundColor: c.background },
                                  pressed && styles.pressed,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Edit bullet ${i + 1}`}
                              >
                                <ThemedText style={{ color: c.text }} numberOfLines={1}>{text}</ThemedText>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <View style={{ marginTop: 8, gap: 10 }}>
                            {Array.from({ length: MAX_BULLETS }).map((_, idx) => (
                              <TextInput
                                key={idx}
                                ref={(r) => { bulletRefs.current[idx] = r; }}
                                value={String((Array.isArray(draft.bullets) ? draft.bullets[idx] : '') || '')}
                                onChangeText={(t) => setBulletAt(idx, t)}
                                placeholder={`Bullet ${idx + 1}`}
                                placeholderTextColor={c.muted}
                                style={[styles.input, styles.bulletLineInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                                returnKeyType={idx < MAX_BULLETS - 1 ? 'next' : 'done'}
                                onSubmitEditing={() => {
                                  if (idx < MAX_BULLETS - 1) bulletRefs.current[idx + 1]?.focus();
                                }}
                              />
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            ) : null}
          </View>

              </>
            ) : null}

            <View style={styles.bottomPad} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: canContinue ? primary : c.border },
                pressed && canContinue && styles.pressed,
              ]}
              disabled={!canContinue}
            >
              <ThemedText type="defaultSemiBold" style={{ color: Colors.light.background }}>
                Next: Media
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={titleSuggestionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTitleSuggestionsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Pick a headline</ThemedText>
              <Pressable onPress={() => setTitleSuggestionsVisible(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={c.text} />
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              {titleSuggestions.slice(0, 5).map((s, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    // Update transliteration buffer so TextInput updates immediately.
                    setDraft({ title: s.title });

                    const payload = headlinesPayloadRef.current;
                    if (payload?.subtitle) {
                      setDraft({ subtitle: payload.subtitle });
                    }
                    if (payload?.bullets?.length) {
                      setBullets(payload.bullets.slice(0, 5));
                    }

                    if (payload?.subtitle || (payload?.bullets && payload.bullets.length)) {
                      setShowAdvanced(true);
                    }

                    setTitleSuggestionsVisible(false);

                    if (continueAfterHeadlinePickRef.current) {
                      continueAfterHeadlinePickRef.current = false;
                      void finalizeAndGoMedia();
                    }
                  }}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    { borderColor: c.border, backgroundColor: c.background },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="newspaper" size={18} color={primary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={2}>
                      {s.title}
                    </ThemedText>
                    {!!s.subtitle && (
                      <ThemedText style={{ color: c.muted }} numberOfLines={2}>
                        {s.subtitle}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={suggestingTitles} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
            <LottieView
              source={aiAnim}
              autoPlay
              loop
              style={{ width: 160, height: 160 }}
            />
            <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 8 }}>
              Generating headlines…
            </ThemedText>
          </View>
        </View>
      </Modal>

      <Modal
        visible={autoDateLinePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAutoDateLinePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Select Date Line</ThemedText>
              <Pressable
                onPress={() => setAutoDateLinePickerVisible(false)}
                hitSlop={10}
                style={({ pressed }) => [styles.chipRemove, pressed && styles.pressed]}
                accessibilityLabel="Close"
              >
                <MaterialIcons name="close" size={22} color={c.text} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 10, maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {dateLineResults.slice(0, 20).map((it, idx) => {
                const label = String(it?.match?.name || '').trim();
                const meta = [it?.mandal?.name, it?.district?.name, it?.state?.name].filter(Boolean).join(' • ');
                return (
                  <Pressable
                    key={`${it?.match?.id || idx}`}
                    onPress={async () => {
                      await pickDateLine(it);
                      setAutoDateLinePickerVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.resultRow,
                      { borderColor: c.border, backgroundColor: c.background },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>{label}</ThemedText>
                      {!!meta ? <ThemedText style={{ color: c.muted }} numberOfLines={1}>{meta}</ThemedText> : null}
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={c.muted} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appBarCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  step: { fontSize: 12, marginTop: 2 },
  appBarRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  appBarToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scroll: { padding: 14, paddingBottom: 24, gap: 12 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chipPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    marginTop: 8,
  },
  titleInput: {
    minHeight: 55,
  },
  subtitleInput: {
    minHeight: 55,
  },
  dateLineInput: {
    minHeight: 55,
  },
  chipRemove: {
    padding: 2,
    borderRadius: 999,
  },
  bulletLineInput: {
    minHeight: 52,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
  },
  textAreaBig: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 220,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { fontSize: 14 },

  footer: {
    borderTopWidth: 1,
    padding: 12,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPad: { height: 70 },

  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  suggestionRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  resultRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  pressed: { opacity: 0.85 },
});
*/
