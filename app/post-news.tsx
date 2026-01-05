import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { translateText } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { getBaseUrl, request } from '@/services/http';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TitleSuggestion = { title: string; subtitle?: string };

type AiHeadlinesResponse = {
  titles?: string[];
  main_title?: string;
  subtitle?: string;
  bullets?: { original?: string; rewrites?: string[] }[];
};

function wordCount(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function normalizeSpaces(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function stripLeadingDuplicateDateLine(opts: {
  body: string;
  dateLineText?: string | null;
  locationNameLocalized?: string | null;
  tenantName?: string | null;
  tenantNativeName?: string | null;
  langCode?: string | null;
}): { body: string; removed: boolean } {
  const bodyRaw = String(opts.body || '');
  if (!bodyRaw.trim()) return { body: bodyRaw, removed: false };

  const lines = bodyRaw.split(/\r?\n/);
  const md = normalizeSpaces(formatMonthDay(opts.langCode || undefined, new Date()));
  const dateLineText = normalizeSpaces(String(opts.dateLineText || ''));
  const loc = normalizeSpaces(String(opts.locationNameLocalized || ''));
  const tenants = [opts.tenantNativeName, opts.tenantName]
    .map((x) => normalizeSpaces(String(x || '')))
    .filter(Boolean);

  // Find first non-empty line
  let firstIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { body: bodyRaw, removed: false };

  const firstLine = normalizeSpaces(lines[firstIdx]);

  const matchesExactDateLine = !!dateLineText && firstLine === dateLineText;
  const hasTenant = tenants.some((t) => firstLine.includes(`(${t})`) || firstLine.includes(t));
  const hasMonthDay = !!md && firstLine.includes(md);
  const hasLocation = !!loc && firstLine.includes(loc);
  const looksLikeDateLine = (hasTenant && hasMonthDay) || (hasLocation && hasMonthDay && firstLine.includes('('));

  if (!matchesExactDateLine && !looksLikeDateLine) {
    return { body: bodyRaw, removed: false };
  }

  // Remove that line and one immediate blank line after it.
  const nextLines = [...lines];
  nextLines.splice(firstIdx, 1);
  if (firstIdx < nextLines.length && !String(nextLines[firstIdx] || '').trim()) {
    nextLines.splice(firstIdx, 1);
  }
  return { body: nextLines.join('\n'), removed: true };
}

function titlePlaceholderForLang(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c.startsWith('te')) return 'ఇక్కడ శీర్షిక టైప్ చేయండి';
  if (c.startsWith('hi')) return 'यहाँ शीर्षक टाइप करें';
  if (c.startsWith('kn')) return 'ಇಲ್ಲಿ ಶೀರ್ಷಿಕೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ';
  if (c.startsWith('ta')) return 'இங்கே தலைப்பை தட்டச்சு செய்யவும்';
  return 'Type title here';
}

function bulletsPlaceholderForLang(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c.startsWith('te')) return 'ఇక్కడ 5 బులెట్ పాయింట్లు టైప్ చేయండి';
  if (c.startsWith('hi')) return 'यहाँ 5 बुलेट पॉइंट्स टाइप करें';
  if (c.startsWith('kn')) return 'ಇಲ್ಲಿ 5 ಬುಲೆಟ್ ಪಾಯಿಂಟ್‌ಗಳನ್ನು ಟೈಪ್ ಮಾಡಿ';
  if (c.startsWith('ta')) return 'இங்கே 5 புல்லெட் பாயிண்ட்களை தட்டச்சு செய்யவும்';
  return 'Type 5 bullet points here';
}

function articlePlaceholderForLang(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c.startsWith('te')) return 'ఇక్కడ పూర్తి వార్తను టైప్ చేయండి';
  if (c.startsWith('hi')) return 'यहाँ पूरी खबर टाइप करें';
  if (c.startsWith('kn')) return 'ಇಲ್ಲಿ ಸಂಪೂರ್ಣ ಸುದ್ದಿ ಟೈಪ್ ಮಾಡಿ';
  if (c.startsWith('ta')) return 'இங்கே முழு செய்தியை தட்டச்சு செய்யவும்';
  return 'Write the full article here…';
}

function normalizeLangCodeMaybe(codeOrName?: string): string {
  const raw = String(codeOrName || '').trim();
  const s = raw.toLowerCase();
  if (!s) return 'en';
  if (s.startsWith('te') || s.includes('telugu') || raw.includes('తెలుగు')) return 'te';
  if (s.startsWith('hi') || s.includes('hindi') || raw.includes('हिं') || raw.includes('हिन्दी') || raw.includes('हिंदी')) return 'hi';
  if (s.startsWith('kn') || s.includes('kannada') || raw.includes('ಕನ್ನಡ')) return 'kn';
  if (s.startsWith('ta') || s.includes('tamil') || raw.includes('தமிழ')) return 'ta';
  if (s.startsWith('en') || s.includes('english')) return 'en';
  return s;
}

function normalizeBullets(raw: string): string[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => l.split(/\s*[•\-–—]\s+/).map((p) => p.trim()).filter(Boolean));

  const cleaned: string[] = [];
  for (const l of lines) {
    const x = l.replace(/^\s*(?:\d+[\).]|[•\-–—])\s+/, '').trim();
    if (!x) continue;
    cleaned.push(x);
  }
  return cleaned;
}

async function readSelectedLanguage(): Promise<{ id?: string; code?: string; name?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const id = parsed.id;
    const code = parsed.code;
    const name = parsed.name || parsed.label || parsed.languageName || parsed.title;
    const normalized = normalizeLangCodeMaybe(code || id || name);
    return { id, code: normalized, name };
  } catch {
    return null;
  }
}

async function aiShortenBullets(opts: { bullets: string[]; languageCode?: string }): Promise<string[]> {
  const input = (opts.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  if (!input.length) return [];
  try {
    const res = await fetch(`${getBaseUrl()}/ai/shorten-bullets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ bullets: input, languageCode: opts.languageCode, maxChars: 100 }),
    });
    if (!res.ok) throw new Error(`AI shorten failed (${res.status})`);
    const json: any = await res.json();
    const out = (json?.bullets || json?.data || json) as any;
    if (!Array.isArray(out)) throw new Error('AI shorten bad response');
    return out.map((x: any, idx: number) => String(x ?? input[idx] ?? '').trim()).filter(Boolean);
  } catch {
    return input.map((b) => (b.length > 100 ? `${b.slice(0, 97).trim()}…` : b));
  }
}

async function aiHeadlines(opts: { mainTitle: string; bullets?: string[]; maxTitles?: number; maxRewrites?: number }): Promise<AiHeadlinesResponse> {
  const payload: any = {
    mainTitle: String(opts.mainTitle || '').trim(),
    maxTitles: typeof opts.maxTitles === 'number' ? opts.maxTitles : 5,
    maxRewrites: typeof opts.maxRewrites === 'number' ? opts.maxRewrites : 1,
  };
  if (Array.isArray(opts.bullets) && opts.bullets.length) {
    payload.bullets = opts.bullets;
  }
  return await request<AiHeadlinesResponse>('/ai/headlines', { method: 'POST', body: payload });
}

function hasNonAscii(text: string): boolean {
  return /[^\x00-\x7F]/.test(String(text || ''));
}

function stripDiacritics(text: string): string {
  const s = String(text || '');
  try {
    // NFKD splits accented chars into base + diacritic marks
    return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return s;
  }
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

async function toEnglishQuery(input: string): Promise<string> {
  const raw = String(input || '').trim();
  if (!raw) return '';
  // If already ASCII, treat as safe to query.
  if (!hasNonAscii(raw)) return raw;

  // Translate any unicode/native-script input to English for backend search.
  const translated = await translateText(raw, 'en');
  const cleaned = stripDiacritics(String(translated || '').trim());

  // IMPORTANT: Never call the locations search endpoint with unicode.
  if (!cleaned || hasNonAscii(cleaned)) return '';
  return cleaned;
}

export default function PostNewsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const { draft, setDraft, setBullets } = usePostNewsDraftStore();

  const [selectedLangCode, setSelectedLangCode] = useState<string>(draft.languageCode || 'en');
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [suggestingTitles, setSuggestingTitles] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [titleSuggestionsVisible, setTitleSuggestionsVisible] = useState(false);
  const lastSuggestedTitleRef = useRef<string>('');
  const headlinesPayloadRef = useRef<{ subtitle?: string; bullets?: string[] } | null>(null);
  const continueAfterHeadlinePickRef = useRef(false);

  const [dateLineBusy, setDateLineBusy] = useState(false);
  const [dateLineResults, setDateLineResults] = useState<CombinedLocationItem[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantNativeName, setTenantNativeName] = useState<string>('');
  const tenantNameRef = useRef<string>('');
  const tenantNativeNameRef = useRef<string>('');
  const [bulletsBusy, setBulletsBusy] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const initDoneRef = useRef<{ lang: boolean; tenant: boolean }>({ lang: false, tenant: false });

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchKeyRef = useRef<string>('');

  const bulletInputRef = useRef<TextInput | null>(null);
  const [bulletInput, setBulletInput] = useState('');
  const lastBulletAddAtRef = useRef<number>(0);

  const primary = useMemo(() => c.tint, [c.tint]);

  const maybeSuggestTitles = useCallback(async () => {
    const title = String(draft.title || '').trim();
    const shouldCall = title.length >= 100 || wordCount(title) >= 4;
    if (!shouldCall) return;
    if (suggestingTitles) return;
    if (lastSuggestedTitleRef.current === title) return;
    lastSuggestedTitleRef.current = title;

    setSuggestingTitles(true);
    try {
      // Gather bullets (including pending input) but only send when each bullet has > 5 words.
      const baseBullets = (Array.isArray(draft.bullets) ? draft.bullets : []).slice(0, 5);
      const pending = normalizeBullets(String(bulletInput || '')).slice(0, 1)[0];
      const combined = (pending ? [...baseBullets, pending] : baseBullets).slice(0, 5);

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
      }
    } catch {
      // If AI fails, fall back silently (don't block navigation)
      headlinesPayloadRef.current = null;
    } finally {
      setSuggestingTitles(false);
    }
  }, [bulletInput, draft.bullets, draft.title, suggestingTitles]);

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

  const addBulletFromText = useCallback((raw: string) => {
    const next = normalizeBullets(String(raw || '')).slice(0, 1)[0];
    if (!next) return false;

    const current = Array.isArray(draft.bullets) ? draft.bullets : [];
    if (current.length >= 5) {
      Alert.alert('Bullet points', 'Maximum 5 bullet points allowed.');
      return false;
    }
    setBullets([...current, next].slice(0, 5));
    setBulletInput('');
    requestAnimationFrame(() => bulletInputRef.current?.focus());
    return true;
  }, [draft.bullets, setBullets]);

  const tryAddBullet = useCallback(() => {
    const now = Date.now();
    if (now - lastBulletAddAtRef.current < 300) return;
    lastBulletAddAtRef.current = now;
    addBulletFromText(bulletInput);
  }, [addBulletFromText, bulletInput]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await loadTokens();
        const tid = String((t as any)?.session?.tenant?.id || (t as any)?.session?.tenant?._id || '').trim();
        const tn = t?.session?.tenant?.name;
        const tnn = (t as any)?.session?.tenant?.nativeName;
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
    const raw = String(rawQuery || '').trim();
    if (raw.length < 2) {
      setDateLineResults([]);
      return;
    }
    setDateLineBusy(true);
    try {
      const qEn = await toEnglishQuery(raw);
      if (!qEn || qEn.trim().length < 2) {
        setDateLineResults([]);
        return;
      }
      const key = `${raw}→${qEn}`;
      // avoid repeat search loops
      if (lastSearchKeyRef.current === key) return;
      lastSearchKeyRef.current = key;

      const res = await searchCombinedLocations(qEn, 20, tenantId || undefined);
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
      const langCode = String(langCodeRaw || 'en').toLowerCase();
      const baseCode = langCode.split('-')[0];

      const names = item?.match?.names || {};
      const nameEn = String(names?.en || item?.match?.name || '').trim();
      const locationId = String(item?.match?.id || '').trim();
      if (!nameEn || !locationId) return;

      // Prefer API-provided native name for the selected language (e.g., te), else fallback.
      const nameLocalized = String(names?.[baseCode] || names?.[langCode] || item?.match?.name || nameEn).trim();
      const md = formatMonthDay(baseCode, new Date());

      // For Telugu app language, prefer tenant.nativeName if available.
      const tnRaw = tenantNameRef.current || tenantName || 'Kaburlu';
      const tnNative = tenantNativeNameRef.current || tenantNativeName || '';
      const tnDisplay = baseCode === 'te' && tnNative.trim() ? tnNative.trim() : tnRaw;

      const text = `${nameLocalized} (${tnDisplay}) ${md}`;

      setDraft({
        locationQuery: text,
        dateLine: {
          locationId,
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

  const parseAndClampBullets = useCallback(async (raw: string) => {
    const lang = await readSelectedLanguage();
    const normalized = normalizeBullets(raw);
    const limited = normalized.slice(0, 5);
    const needsShorten = limited.some((b) => b.length > 100);
    if (!needsShorten) return limited;
    return await aiShortenBullets({ bullets: limited, languageCode: lang?.code });
  }, []);

  const canContinue = useMemo(() => {
    const titleOk = String(draft.title || '').trim().length >= 3;
    const bodyOk = String(draft.body || '').trim().length >= 1;
    const dateLineOk = !!draft.dateLine?.locationId;
    return titleOk && bodyOk && dateLineOk;
  }, [draft.body, draft.dateLine?.locationId, draft.title]);

  const finalizeAndGoMedia = useCallback(async () => {
    // Build bullets list locally so we don't miss the pending input due to async store updates.
    const baseBullets = (Array.isArray(draft.bullets) ? draft.bullets : []).slice(0, 5);
    const pending = normalizeBullets(String(bulletInput || '')).slice(0, 1)[0];
    const parsedBullets = (pending ? [...baseBullets, pending] : baseBullets).slice(0, 5);
    setBullets(parsedBullets);
    if (pending) setBulletInput('');

    // If any bullet is too long, shorten on Next click (max 5, each <= 100 chars).
    const needsShorten = parsedBullets.some((b) => String(b || '').length > 100);
    if (needsShorten && !bulletsBusy) {
      setBulletsBusy(true);
      try {
        const joined = parsedBullets.join('\n');
        const next = await parseAndClampBullets(joined);
        setBullets(next);
      } finally {
        setBulletsBusy(false);
      }
    }

    router.push('/post-news/media' as any);
  }, [bulletInput, bulletsBusy, draft.bullets, parseAndClampBullets, router, setBullets]);

  const goNext = useCallback(async () => {
    if (!canContinue) {
      Alert.alert('Missing details', 'Please add a title, select Date Line, and write the article text.');
      return;
    }

    // Prevent duplicate date line inside the article body (date line is stored separately).
    try {
      const lang = await readSelectedLanguage();
      const langCodeRaw = lang?.code || draft.languageCode || selectedLangCode || 'en';
      const langCode = String(langCodeRaw || 'en').toLowerCase();
      const baseCode = langCode.split('-')[0];
      const cleaned = stripLeadingDuplicateDateLine({
        body: String(draft.body || ''),
        dateLineText: draft.dateLine?.text,
        locationNameLocalized: (draft.dateLine as any)?.nameLocalized,
        tenantName: tenantNameRef.current || tenantName,
        tenantNativeName: tenantNativeNameRef.current || tenantNativeName,
        langCode: baseCode,
      });
      if (cleaned.removed) {
        setDraft({ body: cleaned.body });
      }
    } catch {
      // ignore
    }

    // Suggest titles/headlines on Next click (based on title length or word count).
    const title = String(draft.title || '').trim();
    const shouldCall = title.length >= 100 || wordCount(title) >= 4;
    if (shouldCall && lastSuggestedTitleRef.current !== title) {
      continueAfterHeadlinePickRef.current = true;
      await maybeSuggestTitles();
      // If modal opened, wait for user selection.
      if (titleSuggestionsVisible) return;
      continueAfterHeadlinePickRef.current = false;
    }

    await finalizeAndGoMedia();
  }, [canContinue, draft.body, draft.dateLine?.text, draft.languageCode, draft.title, finalizeAndGoMedia, maybeSuggestTitles, selectedLangCode, setDraft, tenantName, tenantNativeName, titleSuggestionsVisible]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={() => router.back()}
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

        <View style={styles.appBarCenter}>
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>Post News</ThemedText>
          <ThemedText style={[styles.step, { color: c.muted }]}>Step 1 of 2</ThemedText>
        </View>

        <View style={styles.appBarRightSpacer} />
      </View>

      {pageLoading ? (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <Skeleton width={'85%'} height={20} borderRadius={10} />
            </View>

            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <Skeleton width={'45%'} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
              <Skeleton width={'90%'} height={18} borderRadius={9} />
            </View>

            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <Skeleton width={'35%'} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
              <Skeleton width={'100%'} height={18} borderRadius={9} />
            </View>

            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <Skeleton width={'40%'} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
              <Skeleton width={'100%'} height={18} borderRadius={9} />
              <Skeleton width={'70%'} height={18} borderRadius={9} style={{ marginTop: 10 }} />
            </View>

            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <Skeleton width={'30%'} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
              <Skeleton width={'100%'} height={120} borderRadius={14} />
            </View>

            <View style={styles.bottomPad} />
          </ScrollView>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <TextInput
                value={draft.title || ''}
                onChangeText={(t) => setDraft({ title: t })}
                placeholder={titlePlaceholderForLang(selectedLangCode)}
                placeholderTextColor={c.muted}
                style={[styles.input, styles.titleInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                maxLength={300}
                multiline={false}
                returnKeyType="next"
              />
            </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <Pressable
              onPress={() => setShowSubtitle((v) => !v)}
              style={({ pressed }) => [styles.rowBetween, pressed && styles.pressed]}
              hitSlop={6}
            >
              <ThemedText style={{ color: c.muted }}>Subtitle (optional)</ThemedText>
              <MaterialIcons name={showSubtitle ? 'expand-less' : 'expand-more'} size={22} color={c.muted} />
            </Pressable>

            {showSubtitle ? (
              <TextInput
                value={draft.subtitle || ''}
                onChangeText={(t) => setDraft({ subtitle: t })}
                placeholder="Subtitle…"
                placeholderTextColor={c.muted}
                style={[styles.input, styles.subtitleInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                maxLength={120}
              />
            ) : null}
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Date Line</ThemedText>
              {dateLineBusy ? <ActivityIndicator size="small" /> : null}
            </View>
            <TextInput
              value={draft.locationQuery || ''}
              onChangeText={onDateLineQueryChange}
              placeholder="Search area / mandal / district…"
              placeholderTextColor={c.muted}
              style={[styles.input, styles.dateLineInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
              autoCorrect={false}
            />

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
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Bullet points</ThemedText>
              {bulletsBusy ? <ActivityIndicator size="small" /> : null}
            </View>

            <View style={styles.bulletRow}>
              <TextInput
                ref={(r) => { bulletInputRef.current = r; }}
                value={bulletInput}
                onChangeText={setBulletInput}
                onSubmitEditing={tryAddBullet}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Enter') tryAddBullet();
                }}
                placeholder={bulletsPlaceholderForLang(selectedLangCode)}
                placeholderTextColor={c.muted}
                style={[styles.input, styles.bulletInput, styles.bulletInputFlex, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                multiline={false}
                blurOnSubmit={false}
                returnKeyType="done"
              />

              <Pressable
                onPress={tryAddBullet}
                style={({ pressed }) => [
                  styles.addBulletBtn,
                  { borderColor: c.border, backgroundColor: c.background },
                  pressed && styles.pressed,
                ]}
                hitSlop={10}
                accessibilityLabel="Add bullet"
              >
                <MaterialIcons name="add" size={20} color={c.text} />
              </Pressable>
            </View>

            {Array.isArray(draft.bullets) && draft.bullets.length > 0 ? (
              <View style={styles.chipsWrap}>
                {draft.bullets.slice(0, 5).map((b, idx) => (
                  <View key={`${idx}-${b}`} style={[styles.chip, { borderColor: c.border, backgroundColor: c.background }]}
                  >
                    <ThemedText style={[styles.chipText, { color: c.text }]} numberOfLines={2}>
                      {b}
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        const cur = Array.isArray(draft.bullets) ? draft.bullets : [];
                        setBullets(cur.filter((_, i) => i !== idx));
                      }}
                      hitSlop={10}
                      style={({ pressed }) => [styles.chipRemove, pressed && styles.pressed]}
                      accessibilityLabel="Remove bullet"
                    >
                      <MaterialIcons name="close" size={16} color={c.muted} />
                    </Pressable>
                  </View>
                ))}
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
                      setShowSubtitle(true);
                      setDraft({ subtitle: payload.subtitle });
                    }
                    if (payload?.bullets?.length) {
                      setBullets(payload.bullets.slice(0, 5));
                      setBulletInput('');
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  step: { fontSize: 12, marginTop: 2 },
  appBarRightSpacer: { width: 40 },
  scroll: { padding: 14, paddingBottom: 24, gap: 12 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
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
  bulletInput: {
    minHeight: 55,
    marginTop: 0,
  },
  bulletInputFlex: {
    flex: 1,
  },
  addBulletBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  chipText: {
    flexShrink: 1,
    paddingRight: 6,
  },
  chipRemove: {
    padding: 2,
    borderRadius: 999,
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
  pressed: { opacity: 0.85 },
});
