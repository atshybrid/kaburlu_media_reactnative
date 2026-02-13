import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { 
  getTenantReporters, 
  deleteReporter,
  toggleReporterActive,
  type TenantReporter,
  type ReporterLevel,
} from '@/services/reporters';
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
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
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

  /* ── Reporter Management Modals ── */
  const [selectedReporter, setSelectedReporter] = useState<TenantReporter | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  /* ── Reporter Management Actions ── */
  
  const handleDeletePress = useCallback((reporter: TenantReporter) => {
    setSelectedReporter(reporter);
    setDeleteModalVisible(true);
  }, []);

  const handleTransferPress = useCallback((reporter: TenantReporter) => {
    // Navigate to transfer screen instead of showing modal
    (router.push as any)({
      pathname: '/tenant/transfer-reporter',
      params: {
        reporterId: reporter.id,
        reporterName: reporter.fullName || 'Reporter',
        currentDesignationId: reporter.designationId || '',
      }
    });
  }, [router]);

  const confirmDelete = useCallback(async () => {
    if (!tenantId || !selectedReporter) return;
    
    setActionLoading(true);
    try {
      await deleteReporter(tenantId, selectedReporter.id);
      
      // Remove from list
      setReporters(prev => prev.filter(r => r.id !== selectedReporter.id));
      
      setDeleteModalVisible(false);
      setSelectedReporter(null);
      
      Alert.alert('విజయవంతం', 'రిపోర్టర్ తొలగించబడింది');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('cannot delete') || msg.includes('yourself')) {
        Alert.alert('తప్పు', 'మీరు మీ స్వంత ప్రొఫైల్‌ని తొలగించలేరు');
      } else {
        Alert.alert('తప్పు', msg || 'తొలగించడం విఫలమైంది. మళ్ళీ ప్రయత్నించండి.');
      }
    } finally {
      setActionLoading(false);
    }
  }, [tenantId, selectedReporter]);

  const confirmDeactivate = useCallback(async () => {
    if (!tenantId || !selectedReporter) return;
    
    setActionLoading(true);
    try {
      await toggleReporterActive(tenantId, selectedReporter.id, false);
      
      // Update in list
      setReporters(prev => prev.map(r => 
        r.id === selectedReporter.id ? { ...r, active: false } : r
      ));
      
      setDeleteModalVisible(false);
      setSelectedReporter(null);
      
      Alert.alert('విజయవంతం', 'రిపోర్టర్ డీయాక్టివేట్ చేయబడింది');
    } catch (e: any) {
      Alert.alert('తప్పు', e?.message || 'డీయాక్టివేట్ చేయడం విఫలమైంది');
    } finally {
      setActionLoading(false);
    }
  }, [tenantId, selectedReporter]);

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
              <Text style={[styles.simpleTitle, { color: c.text }]}>My Reporters</Text>
              <Text style={[styles.simpleCount, { color: c.muted }]}>{reporters.length} Active Members</Text>
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
              onDelete={() => handleDeletePress(item)}
              onTransfer={() => handleTransferPress(item)}
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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !actionLoading && setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: c.card }]}>
            <View style={[styles.confirmIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialIcons name="delete-outline" size={40} color="#DC2626" />
            </View>
            
            <Text style={[styles.confirmTitle, { color: c.text }]}>రిపోర్టర్ తొలగించాలా?</Text>
            <Text style={[styles.confirmSubtitle, { color: c.muted }]}>
              {selectedReporter?.fullName || 'Reporter'}
            </Text>
            
            <Text style={[styles.confirmWarning, { color: '#92400E', backgroundColor: '#FEF3C7' }]}>
              ⚠️ డిలీట్ చేస్తే మొబైల్ నంబర్ విడుదల అవుతుంది. కానీ పోస్ట్ హిస్టరీ ఉంటుంది.
            </Text>
            
            <Text style={[styles.confirmHint, { color: c.muted }]}>
              💡 బదులుగా డీయాక్టివేట్ చేయండి - డేటా సేఫ్‌గా ఉంటుంది
            </Text>

            {actionLoading ? (
              <View style={styles.confirmActions}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={{ color: c.muted, marginTop: 8 }}>దయచేసి వేచి ఉండండి...</Text>
              </View>
            ) : (
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={confirmDeactivate}
                >
                  <MaterialIcons name="pause-circle-outline" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>డీయాక్టివేట్</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#DC2626' }]}
                  onPress={confirmDelete}
                >
                  <MaterialIcons name="delete-forever" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>తొలగించు</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnCancel, { borderColor: c.border }]}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text style={{ color: c.text, fontWeight: '600' }}>రద్దు</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ─────────────────────────────  Reporter Card  ───────────────────────────── */

function ReporterCard({
  item,
  scheme,
  onOpen,
  onDelete,
  onTransfer,
}: {
  item: TenantReporter;
  scheme: 'light' | 'dark';
  onOpen: () => void;
  onDelete?: () => void;
  onTransfer?: () => void;
}) {
  const c = Colors[scheme];
  const [menuVisible, setMenuVisible] = useState(false);
  
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
    <View style={styles.cardWrapper}>
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
        
        {/* More Menu */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            setMenuVisible(true);
          }}
          style={({ pressed }) => [
            styles.moreBtn,
            pressed && { opacity: 0.5 }
          ]}
          hitSlop={8}
        >
          <MaterialIcons name="more-vert" size={24} color={c.muted} />
        </Pressable>
      </Pressable>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.actionMenu, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.actionMenuTitle, { color: c.text }]}>{name}</Text>
            
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setMenuVisible(false);
                onOpen();
              }}
            >
              <MaterialIcons name="visibility" size={22} color="#3B82F6" />
              <Text style={[styles.actionMenuText, { color: c.text }]}>వివరాలు చూడండి</Text>
            </TouchableOpacity>

            {onTransfer && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onTransfer();
                }}
              >
                <MaterialIcons name="swap-horiz" size={22} color="#F59E0B" />
                <Text style={[styles.actionMenuText, { color: c.text }]}>డిజిగ్నేషన్ మార్చండి</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onDelete();
                }}
              >
                <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                <Text style={[styles.actionMenuText, { color: '#EF4444' }]}>తొలగించండి</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.actionMenuDivider, { backgroundColor: c.border }]} />
            
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => setMenuVisible(false)}
            >
              <MaterialIcons name="close" size={22} color={c.muted} />
              <Text style={[styles.actionMenuText, { color: c.muted }]}>రద్దు</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
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
    paddingTop: 16,
    paddingBottom: 18,
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
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  simpleCount: {
    fontSize: 14,
    marginTop: 3,
    fontWeight: '500',
  },
  headerSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
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
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  cardPressed: { opacity: 0.9 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cardContent: { flex: 1, gap: 4 },
  cardName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  cardPhone: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },

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

  /* Card Wrapper */
  cardWrapper: { position: 'relative' },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Modal Overlay */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Action Menu */
  actionMenu: {
    width: '80%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  actionMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionMenuText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionMenuDivider: {
    height: 1,
    marginVertical: 4,
  },

  /* Confirm Modal */
  confirmModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmWarning: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
  },
  confirmHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmActions: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  confirmBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
});
