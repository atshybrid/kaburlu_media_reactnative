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
import { Platform, Pressable, Share as RnShare, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ShareLib from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import BottomSheet from '../ui/BottomSheet';
import type { ArticleLayoutComponent } from './types';

// Colors - Bright, solid colors for excellent visibility
const DEFAULT_RANDOM_COLORS = [
  '#DC2626', // Red - Breaking, urgent
  '#059669', // Emerald - Fresh, positive
  '#2563EB', // Blue - Professional, trustworthy
  '#7C3AED', // Violet - Creative, culture
  '#D97706', // Amber - Warm, human interest
  '#0891B2', // Cyan - Modern, tech
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

  // Build title lines with special ":" rule - improved for better 2-line display
  const rawTitleInfo = useMemo(() => {
    const raw = (article.title || '').trim();
    if (!raw) return { line1: '', line2: '', primary: null } as const;
    
    // Count words to determine alignment and sizing
    const wordCount = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
    const totalWords = wordCount(raw);
    
    if (raw.includes(':')) {
      const firstIdx = raw.indexOf(':');
      const left = raw.slice(0, firstIdx).trim();
      const right = raw.slice(firstIdx + 1).trim();
      const lw = wordCount(left);
      const rw = wordCount(right);
      // If either side is 1-3 words, make it the primary (larger) line
      if (lw > 0 && lw <= 3 && (lw <= rw || rw > 3)) {
        return { line1: left, line2: right, primary: 'line1' as const };
      }
      if (rw > 0 && rw <= 3 && (rw <= lw || lw > 3)) {
        return { line1: right, line2: left, primary: 'line1' as const };
      }
      // Otherwise, show both parts in order
      return { line1: left, line2: right, primary: null };
    }
    
    // No colon: intelligently split for 2-line display
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return { line1: raw, line2: '', primary: 'line1' as const };
    
    // For longer titles, split roughly in half for balanced 2-line display
    if (tokens.length >= 6) {
      const mid = Math.ceil(tokens.length / 2);
      const line1 = tokens.slice(0, mid).join(' ');
      const line2 = tokens.slice(mid).join(' ');
      return { line1, line2, primary: 'line1' as const };
    }
    
    // For shorter titles, prefer last 1-2 words on line2
    const take2 = tokens.length >= 4;
    const k = take2 ? 2 : 1;
    const line2 = tokens.slice(-k).join(' ');
    const line1 = tokens.slice(0, -k).join(' ');
    const primary = wordCount(line2) <= 2 ? 'line2' : null;
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
  
  // Title colors - ALL SOLID BRIGHT COLORS, no faded/light colors
  // Line1 uses accent color, Line2 uses complement color - both solid
  let colorLine1 = undefined as string | undefined;
  let colorLine2 = undefined as string | undefined;
  if (line1 && line2) {
    // Both lines use solid colors
    colorLine1 = accentFinal;
    colorLine2 = complement;
  } else if (line1 && !line2) {
    colorLine1 = accentFinal;
  } else if (!line1 && line2) {
    colorLine2 = accentFinal;
  }

  // H2 subheading - ONLY show if article has explicit metaTitle (not metaDescription or tags)
  const subHeadingRaw = ((article as any).metaTitle || '').trim();
  const clampChars = (text?: string, maxChars: number = 80) => {
    const s = (text || '').trim();
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(0, maxChars - 1)) + '…';
  };
  // Only show if there's actual subheading content
  const subHeading = subHeadingRaw ? clampChars(subHeadingRaw, 80) : '';
  // H2 bar: rich colors that stand out
  const H2_BG_PALETTE = ['#1E40AF', '#7C3AED', '#047857', '#B91C1C', '#0369A1', '#6D28D9', '#0F766E', '#A16207'];
  const h2Idx = Math.abs(typeof index === 'number' ? index : 0) % H2_BG_PALETTE.length;
  const subHeadingBgColor = H2_BG_PALETTE[h2Idx];
  const subHeadingTextColor = '#fff';
  // Dynamic sizes - consistent hierarchy for better readability
  const wc = (s: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
  const shortLine = (s: string) => wc(s) <= 3 || (s || '').length <= 12;
  const calcPrimarySize = (s: string) => shortLine(s) ? 40 : (s.length <= 28 ? 36 : 32);
  const calcSecondarySize = (s: string) => shortLine(s) ? 30 : (s.length <= 28 ? 26 : 24);
  const title1Size = primary === 'line1' ? calcPrimarySize(line1) : calcSecondarySize(line1);
  const title2Size = primary === 'line2' ? calcPrimarySize(line2) : calcSecondarySize(line2);
  // Dynamic, language-aware line heights - tighter spacing between lines
  const isTeluguTitle = (languageCode === 'te') || isTelugu(line1 || '') || isTelugu(line2 || '');
  const line1IsShort = shortLine(line1);
  const line2IsShort = shortLine(line2);
  const lhFor = (size: number, isPrimary: boolean, isShort: boolean) => {
    // Telugu fonts need more headroom to prevent top crop
    let m = isPrimary ? 1.25 : 1.20;
    if (isTeluguTitle) m += 0.15;    // Telugu glyphs need significantly more headroom
    if (m > 1.45) m = 1.45;          // safety cap
    return Math.round(size * m);
  };
  const line1LH = lhFor(title1Size, primary === 'line1', line1IsShort);
  const line2LH = lhFor(title2Size, primary === 'line2', line2IsShort);
  // Dynamic padding for H1 container - more top padding to prevent crop into header
  const h1PadTop = Math.max(18, Math.ceil((title1Size || 0) * (isTeluguTitle ? 0.30 : 0.20)));
  const h1PadBottom = Math.max(4, Math.ceil((title2Size || 0) * (isTeluguTitle ? 0.08 : 0.06)));
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
    const baseUrl = WEB_BASE_URL.replace(/\/$/, '');
    const slug = (article as any).slug;
    // Prefer canonicalUrl > slug-based URL > id-based fallback
    const fallbackWeb = slug
      ? `${baseUrl}/${encodeURIComponent(slug)}`
      : `${baseUrl}/article/${encodeURIComponent(article.id)}`;
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

  // Handle tap to toggle bottom navigation
  const handleScreenTap = useCallback(() => {
    if (isTabBarVisible) {
      hide();
      setTabBarVisible(false);
    } else {
      show();
      setTabBarVisible(true);
    }
  }, [isTabBarVisible, hide, show, setTabBarVisible]);
  
  return (
    <Pressable 
      style={styles.screen}
      onPress={handleScreenTap}
    >
  {/* Capture content up to the author footer (exclude engagement), with white background */}
  <View pointerEvents="box-none">
  <ViewShot ref={fullShareRef} options={{ format: 'jpg', quality: 0.9, result: 'tmpfile', fileName: `kaburlu_${article.id || 'share'}` }} style={{ backgroundColor: '#fff' }}>
  <View
    style={[styles.topContent, { paddingTop: shareMode ? 0 : (insets.top + 8), backgroundColor: '#fff' }]}
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
                  { color: colorLine1, fontSize: title1Size, lineHeight: line1LH, includeFontPadding: false, paddingTop: isTeluguTitle ? 6 : 0 },
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
                  { color: colorLine2, fontSize: title2Size, lineHeight: line2LH, includeFontPadding: false },
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

        {/* H2 bar immediately after H1 - max 2 lines, center aligned */}
        {subHeading ? (
          <View style={[styles.subHeadingWrap, { backgroundColor: subHeadingBgColor, marginTop: h1h2Gap }]} onLayout={(e) => setHH2(e.nativeEvent.layout.height)}> 
            <Text
              style={[
                styles.subHeadingText,
                { color: subHeadingTextColor },
                // Telugu H2 uses Mandali Bold when language/content is Telugu
                (languageCode === 'te' || isTelugu(subHeading)) && { fontFamily: 'Mandali', fontWeight: '700' },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
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
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  topContent: { paddingBottom: 8 },
  // Top bar with background and column dividers - brand orange theme
  topBar: { backgroundColor: '#ff9934', borderBottomWidth: 0, paddingTop: 6, paddingBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'stretch' },
  topCellWrap: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  topCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  topCellDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'stretch' },
  topColText: { fontSize: 13, color: '#ffffff', textAlign: 'center', fontWeight: '700' },
  headerArea: { justifyContent: 'space-between', paddingHorizontal: 0, marginTop: 6 },
  h1Area: { paddingHorizontal: 16, alignItems: 'center', paddingBottom: 4, paddingTop: 8 },
  titleHighlight: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginVertical: 0, paddingHorizontal: 8, letterSpacing: -0.5 },
  titleNormal: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginVertical: 0, paddingHorizontal: 8, letterSpacing: -0.3 },
  teluguFont: { fontFamily: 'Pottisreeramulu' },
  subHeadingWrap: { paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 0 },
  subHeadingText: { fontSize: 18, textAlign: 'center', fontWeight: '600', lineHeight: 24 },
  image: { width: '100%', aspectRatio: 16/9, marginTop: 0, backgroundColor: '#f3f4f6', borderRadius: 0 },
  excerpt: { marginTop: 10, fontSize: 16, color: '#374151', paddingHorizontal: 16, lineHeight: 26 },
  bottomDock: { marginTop: 'auto', paddingTop: 6, backgroundColor: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 16, paddingBottom: 8 },
  footerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  brand: { fontSize: 14, color: '#374151', fontWeight: '700' },
  authorSmall: { fontSize: 12, color: '#6B7280' },
  timeSmall: { fontSize: 12, color: '#9CA3AF' },
  engagementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  engLeftCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  engRightCluster: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  engBtn: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 56, alignItems: 'center' },
  likeGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 24, paddingHorizontal: 4 },
  likeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, gap: 6 },
  likeItemLeft: { },
  likeItemRight: { },
  likeDivider: { width: 1, height: 20, backgroundColor: '#E5E7EB', marginHorizontal: 0 },
  likeText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  flatBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, gap: 6, backgroundColor: '#F9FAFB', borderRadius: 20 },
  flatBtnText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderRadius: 20 },
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
