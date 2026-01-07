import { ThemedText } from '@/components/ThemedText';
import CategoryPicker, { type LiteCategory } from '@/components/ui/CategoryPicker';
import { Colors } from '@/constants/Colors';
import { formatMonthDayFromLexicon, getDateLineLanguage, getHierarchyLabel, normalizeLangBaseCode } from '@/constants/dateLineLexicon';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getTenantCategories, type CategoryItem } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { HttpError } from '@/services/http';
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
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function normalizeSpaces(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeLocationSearchQuery(raw: string, langCode?: string): string {
  let q = normalizeSpaces(raw);
  if (!q) return '';

  // Drop anything inside parentheses (often includes tenant name/date).
  q = q.replace(/\([^)]*\)/g, ' ');

  // Strip hierarchy labels for the active language (e.g. తెలుగు: జిల్లా/మండలం/గ్రామం/రాష్ట్రం)
  const base = getDateLineLanguage(langCode);
  const labelsToStrip = (['state', 'district', 'mandal', 'village'] as const)
    .map((k) => getHierarchyLabel(base, k))
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  for (const lbl of labelsToStrip) {
    q = q.replace(new RegExp(`\\s*${escapeRegExp(lbl)}\\s*`, 'g'), ' ');
  }

  // Also strip common English suffixes.
  q = q.replace(/\b(state|district|mandal|village)\b/gi, ' ');

  return normalizeSpaces(q);
}

function normalizeKey(s: string): string {
  return normalizeSpaces(s).toLowerCase();
}

function bigrams(s: string): string[] {
  const x = normalizeSpaces(s).toLowerCase();
  if (x.length < 2) return x ? [x] : [];
  const out: string[] = [];
  for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2));
  return out;
}

function diceSimilarity(a: string, b: string): number {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.length || !bb.length) return 0;
  const m = new Map<string, number>();
  for (const g of aa) m.set(g, (m.get(g) || 0) + 1);
  let inter = 0;
  for (const g of bb) {
    const c = m.get(g) || 0;
    if (c > 0) {
      inter += 1;
      m.set(g, c - 1);
    }
  }
  return (2 * inter) / (aa.length + bb.length);
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
  const fallback = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const month = months[d.getMonth()] || 'January';
    const day = String(d.getDate()).padStart(2, '0');
    return `${month} ${day}`;
  };

  const hasIntl = typeof Intl !== 'undefined' && typeof (Intl as any).DateTimeFormat === 'function';
  if (!hasIntl) return fallback();

  try {
    const locale = localeForLangCode(langCode);
    const parts = new Intl.DateTimeFormat(locale, { month: 'long', day: '2-digit' }).formatToParts(d);
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (month && day) return `${month} ${day}`;
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit' }).format(d);
  } catch {
    return fallback();
  }
}

function ensureBulletSlots(arr: string[], max = 5): string[] {
  const next = Array.isArray(arr) ? arr.slice(0, max) : [];
  while (next.length < max) next.push('');
  return next;
}

const POST_NEWS_TENANT_NAME_KEY = 'post_news_tenant_name';
const POST_NEWS_TENANT_NATIVE_NAME_KEY = 'post_news_tenant_native_name';

export default function PostNewsDetailsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;
  const router = useRouter();

  const { draft, setDraft, setBullets, justPosted } = usePostNewsDraftStore();

  const [newHighlight, setNewHighlight] = useState('');
  const highlightInputRef = useRef<TextInput | null>(null);

  // Posting happens in /post-news/media (image upload step).

  const [tenantId, setTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('Kaburlu');
  const [tenantNativeName, setTenantNativeName] = useState<string>('');
  const tenantNameRef = useRef<string>('Kaburlu');
  const tenantNativeNameRef = useRef<string>('');

  const [tenantCategories, setTenantCategories] = useState<CategoryItem[] | null>(null);
  const [tenantCategoriesBusy, setTenantCategoriesBusy] = useState(false);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [forceCategoryModalVisible, setForceCategoryModalVisible] = useState(false);

  const [dateLineBusy, setDateLineBusy] = useState(false);
  const [dateLineResults, setDateLineResults] = useState<CombinedLocationItem[]>([]);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationQueryDraft, setLocationQueryDraft] = useState<string>('');
  const [locationSearchError, setLocationSearchError] = useState<string>('');
  const [dateLineInlineError, setDateLineInlineError] = useState<string>(''); // Inline error shown on Date Line field
  const [dateLineTenantLangCode, setDateLineTenantLangCode] = useState<string>('');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchRef = useRef<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cachedTn = String((await AsyncStorage.getItem(POST_NEWS_TENANT_NAME_KEY)) || '').trim();
        const cachedTnn = String((await AsyncStorage.getItem(POST_NEWS_TENANT_NATIVE_NAME_KEY)) || '').trim();
        const t = await loadTokens();
        const tenantObj = (t as any)?.session?.tenant || (t as any)?.user?.tenant || (t as any)?.tenant || undefined;
        const tid = String((tenantObj as any)?.id || (tenantObj as any)?._id || (t as any)?.session?.tenantId || '').trim();
        const tn = String((tenantObj as any)?.name || '').trim();
        const tnn = String((tenantObj as any)?.nativeName || '').trim();
        const tLang = String((tenantObj as any)?.languageCode || '').trim();
        if (!alive) return;
        setTenantId(tid);
        const finalTn = tn || cachedTn || 'Kaburlu';
        const finalTnn = tnn || cachedTnn || '';
        setTenantName(finalTn);
        tenantNameRef.current = finalTn;
        setTenantNativeName(finalTnn);
        tenantNativeNameRef.current = finalTnn;

        // Prefer tenant session language until location search returns tenant.languageCode.
        if (tLang) setDateLineTenantLangCode(tLang);

        if (tn) {
          try { await AsyncStorage.setItem(POST_NEWS_TENANT_NAME_KEY, tn); } catch {}
        }
        if (tnn) {
          try { await AsyncStorage.setItem(POST_NEWS_TENANT_NATIVE_NAME_KEY, tnn); } catch {}
        }
      } catch {
        if (!alive) return;
        setTenantId('');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const tid = String(tenantId || '').trim();
      if (!tid) return;
      setTenantCategoriesBusy(true);
      try {
        const langCode = String(draft.languageCode || draft.languageId || 'en');
        const list = await getTenantCategories({ tenantId: tid, langCode });
        if (alive) setTenantCategories(list);
      } catch {
        if (alive) setTenantCategories([]);
      } finally {
        if (alive) setTenantCategoriesBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draft.languageCode, draft.languageId, tenantId]);

  // Category auto-match based on AI response category name.
  useEffect(() => {
    const target = String(draft.categoryName || '').trim();
    const list = tenantCategories;
    if (!target || !list || !list.length) return;
    if (String(draft.categoryId || '').trim()) return;

    let best: { id: string; name: string; slug?: string; score: number } | null = null;
    for (const it of list) {
      const score = diceSimilarity(target, it.name);
      if (!best || score > best.score) best = { id: it.id, name: it.name, slug: it.slug, score };
    }

    if (best && best.score >= 0.7) {
      setDraft({ categoryId: best.id, categoryName: best.name, categorySlug: best.slug });
      setCategoryLocked(true);
    } else {
      setCategoryLocked(false);
    }
  }, [draft.categoryId, draft.categoryName, setDraft, tenantCategories]);

  // Close all modals when justPosted becomes true (user successfully posted)
  useEffect(() => {
    if (justPosted) {
      setForceCategoryModalVisible(false);
      setLocationModalVisible(false);
    }
  }, [justPosted]);

  // If category is not selected, force user to pick a category.
  // Skip if justPosted flag is set (user just posted successfully, navigating away)
  useEffect(() => {
    if (justPosted) return;
    if (tenantCategoriesBusy) return;
    const list = tenantCategories;
    if (!list || !list.length) return;
    const hasCategory = !!String(draft.categoryId || '').trim();
    if (hasCategory) {
      setForceCategoryModalVisible(false);
      return;
    }
    if (categoryLocked) return;
    setForceCategoryModalVisible(true);
  }, [categoryLocked, draft.categoryId, justPosted, tenantCategories, tenantCategoriesBusy]);

  const selectedCategory: LiteCategory | null = useMemo(() => {
    const id = String(draft.categoryId || '').trim();
    if (!id) return null;
    const found = (tenantCategories || []).find((x) => x.id === id);
    return {
      id,
      name: String(found?.name || draft.categoryName || 'Selected').trim(),
      slug: String(found?.slug || draft.categorySlug || '').trim() || undefined,
    };
  }, [draft.categoryId, draft.categoryName, draft.categorySlug, tenantCategories]);

  const pickDateLine = useCallback(async (item: CombinedLocationItem) => {
    try {
      // For date line display language prefer location API tenant.languageCode (if present)
      const preferredLang = getDateLineLanguage(dateLineTenantLangCode || draft.languageCode || draft.languageId || 'en');
      const baseCode = preferredLang;

      const names = item?.match?.names || {};
      const nameEn = String(names?.en || item?.match?.name || '').trim();
      const locationId = String(item?.match?.id || '').trim();
      if (!nameEn || !locationId) return;

      const nameLocalized = String((names as any)?.[baseCode] || item?.match?.name || nameEn).trim();
      const md = formatMonthDayFromLexicon(baseCode, new Date()) || formatMonthDay(baseCode, new Date());

      const typeLabel = getHierarchyLabel(baseCode, item?.type);
      const nameWithType = typeLabel ? `${nameLocalized} ${typeLabel}` : nameLocalized;

      const tnRaw = tenantNameRef.current || tenantName || 'Kaburlu';
      const tnNative = tenantNativeNameRef.current || tenantNativeName || '';
      const tnDisplay = baseCode === 'te' && tnNative.trim() ? tnNative.trim() : tnRaw;

      const text = `${nameWithType} (${tnDisplay}) ${md}`;
      setDraft({
        // Keep search query as a plain place name (no type/tenant/date) so future searches work.
        locationQuery: nameLocalized,
        dateLine: {
          locationId,
          locationType: item.type,
          nameEn,
          nameLocalized,
          text,
        },
      });
      setDateLineResults([]);
      setLocationModalVisible(false);
      setDateLineInlineError(''); // Clear inline error on successful pick
    } catch (e: any) {
      Alert.alert('Date Line', e?.message || 'Could not select date line');
    }
  }, [dateLineTenantLangCode, draft.languageCode, draft.languageId, setDraft, tenantName, tenantNativeName]);

  const langBaseCode = useMemo(() => {
    // Prefer location API tenant.languageCode when available
    const langCode = dateLineTenantLangCode || String(draft.languageCode || draft.languageId || 'en');
    return normalizeLangBaseCode(langCode);
  }, [dateLineTenantLangCode, draft.languageCode, draft.languageId]);

  const getLocationLabel = useCallback((it: CombinedLocationItem): string => {
    const names = it?.match?.names || {};
    const nameEn = String((names as any)?.en || it?.match?.name || '').trim();
    const localized = String((names as any)?.[langBaseCode] || it?.match?.name || nameEn).trim();
    const typeLabel = getHierarchyLabel(langBaseCode, it?.type);
    const out = typeLabel ? `${localized} ${typeLabel}` : localized;
    // Requirement: when language is Telugu, show Telugu only.
    if (langBaseCode === 'te') return out;
    return out;
  }, [langBaseCode]);

  const runSearch = useCallback(async (q: string): Promise<boolean> => {
    const sanitized = sanitizeLocationSearchQuery(String(q || ''), dateLineTenantLangCode || draft.languageCode || draft.languageId || 'en');
    if (sanitized.length < 2) {
      setDateLineResults([]);
      return false;
    }

    try {
      // Must pass tenantId (scoped search). If tenantId isn't ready yet, don't search.
      const tid = String(tenantId || '').trim();
      if (!tid) {
        setDateLineResults([]);
        lastSearchRef.current = '';
        return false;
      }

      if (lastSearchRef.current === sanitized) return false;
      lastSearchRef.current = sanitized;

      setDateLineBusy(true);
      const res = await searchCombinedLocations(sanitized, 20, tid);
      const items = Array.isArray(res?.items) ? res.items : [];
      try {
        const tLang = String((res as any)?.tenant?.languageCode || '').trim();
        if (tLang) setDateLineTenantLangCode(tLang);
        const tName = String((res as any)?.tenant?.name || '').trim();
        const tNative = String((res as any)?.tenant?.nativeName || '').trim();
        if (tName) {
          setTenantName(tName);
          tenantNameRef.current = tName;
          try { await AsyncStorage.setItem(POST_NEWS_TENANT_NAME_KEY, tName); } catch {}
        }
        if (tNative) {
          setTenantNativeName(tNative);
          tenantNativeNameRef.current = tNative;
          try { await AsyncStorage.setItem(POST_NEWS_TENANT_NATIVE_NAME_KEY, tNative); } catch {}
        }
      } catch {}
      // UX: auto-pick if we have a single clear best match.
      // IMPORTANT: when the user is actively searching (modal open), do NOT auto-pick.
      // Auto-pick closes the modal and feels like a "popup glitch" while typing.
      if (!locationModalVisible && items.length > 0) {
        try {
          const sKey = normalizeKey(sanitized);
          const base = langBaseCode;

          let best: { it: CombinedLocationItem; score: number } | null = null;
          for (const it of items) {
            const names = it?.match?.names || {};
            const candidateNames = [
              String((names as any)?.[base] || '').trim(),
              String((names as any)?.en || '').trim(),
              String(it?.match?.name || '').trim(),
            ].filter(Boolean);

            let score = 0;
            for (const nm of candidateNames) {
              const nmKey = normalizeKey(nm);
              if (!nmKey) continue;
              if (nmKey === sKey) {
                score = Math.max(score, 1);
                continue;
              }
              if (nmKey.startsWith(sKey) || sKey.startsWith(nmKey)) {
                score = Math.max(score, 0.92);
                continue;
              }
              score = Math.max(score, diceSimilarity(sanitized, nm));
            }

            if (!best || score > best.score) best = { it, score };
          }

          // Avoid aggressive auto-pick on very short inputs.
          const shouldAutoPick =
            !!best &&
            (best.score >= 0.92 || (sanitized.length >= 3 && best.score >= 0.86));

          if (shouldAutoPick && best) {
            await pickDateLine(best.it);
            return true;
          }
        } catch {
          // fall back to list
        }
      }

      setDateLineResults(items.slice(0, 20));
      return false;
    } catch (e: any) {
      const msg = (() => {
        if (e instanceof HttpError) {
          const b = e.body;
          const bodyMsg = typeof b === 'string' ? b : (b?.message || b?.error);
          return String(bodyMsg || e.message || '').trim();
        }
        return String(e?.message || '').trim();
      })();

      const lower = msg.toLowerCase();
      // UX: show inline error instead of popup alert - don't disturb user flow
      if (lower.includes('area not adding') || lower.includes('not found') || lower.includes('404')) {
        setLocationSearchError('Location not registered. Contact admin to add.');
        setDateLineResults([]);
        lastSearchRef.current = '';
        // Keep modal open so user can try another search
        return false;
      }
      setDateLineResults([]);
      setLocationSearchError('');
      return false;
    } finally {
      setDateLineBusy(false);
    }
  }, [dateLineTenantLangCode, draft.languageCode, draft.languageId, langBaseCode, locationModalVisible, pickDateLine, tenantId]);

  const onChangeLocationQuery = useCallback((t: string) => {
    setLocationQueryDraft(t);
    // Clear error when user types again
    if (locationSearchError) setLocationSearchError('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void runSearch(t);
    }, 350);
  }, [locationSearchError, runSearch]);

  const openLocationModal = useCallback((prefill?: string) => {
    const q = String(prefill || '').trim();
    setLocationModalVisible(true);
    setLocationQueryDraft(q);
    setDateLineResults([]);
    setLocationSearchError('');
    lastSearchRef.current = '';
    if (q.length >= 2) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      void runSearch(q);
    }
  }, [runSearch]);

  // Auto-fill date line without showing the modal (AI/manual locationQuery).
  // Skip if justPosted flag is set (navigating away after successful post)
  useEffect(() => {
    if (justPosted) return;
    if (draft.dateLine?.locationId) return;
    const q = String(draft.locationQuery || '').trim();
    if (q.length < 2) return;
    if (!String(tenantId || '').trim()) return;
    void runSearch(q);
  }, [draft.dateLine?.locationId, draft.locationQuery, justPosted, runSearch, tenantId]);

  const highlightList = useMemo(() => {
    return (Array.isArray(draft.bullets) ? draft.bullets : [])
      .map((b) => String(b || '').trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [draft.bullets]);

  const setHighlightList = useCallback((list: string[]) => {
    const next = ensureBulletSlots(list.slice(0, 5));
    setBullets(next);
  }, [setBullets]);

  const addHighlight = useCallback((raw: string) => {
    const t = String(raw || '').trim();
    if (!t) return;
    if (highlightList.length >= 5) return;
    setHighlightList([...highlightList, t]);
    setNewHighlight('');
  }, [highlightList, setHighlightList]);

  const removeHighlightAt = useCallback((idx: number) => {
    const next = highlightList.filter((_, i) => i !== idx);
    setHighlightList(next);
  }, [highlightList, setHighlightList]);

  const editHighlightAt = useCallback((idx: number) => {
    const text = String(highlightList[idx] || '').trim();
    if (!text) return;
    removeHighlightAt(idx);
    setNewHighlight(text);
    setTimeout(() => highlightInputRef.current?.focus(), 60);
  }, [highlightList, removeHighlightAt]);

  const onProceed = useCallback(async () => {
    const titleOk = String(draft.title || '').trim().length >= 3;
    const bodyOk = String(draft.body || '').trim().length >= 1;
    if (!titleOk || !bodyOk) {
      Alert.alert('Missing details', 'Please fill title and body.');
      return;
    }

    const categoryOk = !!String(draft.categoryId || '').trim();
    if (!categoryOk) {
      setForceCategoryModalVisible(true);
      return;
    }

    const dateLineOk = !!draft.dateLine?.locationId;
    if (!dateLineOk) {
      const q = String(draft.locationQuery || '').trim();
      if (q.length >= 2) {
        lastSearchRef.current = '';
        const autoPicked = await runSearch(q);
        if (autoPicked) return;
        // Location search failed - show inline error instead of popup modal
        setDateLineInlineError('Location not found. Tap to search manually.');
        return;
      }
      // No location query at all - show inline error prompting user
      setDateLineInlineError('Please select a location.');
      return;
    }

    router.push('/post-news/media' as any);
  }, [draft.body, draft.categoryId, draft.dateLine?.locationId, draft.locationQuery, draft.title, router, runSearch]);

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
        </View>

        <View style={styles.appBarRightSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Category</ThemedText>
            {tenantCategoriesBusy ? (
              <View style={{ marginTop: 10 }}>
                <ActivityIndicator />
              </View>
            ) : categoryLocked ? (
              <View style={[styles.input, { borderColor: c.border, backgroundColor: c.background, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <MaterialIcons name="lock" size={18} color={c.muted} />
                <ThemedText style={{ color: c.text }} numberOfLines={1}>
                  {selectedCategory?.name || String(draft.categoryName || '').trim() || 'Auto selected'}
                </ThemedText>
              </View>
            ) : (
              <CategoryPicker
                categories={tenantCategories}
                value={selectedCategory}
                onChange={(item) => {
                  setDraft({ categoryId: item.id, categoryName: item.name, categorySlug: item.slug });
                }}
                placeholder="Select category"
              />
            )}
            {categoryLocked ? (
              <ThemedText style={{ color: c.muted, marginTop: 6 }}>Auto-filled from AI category match.</ThemedText>
            ) : null}
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Title</ThemedText>
            <TextInput
              value={draft.title || ''}
              onChangeText={(t) => setDraft({ title: t })}
              placeholder="Title"
              placeholderTextColor={c.muted}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
              maxLength={300}
            />
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Subtitle</ThemedText>
            <TextInput
              value={draft.subtitle || ''}
              onChangeText={(t) => setDraft({ subtitle: t })}
              placeholder="Subtitle (optional)"
              placeholderTextColor={c.muted}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
              maxLength={300}
            />
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Highlights</ThemedText>

            {highlightList.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {highlightList.map((text, idx) => (
                  <Pressable
                    key={`${idx}-${text}`}
                    onPress={() => editHighlightAt(idx)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: c.background,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 999,
                      maxWidth: '100%',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit highlight ${idx + 1}`}
                  >
                    <ThemedText style={{ color: c.text }} numberOfLines={1}>
                      {text}
                    </ThemedText>
                    <Pressable
                      onPress={() => removeHighlightAt(idx)}
                      hitSlop={8}
                      style={({ pressed }) => [pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove highlight ${idx + 1}`}
                    >
                      <MaterialIcons name="close" size={18} color={c.muted} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ) : (
              <ThemedText style={{ color: c.muted, marginTop: 8 }}>Add up to 5 highlights.</ThemedText>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TextInput
                ref={(r) => { highlightInputRef.current = r; }}
                value={newHighlight}
                onChangeText={setNewHighlight}
                placeholder={highlightList.length ? 'Add another highlight…' : 'Add highlight…'}
                placeholderTextColor={c.muted}
                style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={() => addHighlight(newHighlight)}
                blurOnSubmit={false}
              />
              <Pressable
                onPress={() => addHighlight(newHighlight)}
                disabled={!newHighlight.trim() || highlightList.length >= 5}
                style={({ pressed }) => [
                  styles.smallBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: (!newHighlight.trim() || highlightList.length >= 5) ? c.border : c.card,
                  },
                  pressed && newHighlight.trim() && highlightList.length < 5 && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add highlight"
              >
                <ThemedText style={{ color: c.text }} type="defaultSemiBold">Add</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Date Line</ThemedText>
              {dateLineBusy ? <ActivityIndicator size="small" /> : null}
            </View>

            <Pressable
              onPress={() => {
                setDateLineInlineError(''); // Clear inline error when opening modal
                openLocationModal(String(draft.locationQuery || '').trim());
              }}
              style={({ pressed }) => [
                styles.input,
                {
                  borderColor: dateLineInlineError ? '#e53935' : c.border,
                  backgroundColor: c.background,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="place" size={18} color={dateLineInlineError ? '#e53935' : primary} />
              <ThemedText style={{ color: draft.dateLine?.text ? c.text : c.muted, flex: 1 }} numberOfLines={1}>
                {draft.dateLine?.text || 'Search and select location'}
              </ThemedText>
              <MaterialIcons name="chevron-right" size={22} color={c.muted} />
            </Pressable>
            {dateLineInlineError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <MaterialIcons name="error-outline" size={16} color="#e53935" />
                <ThemedText style={{ color: '#e53935', fontSize: 13 }}>{dateLineInlineError}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Body</ThemedText>
            <TextInput
              value={draft.body || ''}
              onChangeText={(t) => setDraft({ body: t })}
              placeholder="Article body"
              placeholderTextColor={c.muted}
              style={[styles.textAreaBig, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Pressable
            onPress={() => router.back()}
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
            onPress={onProceed}
            style={({ pressed }) => [
              styles.bottomBtn,
              { borderColor: primary, backgroundColor: c.card },
              pressed && styles.pressed,
            ]}
            disabled={false}
          >
            <ThemedText style={{ color: primary }}>Next: Media</ThemedText>
            <MaterialIcons name="arrow-forward" size={18} color={primary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={forceCategoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Select category</ThemedText>
              <View />
            </View>
            <ScrollView style={{ marginTop: 10, maxHeight: 520 }} keyboardShouldPersistTaps="handled">
              {(tenantCategories || []).map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setDraft({ categoryId: cat.id, categoryName: cat.name, categorySlug: cat.slug });
                    setForceCategoryModalVisible(false);
                    if (!draft.dateLine?.locationId) {
                      const q = String(draft.locationQuery || '').trim();
                      void (async () => {
                        if (q.length >= 2) {
                          lastSearchRef.current = '';
                          const ok = await runSearch(q);
                          if (ok) return;
                        }
                        openLocationModal(q);
                      })();
                    }
                  }}
                  style={({ pressed }) => [
                    styles.pickRow,
                    { borderColor: c.border, backgroundColor: c.background },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="category" size={18} color={primary} />
                  <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>{cat.name}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={locationModalVisible} transparent animationType="fade" onRequestClose={() => setLocationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Search location</ThemedText>
              <Pressable onPress={() => setLocationModalVisible(false)} hitSlop={10}>
                <MaterialIcons name="close" size={20} color={c.text} />
              </Pressable>
            </View>

            <TextInput
              value={locationQueryDraft}
              onChangeText={onChangeLocationQuery}
              placeholder={String(tenantId || '').trim() ? 'Type location to search' : 'Loading tenant…'}
              placeholderTextColor={c.muted}
              style={[
                styles.input,
                {
                  borderColor: locationSearchError ? '#E53935' : c.border,
                  borderWidth: locationSearchError ? 1.5 : 1,
                  color: c.text,
                  backgroundColor: c.background,
                  marginTop: 10,
                },
              ]}
              editable={!!String(tenantId || '').trim()}
            />

            {locationSearchError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 }}>
                <MaterialIcons name="error-outline" size={16} color="#E53935" />
                <ThemedText style={{ color: '#E53935', fontSize: 13, flex: 1 }}>{locationSearchError}</ThemedText>
              </View>
            ) : null}

            <ScrollView style={{ marginTop: 10, maxHeight: locationSearchError ? 360 : 420 }} keyboardShouldPersistTaps="handled">
              {(dateLineResults || []).map((it, idx) => {
                const label = getLocationLabel(it);
                if (!label) return null;
                const typeLabel = getHierarchyLabel(langBaseCode, it?.type) || String(it.type || '').toLowerCase();
                return (
                  <Pressable
                    key={`${it.type}_${it.match.id}_${idx}`}
                    onPress={() => void pickDateLine(it)}
                    style={({ pressed }) => [
                      styles.pickRow,
                      { borderColor: c.border, backgroundColor: c.background },
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons name="place" size={18} color={primary} />
                    <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>{label}</ThemedText>
                    <ThemedText style={{ color: c.muted, marginLeft: 8 }}>{typeLabel}</ThemedText>
                  </Pressable>
                );
              })}
              {dateLineBusy ? (
                <View style={{ paddingVertical: 10 }}>
                  <ActivityIndicator />
                </View>
              ) : null}
              {!dateLineBusy && locationQueryDraft.trim().length >= 2 && (!dateLineResults || !dateLineResults.length) ? (
                <ThemedText style={{ color: c.muted, marginTop: 10 }}>No results.</ThemedText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Legacy location picker modal removed; forced location modal is used above. */}
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appBarCenter: { flex: 1, alignItems: 'center' },
  appBarRightSpacer: { width: 40 },
  title: { fontSize: 16 },
  step: { fontSize: 12, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  scroll: { padding: 14 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    marginTop: 10,
    fontSize: 14,
  },
  textAreaBig: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    minHeight: 180,
    fontSize: 14,
  },
  bottomPad: { height: 84 },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
  },
  bottomBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    maxHeight: '70%',
  },
  pickRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
});
