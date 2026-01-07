import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getTenantReporters, type TenantReporter } from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGE_SIZE = 20;
const SEARCH_HINTS = ['name', 'mobile', 'location'] as const;

/* ─────────────────────────────  Helpers  ───────────────────────────── */

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

function alphaBg(hex: string, alpha: number, fallback: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
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

const LEVEL_META: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  STATE: { label: 'State', icon: 'public', color: '#6366f1' },
  DISTRICT: { label: 'District', icon: 'location-city', color: '#f59e0b' },
  MANDAL: { label: 'Mandal', icon: 'apartment', color: '#10b981' },
  ASSEMBLY: { label: 'Assembly', icon: 'how-to-vote', color: '#ec4899' },
  OTHER: { label: 'Other', icon: 'person-pin', color: '#8b5cf6' },
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function TenantReportersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const primary = brandPrimary || c.tint;
  const primaryText = pickReadableTextColor(primary) || Colors.light.background;

  /* ── Load data ── */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);
      setRole(String(t?.user?.role || ''));

      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      setBrandPrimary(isValidHexColor(pColor) ? String(pColor) : null);

      if (tid) {
        const list = await getTenantReporters(tid, { active: true });
        setReporters(Array.isArray(list) ? list : []);
        setVisibleCount(PAGE_SIZE);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load reporters');
      setReporters([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /* ── Search hint animation ── */
  const animateHint = useCallback(() => {
    if (searchFocused || search.trim().length) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(hintOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hintY, { toValue: -8, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(40),
    ]).start(() => {
      hintY.setValue(8);
      setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
      Animated.parallel([
        Animated.timing(hintOpacity, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(hintY, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, [searchFocused, search, hintOpacity, hintY]);

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(animateHint, 2000);
      return () => clearInterval(id);
    }, [animateHint]),
  );

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

  /* ── Filtering ── */
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { STATE: 0, DISTRICT: 0, MANDAL: 0, ASSEMBLY: 0, OTHER: 0 };
    for (const r of reporters) {
      const k = normalizeLevel(r.level);
      counts[k] = (counts[k] || 0) + 1;
    }
    return (Object.keys(counts) as (keyof typeof counts)[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({ key: k, ...LEVEL_META[k], count: counts[k] }));
  }, [reporters]);

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
      const loc = locationNameForReporter(r).toLowerCase();
      return name.includes(q) || mobile.includes(q) || loc.includes(q);
    });
  }, [baseFiltered, search]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      {/* Gradient Hero */}
      <LinearGradient
        colors={[primary, alphaBg(primary, 0.85, primary)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={22} color={primaryText} />
        </Pressable>

        <View style={styles.heroContent}>
          <ThemedText type="title" style={[styles.heroTitle, { color: primaryText }]}>
            Reporters
          </ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: alphaBg(primaryText, 0.8, primaryText) }]}>
            {reporters.length} total • Manage your team
          </ThemedText>
        </View>

        {/* Stats Pills */}
        <View style={styles.statsPillRow}>
          {levelCounts.slice(0, 4).map((item) => (
            <View key={item.key} style={[styles.statsPill, { backgroundColor: alphaBg('#fff', 0.2, '#fff') }]}>
              <MaterialIcons name={item.icon} size={14} color={primaryText} />
              <ThemedText style={[styles.statsPillText, { color: primaryText }]}>
                {item.count} {item.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Search Bar - overlapping hero */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <MaterialIcons name="search" size={20} color={c.muted} />
          <View style={styles.searchInputWrap}>
            {!searchFocused && !search.trim() ? (
              <Animated.View
                style={[styles.searchHintWrap, { opacity: hintOpacity, transform: [{ translateY: hintY }] }]}
                pointerEvents="none"
              >
                <ThemedText style={[styles.searchHint, { color: c.muted }]}>
                  Search by {SEARCH_HINTS[hintIndex]}...
                </ThemedText>
              </Animated.View>
            ) : null}
            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={searchFocused ? 'Search name, mobile, location...' : ''}
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
              returnKeyType="search"
            />
          </View>
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <MaterialIcons name="close" size={18} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Level Filter Chips */}
      {levelCounts.length > 0 && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setLevelFilter(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: !levelFilter ? primary : c.card,
                borderColor: !levelFilter ? primary : c.border,
              },
            ]}
          >
            <ThemedText style={{ color: !levelFilter ? primaryText : c.text, fontSize: 13, fontWeight: '600' }}>
              All
            </ThemedText>
          </Pressable>
          {levelCounts.map((item) => {
            const isActive = levelFilter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setLevelFilter(isActive ? null : item.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? item.color : c.card,
                    borderColor: isActive ? item.color : c.border,
                  },
                ]}
              >
                <MaterialIcons name={item.icon} size={14} color={isActive ? '#fff' : item.color} />
                <ThemedText style={{ color: isActive ? '#fff' : c.text, fontSize: 13, fontWeight: '500' }}>
                  {item.label}
                </ThemedText>
                <View style={[styles.filterBadge, { backgroundColor: isActive ? alphaBg('#fff', 0.3, '#fff') : alphaBg(item.color, 0.15, c.background) }]}>
                  <ThemedText style={{ color: isActive ? '#fff' : item.color, fontSize: 11, fontWeight: '700' }}>
                    {item.count}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Results count */}
      {!loading && filtered.length > 0 && (
        <View style={styles.resultsRow}>
          <ThemedText style={{ color: c.muted, fontSize: 13 }}>
            Showing {visible.length} of {filtered.length} reporters
          </ThemedText>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      {loading ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.listContent}>
            {Array.from({ length: 5 }).map((_, i) => (
              <ReporterCardSkeleton key={`skel-${i}`} scheme={scheme} />
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={styles.centerError}>
          <View style={[styles.errorIcon, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          </View>
          <ThemedText type="defaultSemiBold" style={[styles.errorTitle, { color: c.text }]}>
            Failed to load
          </ThemedText>
          <ThemedText style={[styles.errorText, { color: c.muted }]}>{error}</ThemedText>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: primary }, pressed && { opacity: 0.9 }]}
          >
            <MaterialIcons name="refresh" size={18} color={primaryText} />
            <ThemedText style={{ color: primaryText, fontWeight: '600' }}>Try Again</ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[primary]}
              tintColor={primary}
            />
          }
          renderItem={({ item }) => (
            <ReporterCard
              item={item}
              scheme={scheme}
              accent={primary}
              onOpen={() => openReporter(item.id)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (visibleCount >= filtered.length) return;
            setVisibleCount((n) => Math.min(filtered.length, n + PAGE_SIZE));
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: alphaBg(primary, 0.1, c.background) }]}>
                <MaterialIcons name="person-search" size={48} color={primary} />
              </View>
              <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 16 }}>
                No reporters found
              </ThemedText>
              <ThemedText style={{ color: c.muted, textAlign: 'center', marginTop: 6 }}>
                {search ? 'Try a different search term' : 'Add your first reporter to get started'}
              </ThemedText>
            </View>
          }
        />
      )}

      {/* FAB */}
      {canCreate && !loading && !error && (
        <Pressable
          onPress={() => router.push('/tenant/create-reporter')}
          style={({ pressed }) => [styles.fab, { backgroundColor: primary }, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <MaterialIcons name="person-add" size={24} color={primaryText} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Reporter Card  ───────────────────────────── */

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
  const designation = item.designation?.name || 'Reporter';
  const location = locationNameForReporter(item);

  const level = normalizeLevel(item.level);
  const levelMeta = LEVEL_META[level];

  const kyc = String(item.kycStatus || '').toUpperCase();
  const kycOk = ['APPROVED', 'VERIFIED', 'COMPLETED', 'SUCCESS'].some((t) => kyc.includes(t));
  const kycPending = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEW'].some((t) => kyc.includes(t));

  const subActive = !!item.subscriptionActive;
  const autoPublish = item.autoPublish === true;

  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: c.border }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: levelMeta.color }]} />

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: alphaBg(levelMeta.color, 0.12, c.background), borderColor: alphaBg(levelMeta.color, 0.25, c.border) }]}>
        {item.profilePhotoUrl ? (
          <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
        ) : (
          <ThemedText type="defaultSemiBold" style={{ color: levelMeta.color, fontSize: 18 }}>
            {initials(name)}
          </ThemedText>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <ThemedText type="defaultSemiBold" style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
            {name}
          </ThemedText>
          <View style={[styles.levelTag, { backgroundColor: alphaBg(levelMeta.color, 0.12, c.background) }]}>
            <MaterialIcons name={levelMeta.icon} size={12} color={levelMeta.color} />
            <ThemedText style={{ color: levelMeta.color, fontSize: 11, fontWeight: '600' }}>
              {levelMeta.label}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.cardDesignation, { color: c.muted }]} numberOfLines={1}>
          {designation}
        </ThemedText>

        <View style={styles.cardMetaRow}>
          <View style={styles.cardMeta}>
            <MaterialIcons name="phone" size={13} color={c.muted} />
            <ThemedText style={{ color: c.text, fontSize: 12 }}>{mobile}</ThemedText>
          </View>
          <View style={styles.cardMeta}>
            <MaterialIcons name="place" size={13} color={c.muted} />
            <ThemedText style={{ color: c.text, fontSize: 12 }} numberOfLines={1}>{location}</ThemedText>
          </View>
        </View>

        {/* Status badges */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: kycOk ? alphaBg('#10b981', 0.12, c.background) : kycPending ? alphaBg('#f59e0b', 0.12, c.background) : alphaBg(c.muted, 0.1, c.background),
              },
            ]}
          >
            <MaterialIcons
              name={kycOk ? 'verified' : kycPending ? 'pending' : 'help-outline'}
              size={12}
              color={kycOk ? '#10b981' : kycPending ? '#f59e0b' : c.muted}
            />
            <ThemedText style={{ color: kycOk ? '#10b981' : kycPending ? '#f59e0b' : c.muted, fontSize: 11 }}>
              KYC
            </ThemedText>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: subActive ? alphaBg('#10b981', 0.12, c.background) : alphaBg(c.muted, 0.1, c.background) },
            ]}
          >
            <MaterialIcons
              name={subActive ? 'check-circle' : 'cancel'}
              size={12}
              color={subActive ? '#10b981' : c.muted}
            />
            <ThemedText style={{ color: subActive ? '#10b981' : c.muted, fontSize: 11 }}>
              {subActive ? 'Active' : 'Inactive'}
            </ThemedText>
          </View>

          {autoPublish && (
            <View style={[styles.statusBadge, { backgroundColor: alphaBg(accent, 0.12, c.background) }]}>
              <MaterialIcons name="flash-on" size={12} color={accent} />
              <ThemedText style={{ color: accent, fontSize: 11 }}>Auto</ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <MaterialIcons name="chevron-right" size={22} color={c.muted} style={styles.chevron} />
    </Pressable>
  );
}

/* ─────────────────────────────  Skeleton  ───────────────────────────── */

function ReporterCardSkeleton({ scheme }: { scheme: 'light' | 'dark' }) {
  const c = Colors[scheme];
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: c.border }]} />
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={[styles.cardContent, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width="60%" height={16} borderRadius={8} />
          <Skeleton width={60} height={20} borderRadius={10} />
        </View>
        <Skeleton width="40%" height={12} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Skeleton width={80} height={12} borderRadius={6} />
          <Skeleton width={90} height={12} borderRadius={6} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={50} height={22} borderRadius={11} />
          <Skeleton width={55} height={22} borderRadius={11} />
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Header / Hero */
  headerWrap: { marginBottom: 8 },
  hero: {
    paddingTop: 52,
    paddingBottom: 50,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: { marginTop: 8 },
  heroTitle: { fontSize: 28, fontWeight: '700' },
  heroSubtitle: { fontSize: 14, marginTop: 4 },
  statsPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  statsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statsPillText: { fontSize: 12, fontWeight: '500' },

  /* Search */
  searchContainer: { marginTop: -24, marginHorizontal: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInputWrap: { flex: 1, height: '100%', justifyContent: 'center' },
  searchHintWrap: { position: 'absolute', left: 0, right: 0 },
  searchHint: { fontSize: 14 },
  searchInput: { fontSize: 15, padding: 0, margin: 0, flex: 1 },

  /* Filter chips */
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingHorizontal: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 2 },

  resultsRow: { paddingHorizontal: 16, marginTop: 16 },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cardContent: { flex: 1, minWidth: 0 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { fontSize: 16, flex: 1, minWidth: 0 },
  levelTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  cardDesignation: { fontSize: 13, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  chevron: { marginLeft: 4 },

  /* Empty / Error */
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  centerError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 18, marginTop: 8 },
  errorText: { textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
