import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getTenantReporters, type TenantReporter } from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGE_SIZE = 20;
const PRIMARY_COLOR = '#DC2626';

const LEVEL_TELUGU: Record<string, string> = {
  STATE: 'రాష్ట్రం',
  DISTRICT: 'జిల్లా',
  ASSEMBLY: 'నియోజకవర్గం',
  MANDAL: 'మండలం',
  OTHER: 'ఇతరులు',
};

/* ─────────────────────────────  Helpers  ───────────────────────────── */

function alphaBg(hex: string, alpha: number, fallback: string) {
  const h = hex.trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(h)) return fallback;
  const raw = h.slice(1);
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
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

const LEVEL_META: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; emoji: string }> = {
  STATE: { label: 'State', icon: 'public', color: '#7C3AED', emoji: '🏛️' },
  DISTRICT: { label: 'District', icon: 'location-city', color: '#2563EB', emoji: '🏢' },
  MANDAL: { label: 'Mandal', icon: 'apartment', color: '#D97706', emoji: '🏘️' },
  ASSEMBLY: { label: 'Assembly', icon: 'how-to-vote', color: '#059669', emoji: '🗳️' },
  OTHER: { label: 'Other', icon: 'person-pin', color: '#6B7280', emoji: '👤' },
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function TenantReportersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ kycFilter?: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporters, setReporters] = useState<TenantReporter[]>([]);

  const [search, setSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const [kycFilter, setKycFilter] = useState<string | null>(() => params.kycFilter || null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

      if (tid) {
        const list = await getTenantReporters(tid, { active: true });
        setReporters(Array.isArray(list) ? list : []);
        setVisibleCount(PAGE_SIZE);
      }
    } catch (e: any) {
      setError(e?.message || 'లోడ్ కాలేదు');
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
  const designationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reporters) {
      const desig = r.designation?.name || 'ఇతరులు';
      counts[desig] = (counts[desig] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [reporters]);

  const [desigFilter, setDesigFilter] = useState<string | null>(null);

  const baseFiltered = useMemo(() => {
    let list = reporters;
    if (desigFilter) {
      list = list.filter((r) => (r.designation?.name || 'ఇతరులు') === desigFilter);
    }
    if (kycFilter) {
      list = list.filter((r) => {
        const status = String(r.kycStatus || '').toUpperCase();
        if (kycFilter === 'PENDING') {
          return ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEW'].some((t) => status.includes(t));
        }
        if (kycFilter === 'APPROVED') {
          return ['APPROVED', 'VERIFIED', 'COMPLETED', 'SUCCESS'].some((t) => status.includes(t));
        }
        if (kycFilter === 'REJECTED') {
          return status.includes('REJECTED');
        }
        return true;
      });
    }
    return list;
  }, [reporters, desigFilter, kycFilter]);

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
      {/* Header with Search */}
      <View style={[styles.simpleHeader, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (searchActive) {
                setSearchActive(false);
                setSearch('');
              } else {
                router.back();
              }
            }}
            style={({ pressed }) => [styles.backBtnSimple, pressed && { opacity: 0.7 }]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          
          {searchActive ? (
            <TextInput
              ref={searchRef}
              style={[styles.headerSearchInput, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
              placeholder="పేరు, ఫోన్ లేదా ప్రాంతం..."
              placeholderTextColor={c.muted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
            />
          ) : (
            <View style={styles.headerTitleSection}>
              <Text style={[styles.simpleTitle, { color: c.text }]}>మై రిపోర్టర్స్</Text>
              <Text style={[styles.simpleCount, { color: c.muted }]}>{reporters.length} మంది</Text>
            </View>
          )}
          
          <Pressable
            onPress={() => {
              if (searchActive) {
                setSearch('');
              } else {
                setSearchActive(true);
              }
            }}
            style={({ pressed }) => [styles.headerSearchBtn, pressed && { opacity: 0.7 }]}
            hitSlop={12}
          >
            <MaterialIcons name={searchActive && search ? 'close' : 'search'} size={24} color={c.text} />
          </Pressable>
        </View>
      </View>

      {/* Designation Filter */}
      {designationCounts.length > 1 && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setDesigFilter(null)}
            style={[
              styles.simpleChip,
              { backgroundColor: !desigFilter ? PRIMARY_COLOR : c.card, borderColor: !desigFilter ? PRIMARY_COLOR : c.border },
            ]}
          >
            <Text style={{ color: !desigFilter ? '#fff' : c.text, fontSize: 14, fontWeight: '600' }}>
              అందరూ ({reporters.length})
            </Text>
          </Pressable>
          {designationCounts.map((item) => {
            const isActive = desigFilter === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => setDesigFilter(isActive ? null : item.name)}
                style={[
                  styles.simpleChip,
                  { backgroundColor: isActive ? PRIMARY_COLOR : c.card, borderColor: isActive ? PRIMARY_COLOR : c.border },
                ]}
              >
                <Text style={{ color: isActive ? '#fff' : c.text, fontSize: 14, fontWeight: '500' }}>
                  {item.name} ({item.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* KYC Filter Banner */}
      {kycFilter && (
        <View style={styles.kycBanner}>
          <View style={[styles.kycBannerContent, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <MaterialIcons name="info" size={18} color="#D97706" />
            <Text style={{ color: '#92400E', fontSize: 13, flex: 1 }}>
              {kycFilter === 'PENDING' ? 'KYC పెండింగ్' : kycFilter === 'APPROVED' ? 'KYC అప్రూవ్డ్' : 'KYC రిజెక్ట్'} వాళ్ళు మాత్రమే
            </Text>
            <Pressable onPress={() => setKycFilter(null)} hitSlop={8}>
              <MaterialIcons name="close" size={18} color="#D97706" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
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
          <View style={[styles.errorIcon, { backgroundColor: '#FEE2E2' }]}>
            <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          </View>
          <Text style={[styles.errorTitle, { color: c.text }]}>లోడ్ కాలేదు</Text>
          <Text style={[styles.errorText, { color: c.muted }]}>{error}</Text>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: PRIMARY_COLOR }, pressed && { opacity: 0.9 }]}
          >
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>మళ్ళీ ప్రయత్నించండి</Text>
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
              colors={[PRIMARY_COLOR]}
              tintColor={PRIMARY_COLOR}
            />
          }
          renderItem={({ item }) => (
            <ReporterCard
              item={item}
              scheme={scheme}
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
              <View style={[styles.emptyIcon, { backgroundColor: '#FEE2E2' }]}>
                <MaterialIcons name="people-outline" size={48} color={PRIMARY_COLOR} />
              </View>
              <Text style={{ color: c.text, marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                {search ? 'ఎవరూ కనుగొనబడలేదు' : 'రిపోర్టర్లు లేరు'}
              </Text>
              <Text style={{ color: c.muted, textAlign: 'center', marginTop: 6 }}>
                {search ? 'వేరే పేరుతో వెతకండి' : 'మొదటి రిపోర్టర్ ని యాడ్ చేయండి'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {canCreate && !loading && !error && (
        <Pressable
          onPress={() => router.push('/tenant/create-reporter')}
          style={({ pressed }) => [styles.fab, { backgroundColor: PRIMARY_COLOR }, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <MaterialIcons name="person-add" size={24} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Reporter Card  ───────────────────────────── */

function ReporterCard({
  item,
  scheme,
  onOpen,
}: {
  item: TenantReporter;
  scheme: 'light' | 'dark';
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
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: levelMeta.color + '20', borderColor: levelMeta.color }]}>
        {item.profilePhotoUrl ? (
          <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
        ) : (
          <Text style={{ color: levelMeta.color, fontSize: 20, fontWeight: '700' }}>
            {initials(name)}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.cardSub, { color: c.muted }]} numberOfLines={1}>
          {designation} • {location}
        </Text>
        <Text style={[styles.cardPhone, { color: c.text }]}>📞 {mobile}</Text>
      </View>

      {/* Status indicator */}
      <View style={[styles.statusDot, { backgroundColor: subActive ? '#10B981' : '#EF4444' }]} />
      
      <MaterialIcons name="chevron-right" size={24} color={c.muted} />
    </Pressable>
  );
}

/* ─────────────────────────────  Skeleton  ───────────────────────────── */

function ReporterCardSkeleton({ scheme }: { scheme: 'light' | 'dark' }) {
  const c = Colors[scheme];
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={[styles.cardContent, { gap: 8 }]}>
        <Skeleton width="70%" height={18} borderRadius={8} />
        <Skeleton width="50%" height={14} borderRadius={6} />
        <Skeleton width={100} height={14} borderRadius={6} />
      </View>
    </View>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Header */
  headerWrap: { marginBottom: 8 },

  /* Simple Header */
  simpleHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtnSimple: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleSection: {
    flex: 1,
  },
  simpleTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  simpleCount: {
    fontSize: 13,
    marginTop: 2,
  },
  headerSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSearchInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  /* Filter chips */
  filterRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  simpleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  /* KYC Banner */
  kycBanner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  kycBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  cardPressed: { opacity: 0.9 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 13 },
  cardPhone: { fontSize: 13, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

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
