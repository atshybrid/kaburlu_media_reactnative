import { getTeluguPlaceName } from '@/constants/placeLexicon';
import { useReaction } from '@/hooks/useReaction';
import { useTransliteration } from '@/hooks/useTransliteration';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { Platform, Pressable, Share as RnShare, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View, useWindowDimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ShareLib from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import BottomSheet from '../ui/BottomSheet';
import type { ArticleLayoutComponent } from './types';

// Professional newspaper color palette - refined and balanced
const THEME_COLORS = {
  // Primary accent colors
  crimsonRed: '#B91C1C',      // Breaking news, urgent
  forestGreen: '#047857',     // Positive, environment
  royalBlue: '#1E40AF',       // Politics, trust
  deepPurple: '#6D28D9',      // Culture, lifestyle
  goldenOrange: '#D97706',    // Human interest, warmth
  tealBlue: '#0369A1',        // Technology, innovation
  // Neutral tones
  charcoal: '#1F2937',
  slate: '#475569',
  lightGray: '#F3F4F6',
  border: '#E5E7EB',
  // UI states
  activeLike: '#EF4444',
  activeDislike: '#7C3AED',
};

const ACCENT_PALETTE = [
  THEME_COLORS.crimsonRed,
  THEME_COLORS.forestGreen,
  THEME_COLORS.royalBlue,
  THEME_COLORS.deepPurple,
  THEME_COLORS.goldenOrange,
  THEME_COLORS.tealBlue,
];

// Utility: Smart text clamping with word awareness
const clampWords = (text?: string, maxWords = 60) => {
  if (!text) return '';
  const parts = String(text).split(/\s+/).filter(Boolean);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(' ') + '…';
};

const clampChars = (text?: string, maxChars = 100) => {
  const s = (text || '').trim();
  if (s.length <= maxChars) return s;
  // Find last space before limit for clean word break
  const truncated = s.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '…';
};

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
    const base = h % ACCENT_PALETTE.length;
    const offset = typeof idx === 'number' ? (idx % ACCENT_PALETTE.length) : 0;
    const chosen = (base + offset) % ACCENT_PALETTE.length;
    return ACCENT_PALETTE[chosen];
  };
  const accentKey = String((article as any)?.id || article.title || 'kaburlu');
  const accent = pickAccent(accentKey, index);
  // Keyword-based color theme from centralized config
  const themed = pickTitleColorTheme({ title: article.title, metaTitle: (article as any)?.metaTitle, tags: (article as any)?.tags });
  const complement = themed ? themed.secondary : complementHex(accent);
  const accentFinal = themed ? themed.primary : accent;
  // Title colors - determine which line gets strong color
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

  // H2 subheading - ONLY show metaTitle if it's different from title (not summary)
  const subHeadingRaw = ((article as any).metaTitle || '').trim();
  const titleLower = (article.title || '').toLowerCase().trim();
  const subLower = subHeadingRaw.toLowerCase().trim();
  
  // Only show if:
  // 1. metaTitle exists
  // 2. metaTitle is different from title (not just a repeat)
  // 3. metaTitle has meaningful content (more than 5 chars)
  const isDifferentFromTitle = subHeadingRaw && subHeadingRaw.length > 5 && subLower !== titleLower;
  const subHeading = isDifferentFromTitle ? clampChars(subHeadingRaw, 100) : '';
  
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
  
  // Optimized line heights - balanced spacing for readability
  const isTeluguTitle = (languageCode === 'te') || isTelugu(line1 || '') || isTelugu(line2 || '');
  const line1IsShort = shortLine(line1);
  const line2IsShort = shortLine(line2);
  
  // Proper line height calculation - Telugu needs more space for tall glyphs
  const lhFor = (size: number, isPrimary: boolean, isShort: boolean) => {
    // Base multiplier for clean spacing
    let m = isPrimary ? 1.20 : 1.15;  // Increased from 1.15/1.10
    
    // Telugu fonts need more headroom for proper glyph rendering
    if (isTeluguTitle) {
      m += 0.18;  // Increased from 0.10 for better spacing
    }
    
    // Short lines can be slightly tighter (only for non-Telugu)
    if (isShort && !isTeluguTitle) {
      m -= 0.02;
    }
    
    // Safety caps
    if (m > 1.45) m = 1.45;  // Increased cap for Telugu
    if (m < 1.10) m = 1.10;  // Minimum to prevent clipping
    
    return Math.round(size * m);
  };
  const line1LH = lhFor(title1Size, primary === 'line1', line1IsShort);
  const line2LH = lhFor(title2Size, primary === 'line2', line2IsShort);
  
  // Dynamic padding for H1 container - proper spacing for Telugu glyphs
  const h1PadTop = Math.max(14, Math.ceil((title1Size || 0) * (isTeluguTitle ? 0.28 : 0.18)));  // Increased for Telugu
  const h1PadBottom = Math.max(3, Math.ceil((title2Size || 0) * (isTeluguTitle ? 0.08 : 0.04)));  // Increased slightly
  
  // Dynamic H1-H2 gap based on whether H2 exists and content type
  const h1h2Gap = (() => {
    if (!subHeading) return 0;  // No gap if no H2
    if (isTeluguTitle) return 4;  // Slightly more for Telugu
    return 2;  // Minimal gap for tight design
  })();
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

  // Professional fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
    <Pressable 
      style={{ flex: 1 }}
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
                  { color: colorLine1, fontSize: title1Size, lineHeight: line1LH, includeFontPadding: false, paddingTop: isTeluguTitle ? 8 : 0 },
                  // Telugu H1: use Noto Serif Telugu Bold (Google Fonts recommended for news)
                  (languageCode === 'te' || isTelugu(line1)) && { fontFamily: 'NotoSerifTelugu_700Bold' },
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
            <View style={{ marginTop: isTeluguTitle ? 1 : 0 }}>
              <Text
                style={[
                  primary === 'line2' ? styles.titleHighlight : styles.titleNormal,
                  { color: colorLine2, fontSize: title2Size, lineHeight: line2LH, includeFontPadding: false },
                  // Telugu H1: use Noto Serif Telugu Bold (Google Fonts recommended for news)
                  (languageCode === 'te' || isTelugu(line2)) && { fontFamily: 'NotoSerifTelugu_700Bold' },
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
                // Telugu H2 uses Noto Sans Telugu SemiBold (Google Fonts recommended)
                (languageCode === 'te' || isTelugu(subHeading)) && { fontFamily: 'NotoSansTelugu_600SemiBold' },
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
            // Telugu body: use Noto Sans Telugu Regular (Google Fonts - best readability)
            (languageCode === 'te' || isTelugu(excerptText)) && { fontFamily: 'NotoSansTelugu_400Regular' },
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
                <MaterialCommunityIcons 
                  name={isLiked ? "thumb-up" : "thumb-up-outline"} 
                  size={22} 
                  color={isLiked ? THEME_COLORS.activeLike : THEME_COLORS.slate} 
                />
                <Text style={[styles.likeText, isLiked && { color: THEME_COLORS.activeLike }]}>{likeCount}</Text>
              </TouchableOpacity>
              <View style={styles.likeDivider} />
              <TouchableOpacity
                accessibilityLabel="Dislike"
                disabled={reaction.updating}
                style={[styles.likeItem, styles.likeItemRight, reaction.updating && { opacity: 0.6 }]}
                onPress={() => { reaction.dislike(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <MaterialCommunityIcons 
                  name={isDisliked ? "thumb-down" : "thumb-down-outline"} 
                  size={22} 
                  color={isDisliked ? THEME_COLORS.activeDislike : THEME_COLORS.slate} 
                />
                <Text style={[styles.likeText, isDisliked && { color: THEME_COLORS.activeDislike }]}>{dislikeCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.engRightCluster}>
            <TouchableOpacity style={styles.flatBtn} onPress={onComment}>
              <MaterialCommunityIcons name="comment-text-outline" size={22} color={THEME_COLORS.charcoal} />
              <Text style={styles.flatBtnText}>{commentsCount}</Text>
            </TouchableOpacity>
            {/* Opinion: single icon opens sheet */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setOpinionType(null); onOpenOpinion(); }}>
              <MaterialCommunityIcons name="pencil-outline" size={22} color={THEME_COLORS.charcoal} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onShare}>
              <MaterialCommunityIcons name="share-variant-outline" size={22} color={THEME_COLORS.charcoal} />
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
        <View style={{ gap: 16, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'center', color: THEME_COLORS.charcoal }}>Share your opinion</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }} pointerEvents="auto">
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mark opinion positive"
              onPressIn={() => { setOpinionType('positive'); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              onPress={() => { setOpinionType('positive'); }}
              style={[styles.opBtn, opinionType === 'positive' && styles.opBtnPositiveActive]}
            >
              <MaterialCommunityIcons name="thumb-up" size={20} color={opinionType === 'positive' ? '#fff' : THEME_COLORS.slate} />
              <Text style={[styles.opBtnText, opinionType === 'positive' && styles.opBtnTextActive]}>Positive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mark opinion negative"
              onPressIn={() => { setOpinionType('negative'); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              onPress={() => { setOpinionType('negative'); }}
              style={[styles.opBtn, opinionType === 'negative' && styles.opBtnNegativeActive]}
            >
              <MaterialCommunityIcons name="thumb-down" size={20} color={opinionType === 'negative' ? '#fff' : THEME_COLORS.slate} />
              <Text style={[styles.opBtnText, opinionType === 'negative' && styles.opBtnTextActive]}>Negative</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Type your opinion (max 50 characters)"
            placeholderTextColor="#9CA3AF"
            value={tr.value}
            onChangeText={tr.onChangeText}
            maxLength={50}
            multiline
            numberOfLines={3}
            style={styles.opInput}
          />
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: 12 }}>
            <TouchableOpacity onPress={() => setOpinionVisible(false)} style={[styles.opSheetBtn, { flex: 1 }]}>
              <Text style={{ textAlign: 'center', fontWeight: '700', fontSize: 15, color: THEME_COLORS.charcoal }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!(opinionType && (tr.value || '').trim())}
              onPress={onSubmitOpinion}
              style={[styles.opSheetBtn, styles.opSheetPrimary, { flex: 1 }, !(opinionType && (tr.value || '').trim()) && { opacity: 0.5 }]}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 15 }}>Submit</Text>
            </TouchableOpacity>
          </View>
          {tr.lastError ? <Text style={{ color: '#c00', fontSize: 12 }}>Transliteration error: {tr.lastError}</Text> : null}
        </View>
      </BottomSheet>
    </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  topContent: { 
    paddingBottom: 12 
  },
  // Masthead bar with refined orange brand theme
  topBar: { 
    backgroundColor: '#FF8C00', 
    borderBottomWidth: 2, 
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8, 
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  topRow: { 
    flexDirection: 'row', 
    alignItems: 'stretch' 
  },
  topCellWrap: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'stretch' 
  },
  topCell: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8 
  },
  topCellDivider: { 
    width: 1, 
    backgroundColor: 'rgba(255,255,255,0.4)', 
    alignSelf: 'stretch' 
  },
  topColText: { 
    fontSize: 13, 
    color: '#FFFFFF', 
    textAlign: 'center', 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerArea: { 
    justifyContent: 'space-between', 
    paddingHorizontal: 0, 
    marginTop: 8 
  },
  // Title area with improved spacing
  h1Area: { 
    paddingHorizontal: 20, 
    alignItems: 'center', 
    paddingBottom: 6,  // Reduced from 8
    paddingTop: 10      // Reduced from 12
  },
  titleHighlight: { 
    fontSize: 38, 
    fontWeight: '900', 
    textAlign: 'center', 
    marginVertical: 0,  // No vertical margin
    paddingHorizontal: 8, 
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0,0,0,0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleNormal: { 
    fontSize: 28, 
    fontWeight: '700', 
    textAlign: 'center', 
    marginVertical: 0,  // No vertical margin
    paddingHorizontal: 8, 
    letterSpacing: -0.4 
  },
  teluguFont: { 
    fontFamily: 'Pottisreeramulu' 
  },
  // Subheading bar with gradient effect
  subHeadingWrap: { 
    paddingVertical: 10,  // Reduced from 12
    paddingHorizontal: 20, 
    marginHorizontal: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  subHeadingText: { 
    fontSize: 17, 
    textAlign: 'center', 
    fontWeight: '600', 
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  // Professional image styling
  image: { 
    width: '100%', 
    aspectRatio: 16/9, 
    marginTop: 6, 
    backgroundColor: THEME_COLORS.lightGray, 
    borderRadius: 0,
  },
  // Refined excerpt typography
  excerpt: { 
    marginTop: 14, 
    fontSize: 16, 
    color: THEME_COLORS.charcoal, 
    paddingHorizontal: 20, 
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  // Footer with clean separation
  bottomDock: { 
    marginTop: 'auto', 
    paddingTop: 8, 
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.border,
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 8, 
    paddingHorizontal: 20, 
    paddingBottom: 10 
  },
  footerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1,
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: THEME_COLORS.lightGray,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
  },
  brand: { 
    fontSize: 14, 
    color: THEME_COLORS.charcoal, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  authorSmall: { 
    fontSize: 13, 
    color: THEME_COLORS.slate,
    marginTop: 2,
  },
  timeSmall: { 
    fontSize: 12, 
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // Modern engagement row with card-like clusters
  engagementRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 12, 
    paddingTop: 10,
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.border,
  },
  engLeftCluster: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  engRightCluster: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  engBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    minWidth: 60, 
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  // Like/Dislike group with pill design
  likeGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  likeItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    gap: 6 
  },
  likeItemLeft: {},
  likeItemRight: {},
  likeDivider: { 
    width: 1.5, 
    height: 24, 
    backgroundColor: THEME_COLORS.border, 
    marginHorizontal: 2 
  },
  likeText: { 
    fontSize: 15, 
    color: THEME_COLORS.charcoal, 
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  // Refined flat buttons
  flatBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    gap: 6, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  flatBtnText: { 
    fontSize: 14, 
    color: THEME_COLORS.charcoal, 
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  iconBtn: { 
    paddingVertical: 9, 
    paddingHorizontal: 12, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Opinion sheet with modern design
  opBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderWidth: 2, 
    borderColor: THEME_COLORS.border, 
    borderRadius: 24, 
    backgroundColor: '#FFFFFF', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 } 
  },
  opBtnActive: { 
    borderWidth: 2,
  },
  opBtnPositive: {},
  opBtnNegative: {},
  opBtnPositiveActive: { 
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  opBtnNegativeActive: { 
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  opBtnText: { 
    fontSize: 15, 
    color: THEME_COLORS.charcoal, 
    fontWeight: '700' 
  },
  opBtnTextActive: { 
    color: '#FFFFFF', 
    fontWeight: '700' 
  },
  opInput: { 
    borderWidth: 1.5, 
    borderColor: THEME_COLORS.border, 
    borderRadius: 12, 
    padding: 14, 
    minHeight: 80, 
    textAlignVertical: 'top',
    fontSize: 15,
    backgroundColor: '#FAFBFC',
  },
  opSheetBtn: { 
    paddingVertical: 14, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    backgroundColor: THEME_COLORS.lightGray,
    alignItems: 'center',
  },
  opSheetPrimary: { 
    backgroundColor: THEME_COLORS.royalBlue 
  },
  // Share branding bar
  brandBar: { 
    backgroundColor: '#000000', 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#FF8C00',
  },
  brandBarRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  brandBarTextCol: { 
    flex: 7, 
    justifyContent: 'center' 
  },
  brandBarLogoCol: { 
    flex: 3, 
    alignItems: 'flex-end' 
  },
  brandBarText: { 
    color: '#FFFFFF', 
    fontSize: 22, 
    lineHeight: 26, 
    includeFontPadding: false, 
    fontWeight: '900', 
    textAlign: 'left',
    letterSpacing: 0.5,
  },
});

export default LayoutTwo;
