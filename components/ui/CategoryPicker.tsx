import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryItem } from '@/services/api';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

function withAlpha(hexColor: string, alpha: number): string {
  const hex = String(hexColor || '').replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

export type LiteCategory = { id: string; name: string; slug?: string; iconUrl?: string | null };

type Props = {
  categories: CategoryItem[] | null | undefined;
  value: LiteCategory | null;
  onChange: (item: LiteCategory) => void;
  label?: string;
  placeholder?: string;
  recentKey?: string; // AsyncStorage key for recents
};

const DEFAULT_RECENT_KEY = 'recentCategories';

export default function CategoryPicker({ categories, value, onChange, label = 'Category', placeholder = 'Select Category', recentKey = DEFAULT_RECENT_KEY }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const chipBg = withAlpha(c.tint, 0.12);
  const iconBg = withAlpha(c.tint, 0.12);
  const ripple = withAlpha(c.tint, 0.12);
  const scrim = withAlpha(c.primary, 0.55);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<LiteCategory[]>([]);
  const [currentParent, setCurrentParent] = useState<LiteCategory | null>(null);
  const [cachedList, setCachedList] = useState<CategoryItem[] | null>(null);
  const list = useMemo(() => (categories != null ? categories : (cachedList || [])), [categories, cachedList]);

  // Persist categories locally to improve first render performance and second-open speed
  useEffect(() => {
    (async () => {
      try {
        // Prefer language-specific cache from services/api (categories_cache:<languageId>)
        let langId: string | undefined;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) langId = (JSON.parse(langRaw)?.id as string | undefined) || undefined;
        } catch {}
        const svcKey = langId ? `categories_cache:${langId}` : null;
        const genericKey = 'cached_categories_generic';
        if (categories != null && categories.length) {
          // Update both caches
          if (svcKey) await AsyncStorage.setItem(svcKey, JSON.stringify(categories));
          await AsyncStorage.setItem(genericKey, JSON.stringify(categories));
          setCachedList(categories);
        } else if (!cachedList) {
          // Hydrate from service cache first, else generic
          let raw: string | null = null;
          if (svcKey) {
            // Language-specific cache takes precedence; if present, use it.
            raw = await AsyncStorage.getItem(svcKey);
          }
          if (!raw) {
            // Only use a generic categories cache when there is no selected language available.
            // This avoids cross-language leakage (e.g., showing English while Telugu is selected).
            if (!langId) {
              raw = await AsyncStorage.getItem(genericKey);
            }
          }
          if (raw) {
            const arr = JSON.parse(raw) as CategoryItem[];
            if (Array.isArray(arr)) setCachedList(arr);
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(recentKey);
        const arr = raw ? JSON.parse(raw) as LiteCategory[] : [];
        if (Array.isArray(arr)) setRecents(arr.filter(x => x && x.id && x.name).slice(0, 8));
      } catch {}
    })();
  }, [recentKey]);

  const title = value?.name || placeholder;

  // Derived list per view
  const currentList: CategoryItem[] = useMemo(() => {
    if (!currentParent) return list;
    const parent = list.find(c => c.id === currentParent.id);
    if (!parent) return list;
    const children = Array.isArray(parent.children) ? parent.children : [];
    // Render a synthetic first row to select parent itself
    return [{ ...parent, children: [] }, ...children];
  }, [currentParent, list]);

  const filteredList: (CategoryItem & { _isParentOption?: boolean })[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currentList as any;
    // filter by name (starts-with prioritized) within current view
    const starts: any[] = [];
    const contains: any[] = [];
    for (const c of currentList) {
      const name = String(c?.name || '').toLowerCase();
      if (!name) continue;
      if (name.startsWith(q)) starts.push(c);
      else if (name.includes(q)) contains.push(c);
      if (Array.isArray(c.children) && c.children.length) {
        for (const ch of c.children) {
          const cn = String(ch?.name || '').toLowerCase();
          if (!cn) continue;
          if (cn.startsWith(q)) starts.push(ch);
          else if (cn.includes(q)) contains.push(ch);
        }
      }
    }
    return [...starts, ...contains] as any;
  }, [query, currentList]);

  const onPick = (item?: LiteCategory | null) => {
    if (!item || !item.id) return;
    // Update UI immediately
    onChange({ id: item.id, name: item.name, slug: item.slug, iconUrl: item.iconUrl });
    setVisible(false);
    setQuery('');
    setCurrentParent(null);

    // Persist recents in background (don't block closing)
    try {
      const next = [item, ...recents.filter(r => r.id !== item.id)].slice(0, 8);
      setRecents(next);
      AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => {});
    } catch {}
  };

  const renderRow = (cat: CategoryItem, i: number) => {
    const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
    return (
      <Pressable
        key={`${cat.id}:${i}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        android_ripple={{ color: ripple }}
        onPress={() => {
          try { Keyboard.dismiss(); } catch {}
          // If in children view and this is the synthetic parent option
          if (currentParent && cat.id === currentParent.id) {
            onPick(currentParent);
            return;
          }
          // Default: single-tap selects the category (even if it has children)
          onPick(cat as any);
        }}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          {cat.iconUrl ? (
            <Image source={{ uri: cat.iconUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="shape" size={22} color={c.tint} />
          )}
        </View>
        <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
          {currentParent && cat.id === currentParent.id ? `Use "${cat.name}"` : cat.name}
        </Text>
        {hasChildren && !currentParent ? (
          <Pressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              try { (e as any)?.stopPropagation?.(); } catch {}
              try { Keyboard.dismiss(); } catch {}
              setCurrentParent({ id: cat.id, name: cat.name, slug: cat.slug, iconUrl: cat.iconUrl });
            }}
            style={{ paddingHorizontal: 2, paddingVertical: 2 }}
          >
            <Feather name="chevron-right" size={18} color={c.muted} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View>
      {label ? <Text style={[styles.label, { color: c.text }]}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select category"
        onPress={() => {
          try { Keyboard.dismiss(); } catch {}
          // reset state before showing to prevent layout jump flicker
          setQuery('');
          setCurrentParent(null);
          setVisible(true);
        }}
        style={[styles.card, { borderColor: c.border, backgroundColor: c.background }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="tag" size={16} color={c.tint} />
          <Text style={[styles.cardText, { color: c.text }]} numberOfLines={1}>{title}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={c.muted} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => { setVisible(false); setQuery(''); setCurrentParent(null); }}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: scrim }]} onPress={() => { setVisible(false); setQuery(''); setCurrentParent(null); }} />

        <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.modalTopRow}>
            {currentParent ? (
              <Pressable onPress={() => setCurrentParent(null)} style={styles.backBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Feather name="chevron-left" size={20} color={c.tint} />
                <Text style={[styles.backText, { color: c.text }]}>Back</Text>
              </Pressable>
            ) : (
              <Text style={[styles.sheetTitle, { color: c.text }]}>Choose category</Text>
            )}

            <Pressable
              onPress={() => { setVisible(false); setQuery(''); setCurrentParent(null); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color={c.muted} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { borderColor: c.border, backgroundColor: c.background }]}>
            <Feather name="search" size={16} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories"
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
            />
          </View>

          {list.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.muted} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              {!currentParent && recents.length > 0 && !query ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.sectionTitle, { color: c.muted }]}>Recent</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                    {recents.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => onPick(r)}
                        style={({ pressed }) => [styles.chip, { backgroundColor: chipBg }, pressed && styles.pressed]}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={[styles.chipText, { color: c.tint }]}>{r.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {filteredList.length === 0 ? (
                <Text style={[styles.empty, { color: c.muted }]}>No categories</Text>
              ) : (
                <View>
                  {filteredList.map((c, i) => renderRow(c as any, i))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  headerRow: { flexDirection: 'column', gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  searchBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  searchInput: { flex: 1, padding: 0, margin: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  chip: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, fontSize: 14, fontWeight: '700' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  empty: { paddingVertical: 16, textAlign: 'center' },
  loading: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontWeight: '800' },

  modalOverlay: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 80,
    bottom: 24,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
});
