import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getTenantReporters, type TenantReporter } from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGE_SIZE = 20;
const SEARCH_HINTS = ['name', 'mobile number'] as const;

function isValidHexColor(v?: string | null) {
  if (!v) return false;
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(String(v).trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim();
  if (!isValidHexColor(h)) return null;
  const raw = h.slice(1);
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function pickReadableTextColor(bgHex?: string | null) {
  const rgb = bgHex ? hexToRgb(bgHex) : null;
  if (!rgb) return null;
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return lum < 0.55 ? Colors.light.background : Colors.light.text;
}

function initials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return letters || 'R';
}

function locationNameForReporter(r: TenantReporter): string {
  const lvl = String(r.level || '').toUpperCase();
  if (lvl === 'STATE') return r.state?.name || '—';
  if (lvl === 'DISTRICT') return r.district?.name || r.state?.name || '—';
  if (lvl === 'MANDAL') return r.mandal?.name || r.district?.name || r.state?.name || '—';
  if (lvl === 'ASSEMBLY') return r.assemblyConstituency?.name || r.district?.name || r.state?.name || '—';
  return r.district?.name || r.state?.name || '—';
}

function normalizeLevel(level: TenantReporter['level']) {
  const l = String(level || '').toUpperCase();
  if (l === 'STATE' || l === 'DISTRICT' || l === 'MANDAL' || l === 'ASSEMBLY') return l;
  return 'OTHER';
}

function levelLabel(level: string) {
  switch (level) {
    case 'STATE':
      return 'State';
    case 'DISTRICT':
      return 'District';
    case 'MANDAL':
      return 'Mandal';
    case 'ASSEMBLY':
      return 'Assembly';
    default:
      return 'Other';
  }
}


export default function TenantReportersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reporters, setReporters] = useState<TenantReporter[]>([]);

  const [search, setSearch] = useState('');
  const searchRef = useRef<TextInput>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintY = useRef(new Animated.Value(0)).current;

  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);

      setRole(String(t?.user?.role || ''));

      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const primary = colors?.primary || colors?.accent;
      setBrandPrimary(isValidHexColor(primary) ? String(primary) : null);
    })();
  }, []);

  const canCreate = useMemo(() => {
    const r = String(role || '').toUpperCase();
    return !!tenantId && (r === 'SUPER_ADMIN' || r === 'TENANT_ADMIN' || r === 'REPORTER' || r === 'TENANT_REPORTER');
  }, [role, tenantId]);

  const openReporter = useCallback(
    (id: string) => {
      (router.push as any)({ pathname: '/tenant/reporter/[id]', params: { id } });
    },
    [router],
  );

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getTenantReporters(tenantId, {
        active: true,
      });
      setReporters(Array.isArray(list) ? list : []);
      setVisibleCount(PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reporters');
      setReporters([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    load();
  }, [tenantId, load]);

  useEffect(() => {
    // Animated "Search by ..." hint that cycles while the input is empty.
    if (searchFocused) return;
    if (search.trim().length) return;
    let cancelled = false;
    const tick = () => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(hintOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hintY, { toValue: -10, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.delay(60),
      ]).start(() => {
        if (cancelled) return;
        hintY.setValue(10);
        setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
        Animated.parallel([
          Animated.timing(hintOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(hintY, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      });
    };

    const id = setInterval(tick, 2200);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [searchFocused, search, hintOpacity, hintY]);

  const baseFiltered = useMemo(() => {
    let list = reporters;
    if (levelFilter) {
      list = list.filter((r) => normalizeLevel(r.level) === levelFilter);
    }
    return list;
  }, [reporters, levelFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseFiltered;
    return baseFiltered.filter((r) => {
      const name = String(r.fullName || '').toLowerCase();
      const mobile = String(r.mobileNumber || '').toLowerCase();
      return name.includes(q) || mobile.includes(q);
    });
  }, [baseFiltered, search]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { STATE: 0, DISTRICT: 0, MANDAL: 0, ASSEMBLY: 0, OTHER: 0 };
    for (const r of reporters) {
      const k = normalizeLevel(r.level);
      counts[k] = (counts[k] || 0) + 1;
    }
    return (Object.keys(counts) as (keyof typeof counts)[]).map((k) => ({ key: k, label: levelLabel(k), value: counts[k] }));
  }, [reporters]);

  const accent = brandPrimary || c.tint;
  const accentText = pickReadableTextColor(accent) || Colors.light.background;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <View style={[styles.searchRow, styles.appBarSearch, { borderColor: c.border, backgroundColor: c.card }]}>
          <MaterialIcons name="search" size={18} color={c.muted} />

          <View style={styles.searchInputWrap}>
            {!searchFocused && !search.trim() ? (
              <Animated.View style={[styles.searchHintWrap, { opacity: hintOpacity, transform: [{ translateY: hintY }] }]} pointerEvents="none">
                <ThemedText style={[styles.searchHint, { color: c.muted }]}>Search by {SEARCH_HINTS[hintIndex]}</ThemedText>
              </Animated.View>
            ) : null}

            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={searchFocused ? 'Search by name, mobile number' : ''}
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
              returnKeyType="search"
            />
          </View>

          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={10} style={styles.clearBtn}>
              <MaterialIcons name="close" size={18} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Level-wise counts */}
      {!loading && !error ? (
        <View style={styles.levelStripWrap}>
          <FlatList
            data={levelCounts}
            keyExtractor={(it) => it.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.levelStrip}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setLevelFilter((prev) => (prev === item.key ? null : item.key))}
                style={({ pressed }) => [
                  styles.levelCard,
                  {
                    borderColor: levelFilter === item.key ? accent : c.border,
                    backgroundColor: levelFilter === item.key ? 'rgba(0,0,0,0.03)' : c.card,
                  },
                  pressed && { opacity: 0.95 },
                ]}
              >
                <View style={styles.levelCardTopRow}>
                  <ThemedText style={[styles.levelCardValue, { color: c.text }]} type="defaultSemiBold">
                    {item.value}
                  </ThemedText>
                  {levelFilter === item.key ? <MaterialIcons name="check" size={18} color={accent} /> : null}
                </View>
                <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ReporterCardSkeleton key={`rep-skel-${i}`} scheme={scheme} accent={accent} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText type="defaultSemiBold" style={[styles.centerTitle, { color: c.text }]}>
            Couldn’t load reporters
          </ThemedText>
          <ThemedText style={[styles.centerText, { color: c.muted }]}>{error}</ThemedText>
          <Pressable
            onPress={load}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: accent }, pressed && { opacity: 0.9 }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: accentText }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ReporterCard
              item={item}
              scheme={scheme}
              accent={accent}
              onOpen={() => openReporter(item.id)}
            />
          )}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (visibleCount >= filtered.length) return;
            setVisibleCount((n) => Math.min(filtered.length, n + PAGE_SIZE));
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText style={[styles.centerText, { color: c.muted }]}>No reporters found</ThemedText>
            </View>
          }
        />
      )}

      {canCreate ? (
        <Pressable
          onPress={() => router.push('/tenant/create-reporter')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: accent },
            pressed && { opacity: 0.92 },
          ]}
          hitSlop={12}
        >
          <MaterialIcons name="add" size={26} color={accentText} />
        </Pressable>
      ) : null}

    </SafeAreaView>
  );
}

function ReporterCard({
  item,
  scheme,
  accent,
  onOpen,
}: {
  item: TenantReporter;
  scheme: 'light' | 'dark';
  accent: string;
  onOpen: () => void;
}) {
  const c = Colors[scheme];
  const name = item.fullName || 'Unknown';
  const mobile = item.mobileNumber || '—';
  const designation = item.designation?.name || '—';
  const location = locationNameForReporter(item);
  const kyc = item.kycStatus || '—';
  const subActive = !!item.subscriptionActive;
  const autoPublish = item.autoPublish === true;

  const chipText = pickReadableTextColor(accent) || Colors.light.background;
  const warn = Colors[scheme].warning;
  const warnText = pickReadableTextColor(warn) || Colors.light.background;

  function alphaBg(hex: string, alpha: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return c.background;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  const kycKey = String(kyc).toUpperCase();
  const kycOk = ['APPROVED', 'VERIFIED', 'COMPLETED', 'SUCCESS'].some((t) => kycKey.includes(t));
  const kycPending = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEW'].some((t) => kycKey.includes(t));


  const level = normalizeLevel(item.level);
  const levelTx = levelLabel(level);

  const kycBg = kycOk ? accent : kycPending ? warn : c.background;
  const kycBorder = kycOk || kycPending ? kycBg : c.border;
  const kycTx = kycOk ? chipText : kycPending ? warnText : c.text;
  const kycIcon = kycOk ? 'verified' : kycPending ? 'pending-actions' : 'help-outline';

  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: c.border }}
      style={({ pressed }) => [
        styles.card,
        { borderColor: c.border, backgroundColor: c.card },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.cardAccentBar, { backgroundColor: alphaBg(accent, 0.9) }]} />

      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <ThemedText type="defaultSemiBold" style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {name}
            </ThemedText>

            <View style={[styles.levelPill, { borderColor: c.border, backgroundColor: c.background }]}>
              <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                {levelTx}
              </ThemedText>
            </View>
          </View>

          <View style={styles.metaLine}>
            <MaterialIcons name="call" size={16} color={c.muted} />
            <ThemedText style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {mobile}
            </ThemedText>
          </View>

          <View style={styles.metaLine}>
            <MaterialIcons name="badge" size={16} color={c.muted} />
            <ThemedText style={[styles.metaText, { color: c.text }]} numberOfLines={1}>
              {designation}
            </ThemedText>
          </View>

          <View style={styles.metaLine}>
            <MaterialIcons name="place" size={16} color={c.muted} />
            <ThemedText style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {location}
            </ThemedText>
          </View>
        </View>

        <View style={styles.rightCol}>
          <View style={[styles.avatar, { borderColor: c.border, backgroundColor: alphaBg(accent, 0.10) }]}>
            {item.profilePhotoUrl ? (
              <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <ThemedText type="defaultSemiBold" style={{ color: accent }}>
                {initials(name)}
              </ThemedText>
            )}
          </View>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: kycBg, borderColor: kycBorder }]}
        >
          <MaterialIcons name={kycIcon as any} size={16} color={kycTx} />
          <ThemedText style={{ color: kycTx, fontSize: 12 }} numberOfLines={1}>
            KYC {kyc}
          </ThemedText>
        </View>

        <View style={[styles.chip, { backgroundColor: c.background, borderColor: c.border }]}
        >
          <MaterialIcons name={autoPublish ? 'publish' : 'pause-circle'} size={16} color={autoPublish ? accent : c.muted} />
          <ThemedText style={{ color: autoPublish ? c.text : c.muted, fontSize: 12 }} numberOfLines={1}>
            Auto publish {autoPublish ? 'Yes' : 'No'}
          </ThemedText>
        </View>

        <View style={[styles.chip, { backgroundColor: c.background, borderColor: c.border }]}
        >
          <MaterialIcons name={subActive ? 'check-circle' : 'cancel'} size={16} color={subActive ? accent : c.muted} />
          <ThemedText style={{ color: subActive ? c.text : c.muted, fontSize: 12 }} numberOfLines={1}>
            Subscription {subActive ? 'Active' : 'Inactive'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

function ReporterCardSkeleton({
  scheme,
  accent,
}: {
  scheme: 'light' | 'dark';
  accent: string;
}) {
  const c = Colors[scheme];

  function alphaBg(hex: string, alpha: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return c.background;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={[styles.cardAccentBar, { backgroundColor: alphaBg(accent, 0.9) }]} />

      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Skeleton width={'70%'} height={16} borderRadius={8} />
            </View>
            <Skeleton width={62} height={20} borderRadius={999} />
          </View>

          <View style={[styles.metaLine, { marginTop: 10 }]}>
            <Skeleton width={'55%'} height={12} borderRadius={6} />
          </View>
          <View style={[styles.metaLine, { marginTop: 8 }]}>
            <Skeleton width={'65%'} height={12} borderRadius={6} />
          </View>
          <View style={[styles.metaLine, { marginTop: 8 }]}>
            <Skeleton width={'50%'} height={12} borderRadius={6} />
          </View>
        </View>

        <View style={styles.rightCol}>
          <Skeleton width={38} height={38} borderRadius={12} />
          <Skeleton width={52} height={52} borderRadius={26} />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Skeleton width={110} height={30} borderRadius={999} />
        <Skeleton width={120} height={30} borderRadius={999} />
        <Skeleton width={130} height={30} borderRadius={999} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
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
  titleCol: { flex: 1 },
  title: { fontSize: 16 },
  subtitle: { fontSize: 12, marginTop: 2 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    gap: 8,
  },
  appBarSearch: {
    flex: 1,
    margin: 0,
  },
  searchInputWrap: { flex: 1, height: '100%', justifyContent: 'center' },
  searchHintWrap: { position: 'absolute', left: 0, right: 0 },
  searchHint: { fontSize: 14 },
  searchInput: { fontSize: 14, padding: 0, margin: 0 },
  clearBtn: { padding: 4 },

  levelStripWrap: { marginTop: 2 },
  levelStrip: { paddingHorizontal: 12, paddingBottom: 6, gap: 10 },
  levelCard: { width: 96, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  levelCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelCardValue: { fontSize: 18 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  centerTitle: { textAlign: 'center' },
  centerText: { textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },

  listContent: { paddingHorizontal: 12, paddingBottom: 16 },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.997 }] },
  cardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 6 },
  rightCol: { flexShrink: 0, alignItems: 'flex-end', gap: 10, paddingLeft: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  name: { fontSize: 16, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  levelPill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexShrink: 0 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 13, flexShrink: 1 },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', paddingLeft: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },

  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailSection: { borderTopWidth: 1, paddingTop: 10, gap: 3 },

});
