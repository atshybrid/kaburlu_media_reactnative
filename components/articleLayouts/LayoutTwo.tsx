import { getTeluguPlaceName } from '@/constants/placeLexicon';
import { useReaction } from '@/hooks/useReaction';
import { useTransliteration } from '@/hooks/useTransliteration';
import { Feather } from '@expo/vector-icons';
// Replaced custom icons with Feather for a cleaner, pro look
import TEBrandLogo from '@/assets/images/kaburlu_te_brand_logo.svg';
import { WEB_BASE_URL } from '@/config/appConfig';
import { pickTitleColorTheme } from '@/constants/TitleColorRules';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { getCachedCommentsByShortNews, getCommentsByShortNews, prefetchCommentsByShortNews } from '@/services/api';
import { on } from '@/services/events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share as RnShare, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ShareLib from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import BottomSheet from '../ui/BottomSheet';
import type { ArticleLayoutComponent } from './types';

// Colors similar to the reference screenshot
const DEFAULT_RANDOM_COLORS = [
  '#E53935',
  '#3949AB',
  '#00897B',
  '#F57C00',
  '#6A1B9A',
  '#D81B60',
];

const clampWords = (text?: string, maxWords = 60) => {
  if (!text) return '';
  const parts = String(text).split(/\s+/);
  if (parts.length <= maxWords) return text;
  // Show exactly the first maxWords without adding ellipsis
  return parts.slice(0, maxWords).join(' ');
};

// const clampChars = (text: string, maxChars: number) => {
//   if (!text) return '';
//   if (text.length <= maxChars) return text;
//   return text.slice(0, Math.max(0, maxChars - 1)) + '…';
// };

const LayoutTwo: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  // Resolve selected language (for top row locale)
  const [languageCode, setLanguageCode] = useState<string | undefined>(undefined);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) {
          const obj = JSON.parse(raw);
          setLanguageCode(obj?.code || obj?.id || undefined);
        }
      } catch {}
    })();
  }, []);

  const toLocale = useCallback((code?: string) => {
    if (!code) return 'en-IN';
    const lower = code.toLowerCase();
    if (lower.length === 2) return `${lower}-IN`;
    return lower;
  }, []);

  const isTelugu = useCallback((text?: string) => /[\u0C00-\u0C7F]/.test(String(text || '')), []);
  // Prepare place display in target language (transliterate once when language or place changes)
  const placeRaw = (article as any)?.author?.placeName || (article as any)?.placeName || '—';
  const placeTx = useTransliteration({ languageCode, enabled: Boolean(languageCode), debounceMs: 0, mode: 'immediate' });
  useEffect(() => { if (placeRaw) placeTx.setRaw(placeRaw + ' '); }, [placeRaw, languageCode, placeTx]);
  // Map to the reference schema with sensible fallbacks from our Article type
  const topCols = useMemo(() => {
    const a: string[] = [];
    const d = new Date(article.createdAt || Date.now());
    const locale = toLocale(languageCode);
    const dayName = (() => {
      try {
        return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    })();
  // If a non-English target language is selected (e.g., Telugu), do not show English fallback.
  const nonEnglish = !!(languageCode && !/^en/i.test(languageCode));
  let place: string | undefined;
    if (nonEnglish && (languageCode?.toLowerCase().startsWith('te'))) {
      place = getTeluguPlaceName(placeRaw) || placeTx.value || '—';
    } else {
      place = placeTx.value || placeRaw;
    }
    const articleNumber = (typeof index === 'number' ? index : 0) + 1;
    const todayCount = typeof totalArticles === 'number' ? totalArticles : 0;
    a.push(`సంపుటి:${articleNumber}`);
    a.push(`సంచిక:${todayCount}`);
    a.push(dayName);
  a.push(place || '—');
    return a;
  }, [article, languageCode, toLocale, index, totalArticles, placeTx.value, placeRaw]);

  // Build title lines with special ":" rule
  const rawTitleInfo = useMemo(() => {
    const raw = (article.title || '').trim();
    if (!raw) return { line1: '', line2: '', primary: null } as const;
    if (raw.includes(':')) {
      const firstIdx = raw.indexOf(':');
      const left = raw.slice(0, firstIdx).trim();
      const right = raw.slice(firstIdx + 1).trim();
      const wc = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
      const lw = wc(left);
      const rw = wc(right);
      // If either side is 1-2 words, make it the primary (larger) line centered
      if (lw > 0 && lw <= 2 && (lw <= rw || rw > 2)) {
        return { line1: left, line2: right, primary: 'line1' as const };
      }
      if (rw > 0 && rw <= 2 && (rw <= lw || lw > 2)) {
        return { line1: right, line2: left, primary: 'line1' as const };
      }
      // Otherwise, show both parts in order
      return { line1: left, line2: right, primary: null };
    }
    // No colon: split by words so line2 is short (1-2 words) for strong visual
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return { line1: raw, line2: '', primary: 'line1' as const };
    // Prefer last 1 or 2 words on line2 depending on total length
    const take2 = tokens.length >= 4;
    const k = take2 ? 2 : 1;
    const line2 = tokens.slice(-k).join(' ');
    const line1 = tokens.slice(0, -k).join(' ');
    const wc = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
    const primary = wc(line2) <= 2 ? 'line2' : null;
    return { line1, line2, primary } as const;
  }, [article.title]);

  // Use raw lines as-is (always 2 lines max visually). No character clamp for H1.
  const { line1, line2, primary } = rawTitleInfo;

  // Backend-provided brand/publisher
  const brandName = article.publisherName || 'Kaburlu';
  const location = (article as any)?.author?.placeName || '—';
  const time = new Date(article.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const articleIndex1 = ((typeof index === 'number' ? index : 0) + 1);
  const totalCount = (typeof totalArticles === 'number' ? totalArticles : undefined);
  const timeWithCount = `${time}${totalCount ? ` • ${articleIndex1} of ${totalCount}` : ''}`;

  // Title colors: one strong, one light. Short lines (<=2 words) get strong; long lines get light.
  // If both short, the primary line is strong and the other is light; if both long, both light.
  const hexToRgba = (hex: string, alpha: number) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const hexToRgb = (hex: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  };
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, l };
  };
  const hslToRgb = (h: number, s: number, l: number) => {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    h = ((h % 360) + 360) % 360;
    h /= 360;
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };
  const complementHex = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const comp = hslToRgb(h + 180, s, l);
    return rgbToHex(comp.r, comp.g, comp.b);
  };
  const pickAccent = (key: string, idx?: number) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const base = h % DEFAULT_RANDOM_COLORS.length;
    const offset = typeof idx === 'number' ? (idx % DEFAULT_RANDOM_COLORS.length) : 0;
    const chosen = (base + offset) % DEFAULT_RANDOM_COLORS.length;
    return DEFAULT_RANDOM_COLORS[chosen];
  };
  const accentKey = String((article as any)?.id || article.title || 'kaburlu');
  const accent = pickAccent(accentKey, index);
  const wc2 = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
  const line1Short = wc2(line1) <= 2;
  const line2Short = wc2(line2) <= 2;
  // Keyword-based color theme from centralized config
  const themed = pickTitleColorTheme({ title: article.title, metaTitle: (article as any)?.metaTitle, tags: (article as any)?.tags });
  const complement = themed ? themed.secondary : complementHex(accent);
  const accentFinal = themed ? themed.primary : accent;
  // Decide strong line: pick the shorter line; if tie, use primary; else fall back to line1
  const bothLong = line1 && line2 && !line1Short && !line2Short;
  let strongLine: 'line1' | 'line2' | null = null;
  if (!bothLong) {
    if (!line1 && line2) strongLine = 'line2';
    else if (line1 && !line2) strongLine = 'line1';
    else if (line1 && line2) {
      if (line1Short && !line2Short) strongLine = 'line1';
      else if (!line1Short && line2Short) strongLine = 'line2';
      else if (primary === 'line1') strongLine = 'line1';
      else if (primary === 'line2') strongLine = 'line2';
      else strongLine = 'line1';
    }
  }
  let colorLine1 = undefined as string | undefined;
  let colorLine2 = undefined as string | undefined;
  if (line1 && line2) {
    if (bothLong) {
      colorLine1 = hexToRgba(accentFinal, 0.65);
      colorLine2 = hexToRgba(complement, 0.65);
    } else if (strongLine === 'line1') {
      colorLine1 = accentFinal;
      colorLine2 = hexToRgba(complement, 0.65);
    } else if (strongLine === 'line2') {
      colorLine1 = hexToRgba(complement, 0.65);
      colorLine2 = accentFinal;
    }
  } else if (line1 && !line2) {
    colorLine1 = line1Short ? accentFinal : hexToRgba(complement, 0.65);
  } else if (!line1 && line2) {
    colorLine2 = line2Short ? accentFinal : hexToRgba(complement, 0.65);
  }

  // Optional subheading from metaDescription or tags (H2). Clamp to 40 characters for a clean, bold strapline.
  const subHeadingRaw = (article.metaDescription || (article.tags && article.tags[0])) || '';
  const clampChars = (text?: string, maxChars: number = 40) => {
    const s = (text || '').trim();
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(0, maxChars - 1)) + '…';
  };
  const subHeading = clampChars(subHeadingRaw, 40);
  // H2 bar: vary background color per article index so repeated layout instances aren't identical
  const H2_BG_PALETTE = ['#37474F', '#263238', '#1F2937', '#4B5563', '#0F766E', '#7C2D12', '#4C1D95', '#374151'];
  const h2Idx = Math.abs(typeof index === 'number' ? index : 0) % H2_BG_PALETTE.length;
  const subHeadingBgColor = H2_BG_PALETTE[h2Idx];
  const subHeadingTextColor = '#fff';
  // Dynamic sizes (no 25% header). Short lines get larger baseline; allow shrink to fit.
  const wc = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
  const shortLine = (s: string) => wc(s) <= 2 || (s || '').length <= 8;
  const calcPrimarySize = (s: string) => shortLine(s) ? 46 : (s.length <= 22 ? 38 : 30);
  const calcSecondarySize = (s: string) => shortLine(s) ? 34 : (s.length <= 22 ? 28 : 24);
  const title1Size = primary === 'line1' ? calcPrimarySize(line1) : calcSecondarySize(line1);
  const title2Size = primary === 'line2' ? calcPrimarySize(line2) : calcSecondarySize(line2);
  // Dynamic, language-aware line heights to prevent clipping/overlap
  const isTeluguTitle = (languageCode === 'te') || isTelugu(line1 || '') || isTelugu(line2 || '');
  const line1IsShort = shortLine(line1);
  const line2IsShort = shortLine(line2);
  const lhFor = (size: number, isPrimary: boolean, isShort: boolean) => {
    let m = isPrimary ? 1.24 : 1.20; // base multipliers
    if (isTeluguTitle) m += 0.04;    // Telugu glyphs need more headroom
    if (isShort) m += 0.02;          // short, bold lines look nicer with a hair more leading
    if (m > 1.34) m = 1.34;          // safety cap
    return Math.round(size * m);
  };
  const line1LH = lhFor(title1Size, primary === 'line1', line1IsShort);
  const line2LH = lhFor(title2Size, primary === 'line2', line2IsShort);
  // Dynamic padding for H1 container to avoid any visual clipping at top/bottom across fonts
  const h1PadTop = Math.max(2, Math.ceil((title1Size || 0) * (isTeluguTitle ? 0.06 : 0.04)));
  const h1PadBottom = Math.max(3, Math.ceil((title2Size || 0) * (isTeluguTitle ? 0.08 : 0.06)));
  // Start large and let it shrink to fit width, so it visually fills the bar.
  const h2Size = 44;
  // Very small visual separation between H1 and H2 to avoid merging
  const h1h2Gap = 3;
  // line gap now handled via Text lineHeight; no explicit margin gap
  // Content font size: scale by word count (max 60 words). Shorter content gets larger font to reduce blank area.
  const excerptText = clampWords(article.body || article.summary, 60);
  const wordCount = (excerptText.match(/\S+/g) || []).length;
  const calcContentFont = (wc: number) => {
    if (wc >= 50) return 15;
    if (wc >= 40) return 16;
    if (wc >= 30) return 17;
    if (wc >= 20) return 18;
    if (wc >= 10) return 19;
    return 21; // very short content, make it slightly larger to reduce blank area
  };
  const contentFontSizeBase = calcContentFont(wordCount);

  // Server-synced reactions (LIKE/DISLIKE)
  const reaction = useReaction({ articleId: article.id });
  const isLiked = reaction.reaction === 'LIKE';
  const isDisliked = reaction.reaction === 'DISLIKE';
  const likeCount = reaction.likes ?? article.likes ?? 0;
  const dislikeCount = reaction.dislikes ?? article.dislikes ?? 0;
  const router = useRouter();
  const fullShareRef = useRef<ViewShot>(null);
  // Bottom bar toggle support (match LayoutOne behavior)
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { show, hide } = useAutoHideBottomBar(
    () => setTabBarVisible(true),
    () => setTabBarVisible(false),
    { timeout: 5000, minVisible: 500, debug: true }
  );
  const lastTouchYRef = useRef(0);
  const lastTouchStartAtRef = useRef(0);
  const lastTouchMovedRef = useRef(false);
  // Comments count: hydrate from cache/server and live update via events
  const [commentsCount, setCommentsCount] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = getCachedCommentsByShortNews(String(article.id));
        if (cached && !cancelled) {
          let total = 0;
          const walk = (arr: any[]) => { for (const n of arr) { total += 1; if (Array.isArray(n?.replies) && n.replies.length) walk(n.replies); } };
          walk(cached as any[]);
          setCommentsCount(total);
        }
        const fresh = await getCommentsByShortNews(String(article.id));
        if (!cancelled) {
          let total = 0; const walk = (arr: any[]) => { for (const n of arr) { total += 1; if (Array.isArray(n?.replies) && n.replies.length) walk(n.replies); } };
          walk(fresh as any[]); setCommentsCount(total);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [article?.id]);
  // Prefetch and live updates
  useEffect(() => { prefetchCommentsByShortNews(String(article.id)).catch(() => {}); }, [article?.id]);
  useEffect(() => { const off = on('comments:updated', (p) => { if (String(p.shortNewsId) === String(article.id)) setCommentsCount(p.total); }); return () => off(); }, [article?.id]);
  const onComment = useCallback(() => {
    router.push({ pathname: '/comments', params: { articleId: article.id, shortNewsId: article.id, authorId: (article as any)?.author?.id || (article as any)?.author?.name || undefined } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [router, article]);
  // Build share payload (URL + deep link + title)
  const buildSharePayload = useCallback(() => {
    const fallbackWeb = `${WEB_BASE_URL.replace(/\/$/, '')}/article/${encodeURIComponent(article.id)}`;
    const canonical = (article as any).canonicalUrl || fallbackWeb;
    const deepLink = `kaburlu://article/${article.id}`;
    const shareTitle = article.metaTitle || article.title || 'Kaburlu';
    const message = [shareTitle, `\nRead: ${canonical}`, `Open in App: ${deepLink}`].filter(Boolean).join('\n');
    return { shareTitle, message, canonical };
  }, [article]);
  const shareRuntime: typeof ShareLib | undefined = ShareLib || undefined;
  const onShare = useCallback(async () => {
    try {
      const { shareTitle, message } = buildSharePayload();
      // Render footer inside capture for share
      setShareMode(true);
      // Let layout settle briefly
      await new Promise((r) => setTimeout(r, 120));
      const captured = await fullShareRef.current?.capture?.();
      if (!captured) {
        // Fallback: share text only
        await RnShare.share({ title: shareTitle, message }, { dialogTitle: 'Share article' });
        if (Platform.OS === 'android') { try { await Clipboard.setStringAsync(message); ToastAndroid.show('Caption copied (paste if missing)', ToastAndroid.SHORT); } catch {} }
        return;
      }
      const imgUri = captured.startsWith('file://') ? captured : `file://${captured}`;
      // Prefer react-native-share (EXTRA_STREAM + text)
      try {
        if (shareRuntime?.open) {
          await shareRuntime.open({ url: imgUri, type: 'image/jpeg', message, title: shareTitle, failOnCancel: false });
        } else {
          throw new Error('react-native-share not available');
        }
      } catch {
        // Fallback to RN Share
        await RnShare.share({ title: shareTitle, message, url: imgUri }, { dialogTitle: 'Share article' });
      }
      if (Platform.OS === 'android') {
        try { await Clipboard.setStringAsync(message); ToastAndroid.show('Caption copied (paste if missing)', ToastAndroid.SHORT); } catch {}
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.warn('[LayoutTwo Share] failed', e);
      try {
        const ok = await Sharing.isAvailableAsync();
        if (ok) { try { await Sharing.shareAsync(undefined as any); } catch {} }
      } catch {}
    } finally { setShareMode(false); }
  }, [buildSharePayload, shareRuntime]);

  // Opinion bottom sheet state and language
  const [opinionVisible, setOpinionVisible] = useState(false);
  const [opinionType, setOpinionType] = useState<'positive' | 'negative' | null>(null);
  const tr = useTransliteration({ languageCode, enabled: true, debounceMs: 120, mode: 'on-boundary' });
  const onOpenOpinion = useCallback(() => { setOpinionType(null); tr.setRaw(''); setOpinionVisible(true); }, [tr, setOpinionType, setOpinionVisible]);
  const onSubmitOpinion = useCallback(() => {
    const text = tr.value?.trim();
    if (!opinionType || !text) { setOpinionVisible(false); return; }
    // TODO: Post to backend along with article id and opinionType
    try { console.log('[OPINION]', { type: opinionType, text, articleId: (article as any)?.id }); } catch {}
    setOpinionVisible(false);
  }, [opinionType, tr.value, article]);

  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Heights for dynamic content sizing
  const [hTopBar, setHTopBar] = useState(0);
  const [hH1, setHH1] = useState(0);
  const [hH2, setHH2] = useState(0);
  const [hBottomDock, setHBottomDock] = useState(0);
  const [hFooterCapture, setHFooterCapture] = useState(0);
  const [hBrandBar, setHBrandBar] = useState(0);
  const [shareMode, setShareMode] = useState(false);
  const isTeluguLang = (languageCode?.toLowerCase?.().startsWith('te')) || false;
  const brandTagline = isTeluguLang
    ? 'మొదటి పేపర్ తరహా ప్రతి కబుర్లు  మీకోసం : డౌన్లోడ్ అప్'
    : (brandName || 'Kaburlu');
  // Excerpt font size is slightly larger in share mode for readability
  const contentFontSize = shareMode ? (contentFontSizeBase + 2) : contentFontSizeBase;
  const contentLineHeight = Math.round(contentFontSize * 1.6);
  return (
    <View style={styles.screen}>
  {/* Capture content up to the author footer (exclude engagement), with white background */}
  <View pointerEvents="box-none">
  <ViewShot ref={fullShareRef} options={{ format: 'jpg', quality: 0.9, result: 'tmpfile', fileName: `kaburlu_${article.id || 'share'}` }} style={{ backgroundColor: '#fff' }}>
  <View
    style={[styles.topContent, { paddingTop: shareMode ? 0 : (insets.top + 8), backgroundColor: '#fff' }]}
    onTouchStart={(e) => {
      lastTouchYRef.current = e.nativeEvent.pageY;
      lastTouchStartAtRef.current = Date.now();
      lastTouchMovedRef.current = false;
    }}
    onTouchMove={(e) => {
      const y = e.nativeEvent.pageY;
      const dy = y - (lastTouchYRef.current || y);
      if (Math.abs(dy) > 2) lastTouchMovedRef.current = true;
      lastTouchYRef.current = y;
      // If visible and user slightly swipes up, hide immediately
      if (isTabBarVisible && dy < -2) {
        hide();
        setTabBarVisible(false);
      }
    }}
    onTouchEnd={() => {
      const dt = Date.now() - (lastTouchStartAtRef.current || 0);
      const isTap = !lastTouchMovedRef.current && dt < 300;
      if (isTap) {
        if (isTabBarVisible) {
          hide();
          setTabBarVisible(false);
        } else {
          show();
          setTabBarVisible(true);
        }
      }
    }}
  >
        {/* Branding bar only during share capture */}
        {shareMode && (
          <View style={styles.brandBar} onLayout={(e) => setHBrandBar(e.nativeEvent.layout.height)}>
            <View style={styles.brandBarRow}>
              <View style={styles.brandBarTextCol}>
                <Text
                  style={[styles.brandBarText, isTeluguLang && { fontFamily: 'AnekTelugu-Bold' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {brandTagline}
                </Text>
              </View>
              <View style={styles.brandBarLogoCol}>
                {/* SVG logo */}
                <TEBrandLogo width={120} height={30} />
              </View>
            </View>
          </View>
        )}
        {/* Top 4 columns row with background and dividers */}
  <View style={styles.topBar} onLayout={(e) => setHTopBar(e.nativeEvent.layout.height)}>
          <View style={styles.topRow}>
            {topCols.slice(0, 4).map((c, i) => (
              <View key={i} style={styles.topCellWrap}>
                <View style={styles.topCell}>
                  <Text style={styles.topColText} numberOfLines={1}>{c}</Text>
                </View>
                {i < 3 && <View style={styles.topCellDivider} />}
              </View>
            ))}
          </View>
        </View>

  {/* H1 Title (exactly two rows max, Telugu font if content is Telugu) */}
  <View style={[styles.h1Area, { paddingTop: h1PadTop, paddingBottom: h1PadBottom }]} onLayout={(e) => setHH1(e.nativeEvent.layout.height)}>
          {!!line1 && (
            <View>
              <Text
                style={[
                  primary === 'line1' ? styles.titleHighlight : styles.titleNormal,
                  { color: colorLine1, fontSize: title1Size, lineHeight: line1LH, includeFontPadding: true },
                  // Telugu H1: use Anek Telugu (requested)
                  (languageCode === 'te' || isTelugu(line1)) && { fontFamily: 'AnekTelugu-Bold' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={primary === 'line1' ? 0.6 : 0.8}
              >
                {line1}
              </Text>
            </View>
          )}
          {!!line2 && (
            <View>
              <Text
                style={[
                  primary === 'line2' ? styles.titleHighlight : styles.titleNormal,
                  { color: colorLine2, fontSize: title2Size, lineHeight: line2LH, includeFontPadding: true },
                  // Telugu H1: use Anek Telugu (requested)
                  (languageCode === 'te' || isTelugu(line2)) && { fontFamily: 'AnekTelugu-Bold' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={primary === 'line2' ? 0.6 : 0.8}
              >
                {line2}
              </Text>
            </View>
          )}
        </View>

        {/* H2 bar immediately after H1 (no large gap) */}
        {subHeading ? (
          <View style={[styles.subHeadingWrap, { backgroundColor: subHeadingBgColor, marginTop: h1h2Gap }]} onLayout={(e) => setHH2(e.nativeEvent.layout.height)}> 
            <Text
              style={[
                styles.subHeadingText,
                { color: subHeadingTextColor, fontSize: h2Size },
                // Telugu H2 uses Mandali Bold when language/content is Telugu
                (languageCode === 'te' || isTelugu(subHeading)) && { fontFamily: 'Mandali', fontWeight: '700' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {subHeading}
            </Text>
          </View>
        ) : null}

        {/* Image 16:9, full width, no side padding */}
        <Image source={{ uri: article.image || article.images?.[0] || '' }} style={styles.image} contentFit="cover" />

        {/* Excerpt ~60 words. Scale font to reduce blank space; Telugu uses Mandali. Fill up to author footer. */}
        <Text
          style={[
            styles.excerpt,
            { fontSize: contentFontSize, lineHeight: contentLineHeight },
            (languageCode === 'te' || isTelugu(excerptText)) && { fontFamily: 'Mandali' },
          ]}
          ellipsizeMode="clip"
          numberOfLines={(() => {
            const imageH = Math.round((typeof windowWidth === 'number' ? windowWidth : 360) * (9/16));
            const topPad = shareMode ? 0 : (insets.top + 8);
            const chromeTop = topPad + 14 /* topContent bottom pad */;
            const used = hTopBar + hH1 + h1h2Gap + hH2 + imageH + 10 /* excerpt marginTop */ + (shareMode ? (hFooterCapture + hBrandBar) : 0) + chromeTop;
            const winH = typeof windowHeight === 'number' ? windowHeight : 680;
            const avail = Math.max(0, winH - hBottomDock - used);
            const lines = Math.floor(avail / contentLineHeight);
            return lines > 0 ? lines : undefined;
          })()}
        >
          {excerptText}
        </Text>
        {/* Author footer (clone during share only) */}
        {shareMode ? (
          <View style={styles.footer} onLayout={(e) => setHFooterCapture(e.nativeEvent.layout.height)}>
            <View style={styles.footerLeft}>
              <Image source={{ uri: article.author?.avatar || article.publisherLogo || '' }} style={styles.avatar} />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.brand} numberOfLines={1}>
                  {brandName} • {location}
                </Text>
                <Text style={styles.authorSmall} numberOfLines={1}>{article.author?.name}</Text>
              </View>
            </View>
            <Text style={styles.timeSmall}>{timeWithCount}</Text>
          </View>
        ) : null}
  </View>
  </ViewShot>
  </View>

  {/* Bottom dock: footer above, engagement row as last (NOT captured in ViewShot) */}
  <View style={styles.bottomDock} onLayout={(e) => setHBottomDock(e.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Image source={{ uri: article.author?.avatar || article.publisherLogo || '' }} style={styles.avatar} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.brand} numberOfLines={1}>
                {brandName} • {location}
              </Text>
              <Text style={styles.authorSmall} numberOfLines={1}>{article.author?.name}</Text>
            </View>
          </View>
          <Text style={styles.timeSmall}>{timeWithCount}</Text>
        </View>
  <View style={styles.engagementRow} pointerEvents="auto">
          <View style={styles.engLeftCluster}>
            <View style={styles.likeGroup}>
              <TouchableOpacity
                accessibilityLabel="Like"
                disabled={reaction.updating}
                style={[styles.likeItem, styles.likeItemLeft, reaction.updating && { opacity: 0.6 }]}
                onPress={() => { reaction.like(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Feather name="thumbs-up" size={22} color={isLiked ? '#D32F2F' : '#111'} />
                <Text style={[styles.likeText, isLiked && { color: '#D32F2F' }]}>{likeCount}</Text>
              </TouchableOpacity>
              <View style={styles.likeDivider} />
              <TouchableOpacity
                accessibilityLabel="Dislike"
                disabled={reaction.updating}
                style={[styles.likeItem, styles.likeItemRight, reaction.updating && { opacity: 0.6 }]}
                onPress={() => { reaction.dislike(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Feather name="thumbs-down" size={22} color={isDisliked ? '#D32F2F' : '#111'} />
                <Text style={[styles.likeText, isDisliked && { color: '#D32F2F' }]}>{dislikeCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.engRightCluster}>
            <TouchableOpacity style={styles.flatBtn} onPress={onComment}>
              <Feather name="message-circle" size={22} color="#111" />
              <Text style={styles.flatBtnText}>{commentsCount}</Text>
            </TouchableOpacity>
            {/* Opinion: single icon opens sheet */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setOpinionType(null); onOpenOpinion(); }}>
              <Feather name="edit-3" size={22} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onShare}>
              <Feather name="share-2" size={22} color="#111" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Opinion Bottom Sheet */}
      <BottomSheet
        visible={opinionVisible}
        onClose={() => setOpinionVisible(false)}
        snapPoints={[0.45, 0.8]}
        initialSnapIndex={0}
        dragEnabled={false}
        accessibilityLabel="Opinion sheet"
      >
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Share your opinion</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }} pointerEvents="auto">
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Mark opinion positive"
              onPressIn={() => { setOpinionType('positive'); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              onPress={() => { setOpinionType('positive'); }}
              style={[styles.opBtn, opinionType === 'positive' && styles.opBtnPositiveActive]}
            >
              <Feather name="thumbs-up" size={18} color={opinionType === 'positive' ? '#fff' : '#555'} />
              <Text style={[styles.opBtnText, opinionType === 'positive' && styles.opBtnTextActive]}>Positive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Mark opinion negative"
              onPressIn={() => { setOpinionType('negative'); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              onPress={() => { setOpinionType('negative'); }}
              style={[styles.opBtn, opinionType === 'negative' && styles.opBtnNegativeActive]}
            >
              <Feather name="thumbs-down" size={18} color={opinionType === 'negative' ? '#fff' : '#555'} />
              <Text style={[styles.opBtnText, opinionType === 'negative' && styles.opBtnTextActive]}>Negative</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Type your opinion (max 50)"
            value={tr.value}
            onChangeText={tr.onChangeText}
            maxLength={50}
            multiline
            numberOfLines={3}
            style={styles.opInput}
          />
          <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
            <TouchableOpacity onPress={() => setOpinionVisible(false)} style={[styles.opSheetBtn, { flex: 1, borderRadius: 0 }]}>
              <Text style={{ textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!(opinionType && (tr.value || '').trim())}
              onPress={onSubmitOpinion}
              style={[styles.opSheetBtn, styles.opSheetPrimary, { flex: 1, borderRadius: 0 }, !(opinionType && (tr.value || '').trim()) && { opacity: 0.6 }]}
            >
              <Text style={{ color: '#fff', textAlign: 'center' }}>Submit</Text>
            </TouchableOpacity>
          </View>
          {tr.lastError ? <Text style={{ color: '#c00', fontSize: 12 }}>Transliteration error: {tr.lastError}</Text> : null}
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  topContent: { paddingBottom: 8 },
  // Top bar with background and column dividers (soft)
  topBar: { backgroundColor: '#FFEBEE', borderBottomWidth: 0, paddingTop: 6, paddingBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'stretch' },
  topCellWrap: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  topCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  topCellDivider: { width: 1, backgroundColor: '#B71C1C22', alignSelf: 'stretch' },
  topColText: { fontSize: 14, color: '#B71C1C', textAlign: 'center', fontWeight: '700' },
  headerArea: { justifyContent: 'space-between', paddingHorizontal: 0, marginTop: 6 },
  h1Area: { paddingHorizontal: 12, alignItems: 'center', paddingBottom: 6 },
  titleHighlight: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginVertical: 0, paddingHorizontal: 12 },
  titleNormal: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginVertical: 0, paddingHorizontal: 12 },
  teluguFont: { fontFamily: 'Pottisreeramulu' },
  subHeadingWrap: { paddingVertical: 8, paddingHorizontal: 0 },
  subHeadingText: { fontSize: 14, textAlign: 'center', fontWeight: '800' },
  image: { width: '100%', aspectRatio: 16/9, marginTop: 0, backgroundColor: '#e5e7eb' },
  excerpt: { marginTop: 8, fontSize: 14, color: '#333', paddingHorizontal: 14 },
  bottomDock: { marginTop: 'auto', paddingTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 14, paddingBottom: 8 },
  footerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' },
  brand: { fontSize: 13, color: '#444', fontWeight: '700' },
  authorSmall: { fontSize: 12, color: '#666' },
  timeSmall: { fontSize: 12, color: '#999' },
  engagementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 8 },
  engLeftCluster: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  engRightCluster: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engBtn: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 56, alignItems: 'center' },
  likeGroup: { flexDirection: 'row', alignItems: 'center' },
  likeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, gap: 6 },
  likeItemLeft: { },
  likeItemRight: { },
  likeDivider: { width: 1, height: 18, backgroundColor: '#eaeaea', marginHorizontal: 2 },
  likeText: { fontSize: 13, color: '#111', fontWeight: '600' },
  flatBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, gap: 6 },
  flatBtnText: { fontSize: 14, color: '#111', fontWeight: '600' },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  // Opinion sheet styles (beautified)
  opBtn: { paddingVertical: 10, paddingHorizontal: 18, borderWidth: 0, borderColor: 'transparent', borderRadius: 22, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  opBtnActive: { backgroundColor: '#D32F2F' },
  opBtnPositive: { borderColor: '#22c55e', borderWidth: 1 },
  opBtnNegative: { borderColor: '#ef4444', borderWidth: 1 },
  opBtnPositiveActive: { backgroundColor: '#22c55e' },
  opBtnNegativeActive: { backgroundColor: '#ef4444' },
  opBtnText: { fontSize: 14, color: '#333', fontWeight: '700' },
  opBtnTextActive: { color: '#fff', fontWeight: '700' },
  opInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: 'top' },
  opSheetBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#eee' },
  opSheetPrimary: { backgroundColor: '#D32F2F' },
  // Share branding bar
  brandBar: { backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 8 },
  brandBarRow: { flexDirection: 'row', alignItems: 'center' },
  brandBarTextCol: { flex: 7, justifyContent: 'center' },
  brandBarLogoCol: { flex: 3, alignItems: 'flex-end' },
  brandBarText: { color: '#fff', fontSize: 22, lineHeight: 22, includeFontPadding: false, fontWeight: '800', textAlign: 'left' },
});

export default LayoutTwo;
