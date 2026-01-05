import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
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
    Switch,
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

const BULLET_PREFIX_RE = /^\s*(?:[•*\-–—+]|\d+[\).])\s+/;
function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(String(line || '').trim());
}

function stripBulletPrefix(line: string): string {
  return String(line || '').replace(BULLET_PREFIX_RE, '').trim();
}

const TELUGU_MONTHS = [
  'జనవరి',
  'ఫిబ్రవరి',
  'మార్చి',
  'ఏప్రిల్',
  'మే',
  'జూన్',
  'జూలై',
  'ఆగస్టు',
  'సెప్టెంబర్',
  'అక్టోబర్',
  'నవంబర్',
  'డిసెంబర్',
];
const EN_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function looksLikeDateLineLine(line: string): boolean {
  const s = String(line || '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  const hasNewsTag = s.includes('ప్రశ్న') || s.includes('న్యూస్') || lower.includes('news');
  const hasTeluguMonth = TELUGU_MONTHS.some((m) => s.includes(m));
  const hasEnMonth = EN_MONTHS.some((m) => lower.includes(m));
  const hasDay = /\b\d{1,2}\b/.test(lower);
  // Allow either explicit month names OR common newsroom tag lines that contain a day number.
  return hasDay && (hasTeluguMonth || hasEnMonth || hasNewsTag);
}

function stripLeadingDecorators(line: string): string {
  return String(line || '').replace(/^\s*[:：\-–—•*]+\s*/, '').trim();
}

function sanitizePlaceCandidate(input: string): string {
  let s = String(input || '').trim();
  if (!s) return '';
  s = s
    .replace(/^[\s\(\)\[\]{}:：]+/, '')
    .replace(/[\s\(\)\[\]{}:：]+$/g, '')
    .trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (s.includes('ప్రశ్న') || s.includes('న్యూస్') || lower.includes('news')) return '';
  if (!/\p{L}/u.test(s)) return '';
  return s;
}

function extractPlaceQueryFromDateLine(line: string): string {
  const sRaw = String(line || '').trim();
  const s = sRaw
    // Remove newsroom tag parentheses which must never become the place query.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[:：]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // Pattern: "<place...> <month> <day>" (your case: "కామారెడ్డి జిల్లా జనవరి 05 ...")
  for (const m of TELUGU_MONTHS) {
    const idx = s.indexOf(m);
    if (idx > 0) {
      const before = s.slice(0, idx).trim();
      if (before) {
        const cleanedBefore = before
          .replace(/\s*(జిల్లా|మండలం|గ్రామం|తాలూకా|నగరం)\s*$/u, '')
          .trim();
        const cand = sanitizePlaceCandidate(cleanedBefore.split(',')[0]?.split('/')[0] || cleanedBefore);
        if (cand) return cand;
      }
    }
  }

  for (const m of EN_MONTHS) {
    const idx = s.toLowerCase().indexOf(m);
    if (idx > 0) {
      const before = s.slice(0, idx).trim();
      if (before) {
        const cleanedBefore = before.replace(/\s*(district|mandal|village|city)\s*$/i, '').trim();
        const cand = sanitizePlaceCandidate(cleanedBefore.split(',')[0]?.split('/')[0] || cleanedBefore);
        if (cand) return cand;
      }
    }
  }

  // Pattern: "Place/Place, జనవరి 05 (ప్రశ్న ఆయుధం న్యూస్):"  => take before comma
  const commaIdx = s.indexOf(',');
  if (commaIdx > 0 && commaIdx < 40) {
    const before = s.slice(0, commaIdx).trim();
    if (before) {
      const first = before.split('/').map((x) => x.trim()).filter(Boolean)[0];
      const cand = sanitizePlaceCandidate(first);
      if (cand) return cand;
    }
  }

  // Telugu: "జనవరి 5 <place...>" (common WhatsApp patterns)
  for (const m of TELUGU_MONTHS) {
    const re = new RegExp(`${m}\\s*(\\d{1,2})\\s*(.+)$`);
    const match = s.match(re);
    if (match?.[2]) {
      const rest = String(match[2] || '').trim();
      const parts = rest.split(/\s+/).filter(Boolean);
      const cand = sanitizePlaceCandidate(String(parts[0] || '').trim());
      if (cand) return cand;
    }
  }

  // English: "January 5 <place...>"
  for (const m of EN_MONTHS) {
    const re = new RegExp(`${m}\\s*(\\d{1,2})\\s*(.+)$`, 'i');
    const match = s.match(re);
    if (match?.[2]) {
      const rest = String(match[2] || '').trim();
      const parts = rest.split(/\s+/).filter(Boolean);
      const cand = sanitizePlaceCandidate(String(parts[0] || '').trim());
      if (cand) return cand;
    }
  }

  // Pattern: "... న్యూస్ 3 కొత్తగూడెం ..." (no month) => take token after day number
  const toks = s.split(/\s+/).filter(Boolean);
  const dayIdx = toks.findIndex((t) => /^\d{1,2}$/.test(t));
  if (dayIdx >= 0 && toks[dayIdx + 1]) {
    const cand = String(toks[dayIdx + 1] || '').trim();
    const cleaned = sanitizePlaceCandidate(cand);
    if (cleaned && cleaned.length >= 2) return cleaned;
  }

  return '';
}

function stripWhatsAppPrefix(line: string): string {
  const s = String(line || '').trim();
  if (!s) return '';
  // Example: "[5:23 pm, 4/1/2026] Name: message" => keep "message"
  const m1 = /^\[[^\]]+\]\s*[^:]{1,60}:\s*(.*)$/.exec(s);
  if (m1?.[1]) return String(m1[1]).trim();

  // Example: "+91 9xxxx: message" => keep "message"
  const m2 = /^\+?\d[\d\s-]{6,}:\s*(.*)$/.exec(s);
  if (m2?.[1]) return String(m2[1]).trim();

  return s;
}

function stripWhatsAppStyling(line: string): string {
  let s = String(line || '').replace(/[\u200B\u200E\u200F\u202A-\u202E]/g, '').trim();
  if (!s) return '';

  // WhatsApp emphasis markers when a whole line is wrapped: *bold* _italic_ ~strike~
  const wrappers: [RegExp, string][] = [
    [/^\*(.+)\*$/s, '*'],
    [/^_(.+)_$/s, '_'],
    [/^~(.+)~$/s, '~'],
  ];
  for (const [re] of wrappers) {
    const m = re.exec(s);
    if (m?.[1]) {
      s = String(m[1]).trim();
      break;
    }
  }

  // Remove trailing/leading stray markers that often appear around bullets/lines
  s = s.replace(/^[\s*]+(?!\d+[\).]\s)/, '').replace(/[\s*]+$/g, '').trim();
  return s;
}

function isSeparatorLine(line: string): boolean {
  const s = String(line || '').trim().toLowerCase();
  return s === 'next' || s === '---' || s === '--' || s === '…' || s === '...';
}

function parsePastedNews(text: string): {
  title: string;
  subtitle?: string;
  bullets: string[];
  body: string;
  dateLineLine?: string;
  placeQuery?: string;
} {
  const MAX_BULLETS = 5;
  const raw = String(text || '').replace(/\r/g, '');
  const lines = raw
    .split('\n')
    .map(stripWhatsAppPrefix)
    .map(stripWhatsAppStyling)
    .map((l) => String(l || '').trimEnd())
    .filter((l) => !isSeparatorLine(l));
  const nonEmptyIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) nonEmptyIdx.push(i);
  }
  if (!nonEmptyIdx.length) {
    return { title: '', bullets: [], body: '' };
  }

  const titleIdx = nonEmptyIdx[0];
  const title = stripLeadingDecorators(stripWhatsAppStyling(String(lines[titleIdx] || '').trim()));

  // Find a date line candidate among early lines (after the title)
  let dateLineIdx: number | undefined;
  for (const idx of nonEmptyIdx.slice(1, 10)) {
    const ln = String(lines[idx] || '').trim();
    if (looksLikeDateLineLine(ln)) {
      dateLineIdx = idx;
      break;
    }
  }
  const dateLineLine = dateLineIdx !== undefined ? String(lines[dateLineIdx] || '').trim() : undefined;
  const placeQuery = dateLineLine ? extractPlaceQueryFromDateLine(dateLineLine) : undefined;

  // Subtitle: 2nd non-empty line if it's not a bullet and not the date line
  let subtitleIdx: number | undefined;
  const maybeSubIdx = nonEmptyIdx[1];
  if (maybeSubIdx !== undefined && maybeSubIdx !== dateLineIdx) {
    const subLine = String(lines[maybeSubIdx] || '').trim();
    if (subLine && !isBulletLine(subLine) && subLine.length <= 140) {
      subtitleIdx = maybeSubIdx;
    }
  }
  const subtitle = subtitleIdx !== undefined
    ? stripLeadingDecorators(stripWhatsAppStyling(String(lines[subtitleIdx] || '').trim()))
    : undefined;

  // Bullets: collect bullet-style lines (up to MAX_BULLETS), skipping title/subtitle/date line
  const bullets: string[] = [];
  for (const idx of nonEmptyIdx) {
    if (idx === titleIdx) continue;
    if (idx === subtitleIdx) continue;
    if (idx === dateLineIdx) continue;
    const ln = stripWhatsAppStyling(String(lines[idx] || '').trim());
    if (!ln) continue;
    if (!isBulletLine(ln)) {
      // Only collect bullets if they are explicitly marked (WhatsApp style).
      continue;
    }
    const cleaned = stripBulletPrefix(ln);
    if (cleaned) bullets.push(stripWhatsAppStyling(cleaned));
    if (bullets.length >= MAX_BULLETS) break;
  }

  // If there are no explicit bullets, infer from a block of short plain lines near the top.
  // (Your sample: multiple short lines before the long paragraph.)
  if (!bullets.length) {
    const topCandidates: { idx: number; text: string }[] = [];
    for (const idx of nonEmptyIdx.slice(1, 18)) {
      if (idx === subtitleIdx || idx === dateLineIdx) continue;
      const t = stripWhatsAppStyling(String(lines[idx] || '').trim());
      if (!t) continue;
      if (looksLikeDateLineLine(t)) continue;
      if (t.length > 65) break; // stop when long paragraph starts
      // Avoid capturing obvious attribution blocks / phone lines
      if (t.includes(']') && t.includes('[')) continue;
      topCandidates.push({ idx, text: t });
      if (topCandidates.length >= Math.min(MAX_BULLETS + 2, 12)) break;
    }
    if (topCandidates.length >= 2) {
      for (const it of topCandidates.slice(0, MAX_BULLETS)) {
        const cleaned = it.text.replace(/[:。\.]+$/g, '').trim();
        if (cleaned) bullets.push(cleaned);
      }
    }
  }

  // Body: everything except title/subtitle/date line and bullet lines
  const bodyLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === titleIdx || i === subtitleIdx || i === dateLineIdx) continue;
    const lnRaw = String(lines[i] || '');
    const ln = stripWhatsAppStyling(lnRaw);
    if (!ln) continue;
    if (isBulletLine(ln)) continue;
    if (bullets.length) {
      // If we inferred bullets from plain lines, remove those exact lines from body too.
      const trimmed = String(ln || '').trim();
      if (trimmed && bullets.includes(trimmed.replace(/[:。\.]+$/g, '').trim())) continue;
    }
    bodyLines.push(ln);
  }
  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    title,
    subtitle,
    bullets,
    body,
    dateLineLine,
    placeQuery,
  };
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [suggestingTitles, setSuggestingTitles] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [titleSuggestionsVisible, setTitleSuggestionsVisible] = useState(false);
  const lastSuggestedTitleRef = useRef<string>('');
  const headlinesPayloadRef = useRef<{ subtitle?: string; bullets?: string[] } | null>(null);
  const continueAfterHeadlinePickRef = useRef(false);

  const [dateLineBusy, setDateLineBusy] = useState(false);
  const [dateLineResults, setDateLineResults] = useState<CombinedLocationItem[]>([]);
  const [autoDateLinePickerVisible, setAutoDateLinePickerVisible] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantNativeName, setTenantNativeName] = useState<string>('');
  const tenantNameRef = useRef<string>('');
  const tenantNativeNameRef = useRef<string>('');
  const [bulletsBusy, setBulletsBusy] = useState(false);

  const dateLineInputRef = useRef<TextInput | null>(null);
  const [bulletsEditing, setBulletsEditing] = useState(false);

  const STYLE2_STORAGE_KEY = 'post_news_compose_style2';
  const [useStyle2, setUseStyle2] = useState(false);

  // Style 2 (WhatsApp paste + Auto Fill)
  const [pasteText, setPasteText] = useState('');
  const [autoFillBusy, setAutoFillBusy] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState(false);
  const autoFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoFillTextRef = useRef<string>('');

  const newsIconAnim = useMemo(() => require('../assets/lotti/News icon.json'), []);

  const [pageLoading, setPageLoading] = useState(true);
  const initDoneRef = useRef<{ lang: boolean; tenant: boolean }>({ lang: false, tenant: false });

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchKeyRef = useRef<string>('');

  const bulletRefs = useRef<(TextInput | null)[]>([]);

  const primary = useMemo(() => c.tint, [c.tint]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STYLE2_STORAGE_KEY)
      .then((v) => {
        if (!alive) return;
        setUseStyle2(v === '1');
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggleStyle2 = useCallback((next: boolean) => {
    setUseStyle2(next);
    AsyncStorage.setItem(STYLE2_STORAGE_KEY, next ? '1' : '0').catch(() => {
      // ignore
    });
  }, []);

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
            setAutoFillDone(false);
            setShowAdvanced(false);
            setTitleSuggestionsVisible(false);
            setTitleSuggestions([]);
            setDateLineResults([]);
            setAutoDateLinePickerVisible(false);
            setBulletsEditing(false);
            lastSuggestedTitleRef.current = '';
            headlinesPayloadRef.current = null;
            continueAfterHeadlinePickRef.current = false;
            if (searchTimerRef.current) {
              clearTimeout(searchTimerRef.current);
              searchTimerRef.current = null;
            }
          } catch {
            // ignore
          }
        },
      },
    ]);
  }, [resetDraft]);

  useEffect(() => {
    if (!showAdvanced) setBulletsEditing(false);
  }, [showAdvanced]);

  const showEditor = useMemo(() => {
    if (!useStyle2) return true;
    if (autoFillDone) return true;
    const hasDraft = !!(
      String(draft.title || '').trim() ||
      String(draft.body || '').trim() ||
      String(draft.locationQuery || '').trim() ||
      (draft.dateLine as any)?.locationId
    );
    return hasDraft;
  }, [autoFillDone, draft.body, draft.dateLine, draft.locationQuery, draft.title, useStyle2]);

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

  const finalizeAndGoMedia = useCallback(async () => {
    const bullets = (Array.isArray(draft.bullets) ? draft.bullets : [])
      .map((b) => String(b || '').trim())
      .filter(Boolean)
      .slice(0, MAX_BULLETS);

    // If any bullet is too long, shorten on Next click (each <= 100 chars).
    const needsShorten = bullets.some((b) => String(b || '').length > 100);
    if (needsShorten && !bulletsBusy) {
      setBulletsBusy(true);
      try {
        const joined = bullets.join('\n');
        const next = await parseAndClampBullets(joined);
        setBullets(next);
      } finally {
        setBulletsBusy(false);
      }
    }

    router.push('/post-news/media' as any);
  }, [MAX_BULLETS, bulletsBusy, draft.bullets, parseAndClampBullets, router, setBullets]);

  const goNext = useCallback(async () => {
    if (!canContinue) {
      Alert.alert('Missing details', 'Please add a title, select Date Line, and write the article text.');
      return;
    }

    // Prevent duplicate date line inside the article body (date line is stored separately).
    try {
      const lang = await readSelectedLanguage();
      const langCodeRaw = lang?.code || draft.languageCode || selectedLangCode || 'en';
      const baseCode = normalizeLangCodeMaybe(langCodeRaw);
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
    const shouldCall = title.length >= 100 || wordCount(title) >= 5;
    if (shouldCall) {
      continueAfterHeadlinePickRef.current = true;
      const opened = await maybeSuggestTitles();
      // If picker opened, wait for the user to choose a title.
      if (opened) return;
      continueAfterHeadlinePickRef.current = false;
    }

    await finalizeAndGoMedia();
  }, [canContinue, draft.body, draft.dateLine, draft.languageCode, draft.title, finalizeAndGoMedia, maybeSuggestTitles, selectedLangCode, setDraft, tenantName, tenantNativeName]);

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

        <View style={styles.appBarCenter} pointerEvents="none">
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>Post News</ThemedText>
          <ThemedText style={[styles.step, { color: c.muted }]}>Step 1 of 2</ThemedText>
        </View>

        <View style={styles.appBarRight}>
          <View style={styles.appBarToggleRow}>
            <ThemedText style={{ color: useStyle2 ? primary : c.muted, fontSize: 12 }}>Style 2</ThemedText>
            <Switch
              value={useStyle2}
              onValueChange={toggleStyle2}
              trackColor={{ false: c.border, true: primary }}
              thumbColor={Platform.OS === 'android' ? (useStyle2 ? c.card : c.background) : undefined}
            />
          </View>
          <Pressable
            onPress={onResetDraft}
            style={({ pressed }) => [
              styles.iconBtn,
              { borderColor: c.border, backgroundColor: c.card, width: 36, height: 36, borderRadius: 12 },
              pressed && styles.pressed,
            ]}
            hitSlop={10}
            accessibilityLabel="Reset draft"
          >
            <MaterialIcons name="restart-alt" size={20} color={c.text} />
          </Pressable>
        </View>
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
            {useStyle2 && !showEditor ? (
              <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialIcons name="newspaper" size={18} color={primary} />
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Paste full news</ThemedText>
                  </View>
                  {autoFillBusy ? <ActivityIndicator size="small" /> : null}
                </View>
                <ThemedText style={{ color: c.muted, marginTop: 6 }}>
                  Paste WhatsApp message. Auto Fill will prepare Title, Date Line, and Article.
                </ThemedText>
                <TextInput
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder="Paste from WhatsApp…"
                  placeholderTextColor={c.muted}
                  style={[styles.textAreaBig, { borderColor: c.border, color: c.text, backgroundColor: c.background, minHeight: showEditor ? 140 : 220 }]}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={autoFillFromPaste}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    { borderColor: c.border, backgroundColor: c.background, alignSelf: 'flex-end' },
                    pressed && styles.pressed,
                  ]}
                  disabled={autoFillBusy}
                >
                  <MaterialIcons name="auto-fix-high" size={18} color={primary} />
                  <ThemedText style={{ color: primary }}>Auto Fill</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {showEditor ? (
              <>
                <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Title</ThemedText>
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
              source={newsIconAnim}
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
