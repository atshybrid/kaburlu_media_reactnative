import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { HttpError, getBaseUrl } from '@/services/http';
import {
    generateReporterIdCard,
    getReporterIdCard,
    getTenantReporter,
    getTenantReporters,
    updateReporterAutoPublish,
    verifyReporterKyc,
    type ReporterIdCard,
    type TenantReporter,
} from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function formatMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  if (!Number.isFinite(v)) return '—';
  return `₹${v.toLocaleString()}`;
}

function formatDateISO(d?: string | null) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return '—';
  const dt = new Date(t);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function isPast(d?: string | null) {
  if (!d) return false;
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return false;
  return Date.now() > t;
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

export default function TenantReporterDetailsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams();
  const reporterId = String(params?.id || '');

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporter, setReporter] = useState<TenantReporter | null>(null);

  const [autoPublishUpdating, setAutoPublishUpdating] = useState(false);
  const [idCardUpdating, setIdCardUpdating] = useState(false);
  const [idCardMessage, setIdCardMessage] = useState<string | null>(null);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [idCard, setIdCard] = useState<ReporterIdCard | null>(null);

  const [kycEditing, setKycEditing] = useState(false);
  const [kycUpdating, setKycUpdating] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycStatusDraft, setKycStatusDraft] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [kycNotesDraft, setKycNotesDraft] = useState('');
  const [verifiedAadharDraft, setVerifiedAadharDraft] = useState(true);
  const [verifiedPanDraft, setVerifiedPanDraft] = useState(true);
  const [verifiedWorkProofDraft, setVerifiedWorkProofDraft] = useState(true);

  const primary = brandPrimary || c.tint;
  const primaryText = pickReadableTextColor(primary) || Colors.light.background;

  const canManageAutoPublish = useMemo(() => {
    const r = String(role || '').toUpperCase();
    return !!tenantId && (r === 'SUPER_ADMIN' || r === 'TENANT_ADMIN');
  }, [role, tenantId]);

  const canManageKyc = canManageAutoPublish;

  /* ── Load session ── */
  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);
      setRole(String(t?.user?.role || ''));

      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      setBrandPrimary(isValidHexColor(pColor) ? String(pColor) : null);
    })();
  }, []);

  /* ── Load reporter ── */
  const load = useCallback(async (isRefresh = false) => {
    if (!tenantId || !reporterId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setIdCardMessage(null);
    setKycMessage(null);
    try {
      const r = await getTenantReporter(tenantId, reporterId);
      setReporter(r);
    } catch (e: any) {
      try {
        const list = await getTenantReporters(tenantId, { active: true });
        const found = (Array.isArray(list) ? list : []).find((x) => x.id === reporterId) || null;
        if (!found) throw e;
        setReporter(found);
      } catch {
        setReporter(null);
        setError(e?.message || 'Failed to load reporter');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, reporterId]);

  const loadIdCard = useCallback(async () => {
    if (!tenantId || !reporterId) return;
    setIdCardLoading(true);
    try {
      const card = await getReporterIdCard(tenantId, reporterId);
      setIdCard(card);
    } catch {
      setIdCard(null);
    } finally {
      setIdCardLoading(false);
    }
  }, [tenantId, reporterId]);

  useEffect(() => {
    if (!tenantId || !reporterId) return;
    load();
  }, [tenantId, reporterId, load]);

  useEffect(() => {
    if (!tenantId || !reporterId) return;
    loadIdCard();
  }, [tenantId, reporterId, loadIdCard]);

  useEffect(() => {
    if (!reporter) return;
    const current = String(reporter.kycStatus || '').toUpperCase();
    const next = (current === 'APPROVED' || current === 'REJECTED' || current === 'PENDING') ? (current as any) : 'APPROVED';
    setKycStatusDraft(next);
  }, [reporter]);

  /* ── Actions ── */
  const onToggleAutoPublish = useCallback(async (next: boolean) => {
    if (!tenantId || !reporter) return;
    setAutoPublishUpdating(true);
    try {
      const res = await updateReporterAutoPublish(tenantId, reporter.id, next);
      setReporter((prev) => (prev ? { ...prev, autoPublish: res.autoPublish } : prev));
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    } finally {
      setAutoPublishUpdating(false);
    }
  }, [tenantId, reporter]);

  const onDownloadIdCardPdf = useCallback(async () => {
    if (!tenantId || !reporter) return;
    if (!canManageAutoPublish) {
      Alert.alert('Not Authorized', 'Only tenant admins can download reporter ID cards.');
      return;
    }
    try {
      const t = await loadTokens();
      const jwt = t?.jwt;
      if (!jwt) throw new Error('Missing auth token');

      const base = getBaseUrl().replace(/\/$/, '');
      // Prefer tenant-scoped endpoints (works for tenant admins). Fallback to legacy reporter endpoint.
      const primaryUrl = `${base}/tenants/${encodeURIComponent(tenantId)}/reporters/${encodeURIComponent(reporter.id)}/id-card/pdf`;
      const fallbackUrl = `${base}/id-cards/pdf?reporterId=${encodeURIComponent(reporter.id)}`;
      const cacheRoot = (LegacyFileSystem as any).cacheDirectory as string | null | undefined;
      if (!cacheRoot) throw new Error('Missing cache directory');
      const cacheDir = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
      const target = `${cacheDir}id-card-${reporter.id}.pdf`;

      const downloadOnce = async (url: string) => {
        return await LegacyFileSystem.downloadAsync(url, target, {
          headers: { Accept: 'application/pdf', Authorization: `Bearer ${jwt}` },
        });
      };

      let result = await downloadOnce(primaryUrl);
      const status = Number((result as any)?.status || 0);
      if (status === 404) {
        result = await downloadOnce(fallbackUrl);
      } else if (status === 403) {
        throw new Error('Forbidden (403). Backend must allow tenant admin to download this PDF.');
      }

      if ((result as any)?.status && Number((result as any).status) !== 200) {
        throw new Error(`Failed to download PDF (HTTP ${(result as any).status})`);
      }

      const info = await LegacyFileSystem.getInfoAsync(result.uri).catch(() => null as any);
      if (!info?.exists) throw new Error('PDF file not found');

      const docRoot = (LegacyFileSystem as any).documentDirectory as string | null | undefined;
      if (!docRoot) throw new Error('Missing document directory');
      const downloadsDir = docRoot + 'downloads/';
      const downDirInfo = await LegacyFileSystem.getInfoAsync(downloadsDir).catch(() => ({ exists: false } as any));
      if (!downDirInfo?.exists) {
        await LegacyFileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true }).catch(() => {});
      }
      const persisted = `${downloadsDir}id-card-${reporter.id}.pdf`;
      await LegacyFileSystem.copyAsync({ from: result.uri, to: persisted });

      if (Platform.OS === 'android' && (FileSystem as any)?.StorageAccessFramework) {
        const SAF = (FileSystem as any).StorageAccessFramework;
        const DIR_KEY = 'saf_downloads_dir_uri';
        let directoryUri = await AsyncStorage.getItem(DIR_KEY);
        if (!directoryUri) {
          const perm = await SAF.requestDirectoryPermissionsAsync();
          if (!perm?.granted) throw new Error('Permission denied');
          await AsyncStorage.setItem(DIR_KEY, String(perm.directoryUri || ''));
          directoryUri = perm.directoryUri;
        }
        if (directoryUri) {
          const filename = `id-card-${reporter.id}.pdf`;
          const base64 = await LegacyFileSystem.readAsStringAsync(persisted, { encoding: (LegacyFileSystem as any).EncodingType.Base64 });
          const destUri = await SAF.createFileAsync(directoryUri, filename, 'application/pdf');
          await FileSystem.writeAsStringAsync(destUri, base64, { encoding: (FileSystem as any).EncodingType.Base64 });
          setIdCardMessage('Saved to Downloads');
        }
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(persisted, { mimeType: 'application/pdf', dialogTitle: 'ID Card PDF' } as any);
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(persisted, { mimeType: 'application/pdf', dialogTitle: 'ID Card PDF' } as any);
      setIdCardMessage('PDF ready');
    } catch (e: any) {
      setIdCardMessage(e?.message || 'Failed to download');
    }
  }, [tenantId, reporter, canManageAutoPublish]);

  /** Open ID card HTML in browser - same styling as PDF */
  const onViewIdCardHtml = useCallback(async () => {
    if (!tenantId || !reporter) return;
    if (!canManageAutoPublish) {
      Alert.alert('Not Authorized', 'Only tenant admins can view reporter ID cards.');
      return;
    }
    try {
      const base = getBaseUrl().replace(/\/$/, '');
      const primaryUrl = `${base}/tenants/${encodeURIComponent(tenantId)}/reporters/${encodeURIComponent(reporter.id)}/id-card/html`;
      const fallbackUrl = `${base}/id-cards/html?reporterId=${encodeURIComponent(reporter.id)}`;
      const url = primaryUrl;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) await Linking.openURL(fallbackUrl);
        else setIdCardMessage('Unable to open browser');
      }
    } catch (e: any) {
      setIdCardMessage(e?.message || 'Failed to open HTML');
    }
  }, [tenantId, reporter, canManageAutoPublish]);

  /** Share ID card HTML link or PDF */
  const onShareIdCard = useCallback(async () => {
    if (!tenantId || !reporter) return;
    if (!canManageAutoPublish) {
      Alert.alert('Not Authorized', 'Only tenant admins can share reporter ID cards.');
      return;
    }
    const base = getBaseUrl().replace(/\/$/, '');
    const primaryHtmlUrl = `${base}/tenants/${encodeURIComponent(tenantId)}/reporters/${encodeURIComponent(reporter.id)}/id-card/html`;
    const fallbackHtmlUrl = `${base}/id-cards/html?reporterId=${encodeURIComponent(reporter.id)}`;
    const htmlUrl = primaryHtmlUrl;
    
    Alert.alert(
      'Share ID Card',
      'Choose format to share',
      [
        {
          text: 'Share HTML Link',
          onPress: async () => {
            try {
              // Use Share API for URL - Android only uses message (url is treated as file)
              const { Share, Platform } = await import('react-native');
              await Share.share(
                Platform.OS === 'android'
                  ? { message: `Reporter ID Card: ${htmlUrl}` }
                  : { message: `Reporter ID Card: ${htmlUrl}`, url: htmlUrl, title: 'Reporter ID Card' }
              );
            } catch (e: any) {
              // If primary URL share fails (e.g., not supported), fallback to legacy share URL.
              try {
                const { Share, Platform } = await import('react-native');
                await Share.share(
                  Platform.OS === 'android'
                    ? { message: `Reporter ID Card: ${fallbackHtmlUrl}` }
                    : { message: `Reporter ID Card: ${fallbackHtmlUrl}`, url: fallbackHtmlUrl, title: 'Reporter ID Card' }
                );
              } catch (e2: any) {
                setIdCardMessage(e2?.message || e?.message || 'Failed to share');
              }
            }
          },
        },
        {
          text: 'Download & Share PDF',
          onPress: () => onDownloadIdCardPdf(),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [tenantId, reporter, canManageAutoPublish, onDownloadIdCardPdf]);

  const onIdCardPrimaryAction = useCallback(async () => {
    if (!tenantId || !reporter) return;
    if (!canManageAutoPublish) {
      Alert.alert('Not Authorized', 'Only tenant admins can generate reporter ID cards.');
      return;
    }
    setIdCardUpdating(true);
    setIdCardMessage(null);
    try {
      let card: ReporterIdCard | null = null;
      try {
        card = await getReporterIdCard(tenantId, reporter.id);
        // Some backends return `200 null` (or an incomplete object) when card doesn't exist.
        // Treat that as "not found" so we can trigger generation.
        if (!card || typeof (card as any)?.cardNumber !== 'string' || !(card as any).cardNumber) {
          throw new HttpError(404, card, 'ID card not found');
        }
        setIdCard(card);
      } catch (e: any) {
        if (e instanceof HttpError && e.status === 404) {
          // Validation checks before generating new ID card
          
          // 1. Check if profile photo is uploaded
          if (!reporter.profilePhotoUrl) {
            Alert.alert(
              'Profile Photo Required',
              'Reporter must upload a profile photo before generating an ID card.',
              [{ text: 'OK' }]
            );
            setIdCardUpdating(false);
            return;
          }
          
          // 2. Check subscription payment if subscription is active
          if (reporter.subscriptionActive) {
            const paymentStatus = reporter.stats?.subscriptionPayment?.currentMonth?.status;
            const isPaid = paymentStatus && ['PAID', 'COMPLETED', 'SUCCESS'].includes(String(paymentStatus).toUpperCase());
            if (!isPaid) {
              Alert.alert(
                'Payment Required',
                'Reporter has an active subscription but payment is pending. Please ensure payment is completed before generating an ID card.',
                [{ text: 'OK' }]
              );
              setIdCardUpdating(false);
              return;
            }
          }
          
          // All validations passed, generate ID card
          await generateReporterIdCard(tenantId, reporter.id);

          // Generation may be async; retry a few times before giving up.
          const retryDelaysMs = [300, 800, 1500, 2500];
          for (const ms of retryDelaysMs) {
            await new Promise((r) => setTimeout(r, ms));
            try {
              const maybe = await getReporterIdCard(tenantId, reporter.id);
              if (maybe && typeof (maybe as any)?.cardNumber === 'string' && (maybe as any).cardNumber) {
                card = maybe as ReporterIdCard;
                break;
              }
            } catch (err: any) {
              if (err instanceof HttpError && err.status === 404) continue;
              throw err;
            }
          }

          if (card) {
            setIdCard(card);
          } else {
            setIdCardMessage('ID card generation started. Please try again in a moment.');
            return;
          }
        } else throw e;
      }
      if (card) await onDownloadIdCardPdf();
      else setIdCardMessage('ID card not available');
    } catch (e: any) {
      if (e instanceof HttpError && e.status === 403) {
        setIdCardMessage('Forbidden (403). Backend must allow this action for your role.');
      } else {
        setIdCardMessage(e?.message || 'Failed');
      }
    } finally {
      setIdCardUpdating(false);
    }
  }, [tenantId, reporter, canManageAutoPublish, onDownloadIdCardPdf]);

  const onSubmitKyc = useCallback(async () => {
    if (!tenantId || !reporter) return;
    setKycUpdating(true);
    setKycMessage(null);
    try {
      const res = await verifyReporterKyc(tenantId, reporter.id, {
        status: kycStatusDraft,
        notes: kycNotesDraft?.trim() || undefined,
        verifiedAadhar: verifiedAadharDraft,
        verifiedPan: verifiedPanDraft,
        verifiedWorkProof: verifiedWorkProofDraft,
      });
      setReporter((prev) => (prev ? { ...prev, kycStatus: res.kycStatus } : prev));
      setKycEditing(false);
      setKycMessage('KYC updated');
    } catch (e: any) {
      setKycMessage(e?.message || 'Failed');
    } finally {
      setKycUpdating(false);
    }
  }, [tenantId, reporter, kycNotesDraft, kycStatusDraft, verifiedAadharDraft, verifiedPanDraft, verifiedWorkProofDraft]);

  /* ── Computed ── */
  const autoPublish = reporter?.autoPublish === true;
  const subscriptionActive = reporter?.subscriptionActive === true;
  const level = reporter ? normalizeLevel(reporter.level) : 'OTHER';
  const levelMeta = LEVEL_META[level];
  const location = reporter ? locationNameForReporter(reporter) : '—';

  const kyc = String(reporter?.kycStatus || '').toUpperCase();
  const kycOk = ['APPROVED', 'VERIFIED', 'COMPLETED', 'SUCCESS'].some((t) => kyc.includes(t));
  const kycPending = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEW'].some((t) => kyc.includes(t));

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <ReporterDetailSkeleton scheme={scheme} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (error || !reporter) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.errorCenter}>
          <View style={[styles.errorIcon, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          </View>
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 12 }}>
            {error || 'Reporter not found'}
          </ThemedText>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: primary }, pressed && { opacity: 0.9 }]}
          >
            <MaterialIcons name="refresh" size={18} color={primaryText} />
            <ThemedText style={{ color: primaryText, fontWeight: '600' }}>Try Again</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
            <ThemedText style={{ color: primary }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[primary]} tintColor={primary} />}
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={[levelMeta.color, alphaBg(levelMeta.color, 0.85, levelMeta.color)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.avatarLarge}>
              {reporter.profilePhotoUrl ? (
                <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <ThemedText type="title" style={{ color: levelMeta.color, fontSize: 28 }}>
                  {initials(reporter.fullName)}
                </ThemedText>
              )}
            </View>

            <ThemedText type="title" style={styles.heroName} numberOfLines={2}>
              {reporter.fullName || 'Unknown'}
            </ThemedText>

            <View style={styles.heroMeta}>
              <View style={styles.heroPill}>
                <MaterialIcons name={levelMeta.icon} size={14} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.heroPillText}>{levelMeta.label}</ThemedText>
              </View>
              <View style={styles.heroPill}>
                <MaterialIcons name="place" size={14} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.heroPillText}>{location}</ThemedText>
              </View>
            </View>

            <View style={styles.heroContactRow}>
              <MaterialIcons name="phone" size={16} color="rgba(255,255,255,0.85)" />
              <ThemedText style={styles.heroContactText}>{reporter.mobileNumber || '—'}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* ── Quick Stats ── */}
        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStat, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.quickStatIcon, { backgroundColor: alphaBg('#10b981', 0.12, c.background) }]}>
              <MaterialIcons name="article" size={20} color="#10b981" />
            </View>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 18 }}>
              {reporter.stats?.newspaperArticles?.total?.published ?? 0}
            </ThemedText>
            <ThemedText style={{ color: c.muted, fontSize: 11 }}>Published</ThemedText>
          </View>

          <View style={[styles.quickStat, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.quickStatIcon, { backgroundColor: alphaBg('#6366f1', 0.12, c.background) }]}>
              <MaterialIcons name="visibility" size={20} color="#6366f1" />
            </View>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 18 }}>
              {reporter.stats?.webArticleViews?.total ?? 0}
            </ThemedText>
            <ThemedText style={{ color: c.muted, fontSize: 11 }}>Views</ThemedText>
          </View>

          <View style={[styles.quickStat, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.quickStatIcon, { backgroundColor: alphaBg(kycOk ? '#10b981' : kycPending ? '#f59e0b' : c.muted, 0.12, c.background) }]}>
              <MaterialIcons name={kycOk ? 'verified' : kycPending ? 'pending' : 'help-outline'} size={20} color={kycOk ? '#10b981' : kycPending ? '#f59e0b' : c.muted} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 14 }}>
              {kycOk ? 'Verified' : kycPending ? 'Pending' : 'Unknown'}
            </ThemedText>
            <ThemedText style={{ color: c.muted, fontSize: 11 }}>KYC</ThemedText>
          </View>
        </View>

        {/* ── Content Cards ── */}
        <View style={styles.content}>
          {/* ── Basic Info ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Basic Information</ThemedText>
            </View>
            <View style={styles.infoGrid}>
              <InfoRow icon="badge" label="Designation" value={reporter.designation?.name || '—'} c={c} />
              <InfoRow icon="layers" label="Level" value={levelMeta.label} c={c} />
              <InfoRow icon="place" label="Location" value={location} c={c} />
              {(reporter as any).email && <InfoRow icon="email" label="Email" value={(reporter as any).email} c={c} />}
            </View>
          </View>

          {/* ── Publishing Settings ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="publish" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Publishing</ThemedText>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ color: c.text }}>Auto Publish</ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Articles published without review</ThemedText>
              </View>
              {canManageAutoPublish ? (
                autoPublishUpdating ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Switch
                    value={autoPublish}
                    onValueChange={onToggleAutoPublish}
                    trackColor={{ false: c.border, true: alphaBg(primary, 0.4, primary) }}
                    thumbColor={autoPublish ? primary : c.muted}
                  />
                )
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: autoPublish ? alphaBg('#10b981', 0.12, c.background) : alphaBg(c.muted, 0.1, c.background) }]}>
                  <ThemedText style={{ color: autoPublish ? '#10b981' : c.muted, fontSize: 12 }}>
                    {autoPublish ? 'Enabled' : 'Disabled'}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* ── KYC Verification ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="verified-user" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>KYC Verification</ThemedText>
              <View style={{ flex: 1 }} />
              <View style={[styles.statusBadge, { backgroundColor: kycOk ? alphaBg('#10b981', 0.12, c.background) : kycPending ? alphaBg('#f59e0b', 0.12, c.background) : alphaBg('#ef4444', 0.12, c.background) }]}>
                <MaterialIcons name={kycOk ? 'verified' : kycPending ? 'pending' : 'cancel'} size={14} color={kycOk ? '#10b981' : kycPending ? '#f59e0b' : '#ef4444'} />
                <ThemedText style={{ color: kycOk ? '#10b981' : kycPending ? '#f59e0b' : '#ef4444', fontSize: 12, fontWeight: '600' }}>
                  {reporter.kycStatus || 'NOT SUBMITTED'}
                </ThemedText>
              </View>
            </View>

            {/* Submitted Documents Section */}
            {reporter.kycData && (
              <View style={[styles.kycDocSection, { borderColor: c.border, backgroundColor: alphaBg(c.muted, 0.03, c.background) }]}>
                <ThemedText style={{ color: c.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 10 }}>Submitted Documents</ThemedText>
                
                <View style={styles.kycDocGrid}>
                  {/* Aadhar Card */}
                  <View style={[styles.kycDocItem, { borderColor: c.border, backgroundColor: c.background }]}>
                    <View style={[styles.kycDocIcon, { backgroundColor: alphaBg('#6366f1', 0.1, c.background) }]}>
                      <MaterialIcons name="credit-card" size={18} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Aadhaar Card</ThemedText>
                      <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>
                        {reporter.kycData.aadhaarNumber || reporter.kycData.aadharNumberMasked || '—'}
                      </ThemedText>
                    </View>
                    {reporter.kycData.verification?.verifiedAadhar !== undefined && (
                      <MaterialIcons 
                        name={reporter.kycData.verification.verifiedAadhar ? 'check-circle' : 'cancel'} 
                        size={18} 
                        color={reporter.kycData.verification.verifiedAadhar ? '#10b981' : '#ef4444'} 
                      />
                    )}
                  </View>

                  {/* PAN Card */}
                  <View style={[styles.kycDocItem, { borderColor: c.border, backgroundColor: c.background }]}>
                    <View style={[styles.kycDocIcon, { backgroundColor: alphaBg('#f59e0b', 0.1, c.background) }]}>
                      <MaterialIcons name="badge" size={18} color="#f59e0b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>PAN Card</ThemedText>
                      <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>
                        {reporter.kycData.panNumber || reporter.kycData.panNumberMasked || '—'}
                      </ThemedText>
                    </View>
                    {reporter.kycData.verification?.verifiedPan !== undefined && (
                      <MaterialIcons 
                        name={reporter.kycData.verification.verifiedPan ? 'check-circle' : 'cancel'} 
                        size={18} 
                        color={reporter.kycData.verification.verifiedPan ? '#10b981' : '#ef4444'} 
                      />
                    )}
                  </View>

                  {/* Work Proof */}
                  {reporter.kycData.workProofUrl && (
                    <View style={[styles.kycDocItem, { borderColor: c.border, backgroundColor: c.background }]}>
                      <View style={[styles.kycDocIcon, { backgroundColor: alphaBg('#10b981', 0.1, c.background) }]}>
                        <MaterialIcons name="work" size={18} color="#10b981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Work Proof</ThemedText>
                        <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>Document uploaded</ThemedText>
                      </View>
                      {reporter.kycData.verification?.verifiedWorkProof !== undefined && (
                        <MaterialIcons 
                          name={reporter.kycData.verification.verifiedWorkProof ? 'check-circle' : 'cancel'} 
                          size={18} 
                          color={reporter.kycData.verification.verifiedWorkProof ? '#10b981' : '#ef4444'} 
                        />
                      )}
                    </View>
                  )}
                </View>

                {/* Previous Verification Notes */}
                {reporter.kycData.verification?.notes && (
                  <View style={[styles.kycNotesBox, { borderColor: c.border, backgroundColor: alphaBg(c.muted, 0.05, c.background) }]}>
                    <MaterialIcons name="comment" size={14} color={c.muted} />
                    <ThemedText style={{ color: c.text, fontSize: 12, flex: 1 }}>{reporter.kycData.verification.notes}</ThemedText>
                  </View>
                )}

                {reporter.kycData.verification?.verifiedAt && (
                  <ThemedText style={{ color: c.muted, fontSize: 10, marginTop: 8 }}>
                    Last verified: {formatDateISO(reporter.kycData.verification.verifiedAt)}
                  </ThemedText>
                )}
              </View>
            )}

            {/* No KYC Data */}
            {!reporter.kycData && !kycPending && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <MaterialIcons name="folder-off" size={32} color={c.muted} />
                <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>No KYC documents submitted yet</ThemedText>
              </View>
            )}

            {canManageKyc && (
              <>
                {/* Quick Action Buttons */}
                {!kycEditing && kycPending && (
                  <View style={styles.kycQuickActions}>
                    <Pressable
                      onPress={() => {
                        setKycStatusDraft('APPROVED');
                        setVerifiedAadharDraft(true);
                        setVerifiedPanDraft(true);
                        setVerifiedWorkProofDraft(true);
                        setKycNotesDraft('Documents verified successfully');
                        setKycEditing(true);
                      }}
                      style={[styles.kycQuickBtn, { backgroundColor: alphaBg('#10b981', 0.1, c.background), borderColor: '#10b981' }]}
                    >
                      <MaterialIcons name="check-circle" size={18} color="#10b981" />
                      <ThemedText style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}>Quick Approve</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setKycStatusDraft('REJECTED');
                        setVerifiedAadharDraft(false);
                        setVerifiedPanDraft(false);
                        setVerifiedWorkProofDraft(false);
                        setKycNotesDraft('');
                        setKycEditing(true);
                      }}
                      style={[styles.kycQuickBtn, { backgroundColor: alphaBg('#ef4444', 0.1, c.background), borderColor: '#ef4444' }]}
                    >
                      <MaterialIcons name="cancel" size={18} color="#ef4444" />
                      <ThemedText style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Reject</ThemedText>
                    </Pressable>
                  </View>
                )}

                {/* Manual Review Toggle */}
                {!kycEditing && (
                  <Pressable
                    onPress={() => { setKycEditing(true); setKycMessage(null); }}
                    style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background, marginTop: kycPending ? 0 : 12 }]}
                  >
                    <MaterialIcons name="rate-review" size={16} color={primary} />
                    <ThemedText style={{ color: primary, fontWeight: '600' }}>Manual Review</ThemedText>
                  </Pressable>
                )}

                {/* Expanded Form */}
                {kycEditing && (
                  <View style={[styles.kycForm, { borderColor: c.border, backgroundColor: alphaBg(primary, 0.02, c.background) }]}>
                    <View style={styles.kycFormHeader}>
                      <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 14 }}>Update KYC Status</ThemedText>
                      <Pressable onPress={() => { setKycEditing(false); setKycMessage(null); }} hitSlop={10}>
                        <MaterialIcons name="close" size={20} color={c.muted} />
                      </Pressable>
                    </View>

                    {/* Status Selection */}
                    <ThemedText style={{ color: c.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 }}>Decision</ThemedText>
                    <View style={styles.chipRow}>
                      {(['APPROVED', 'REJECTED'] as const).map((s) => {
                        const selected = kycStatusDraft === s;
                        const isApprove = s === 'APPROVED';
                        const chipColor = isApprove ? '#10b981' : '#ef4444';
                        const icon = isApprove ? 'check-circle' : 'cancel';
                        return (
                          <Pressable
                            key={s}
                            onPress={() => setKycStatusDraft(s)}
                            style={[styles.kycDecisionChip, { 
                              backgroundColor: selected ? chipColor : c.background, 
                              borderColor: selected ? chipColor : c.border,
                              borderWidth: selected ? 2 : 1,
                            }]}
                          >
                            <MaterialIcons name={icon} size={16} color={selected ? '#fff' : chipColor} />
                            <ThemedText style={{ color: selected ? '#fff' : c.text, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>{s}</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Document Verification Checkboxes */}
                    <ThemedText style={{ color: c.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Document Verification</ThemedText>
                    <View style={[styles.kycVerifyBox, { borderColor: c.border, backgroundColor: c.background }]}>
                      <Pressable style={styles.kycVerifyRow} onPress={() => setVerifiedAadharDraft(v => !v)}>
                        <MaterialIcons 
                          name={verifiedAadharDraft ? 'check-box' : 'check-box-outline-blank'} 
                          size={22} 
                          color={verifiedAadharDraft ? '#10b981' : c.muted} 
                        />
                        <ThemedText style={{ color: c.text, flex: 1, marginLeft: 10 }}>Aadhaar Card Verified</ThemedText>
                      </Pressable>
                      <View style={[styles.kycVerifyDivider, { backgroundColor: c.border }]} />
                      <Pressable style={styles.kycVerifyRow} onPress={() => setVerifiedPanDraft(v => !v)}>
                        <MaterialIcons 
                          name={verifiedPanDraft ? 'check-box' : 'check-box-outline-blank'} 
                          size={22} 
                          color={verifiedPanDraft ? '#10b981' : c.muted} 
                        />
                        <ThemedText style={{ color: c.text, flex: 1, marginLeft: 10 }}>PAN Card Verified</ThemedText>
                      </Pressable>
                      <View style={[styles.kycVerifyDivider, { backgroundColor: c.border }]} />
                      <Pressable style={styles.kycVerifyRow} onPress={() => setVerifiedWorkProofDraft(v => !v)}>
                        <MaterialIcons 
                          name={verifiedWorkProofDraft ? 'check-box' : 'check-box-outline-blank'} 
                          size={22} 
                          color={verifiedWorkProofDraft ? '#10b981' : c.muted} 
                        />
                        <ThemedText style={{ color: c.text, flex: 1, marginLeft: 10 }}>Work Proof Verified</ThemedText>
                      </Pressable>
                    </View>

                    {/* Notes */}
                    <ThemedText style={{ color: c.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>
                      {kycStatusDraft === 'REJECTED' ? 'Rejection Reason' : 'Notes'} {kycStatusDraft === 'REJECTED' && <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>}
                    </ThemedText>
                    <TextInput
                      value={kycNotesDraft}
                      onChangeText={setKycNotesDraft}
                      placeholder={kycStatusDraft === 'REJECTED' ? 'Enter reason for rejection...' : 'Optional notes...'}
                      placeholderTextColor={c.muted}
                      multiline
                      numberOfLines={3}
                      style={[styles.kycNotesInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                    />

                    {/* Action Buttons */}
                    <View style={styles.kycFormActions}>
                      <Pressable
                        onPress={() => { setKycEditing(false); setKycMessage(null); }}
                        style={[styles.kycCancelBtn, { borderColor: c.border, backgroundColor: c.background }]}
                      >
                        <ThemedText style={{ color: c.text, fontWeight: '600' }}>Cancel</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={onSubmitKyc}
                        disabled={kycUpdating || (kycStatusDraft === 'REJECTED' && !kycNotesDraft.trim())}
                        style={[styles.kycSubmitBtn, { 
                          backgroundColor: kycStatusDraft === 'APPROVED' ? '#10b981' : '#ef4444', 
                          opacity: (kycUpdating || (kycStatusDraft === 'REJECTED' && !kycNotesDraft.trim())) ? 0.5 : 1 
                        }]}
                      >
                        {kycUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                          <>
                            <MaterialIcons name={kycStatusDraft === 'APPROVED' ? 'check' : 'close'} size={18} color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>
                              {kycStatusDraft === 'APPROVED' ? 'Approve KYC' : 'Reject KYC'}
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Message */}
                {kycMessage && (
                  <View style={[styles.kycMessageBox, { backgroundColor: alphaBg(kycMessage.includes('Failed') ? '#ef4444' : '#10b981', 0.1, c.background) }]}>
                    <MaterialIcons 
                      name={kycMessage.includes('Failed') ? 'error' : 'check-circle'} 
                      size={16} 
                      color={kycMessage.includes('Failed') ? '#ef4444' : '#10b981'} 
                    />
                    <ThemedText style={{ color: kycMessage.includes('Failed') ? '#ef4444' : '#10b981', fontSize: 12, marginLeft: 6 }}>{kycMessage}</ThemedText>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Subscription ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="card-membership" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Subscription</ThemedText>
              <View style={{ flex: 1 }} />
              <View style={[styles.statusBadge, { backgroundColor: subscriptionActive ? alphaBg('#10b981', 0.12, c.background) : alphaBg(c.muted, 0.1, c.background) }]}>
                <MaterialIcons name={subscriptionActive ? 'check-circle' : 'cancel'} size={14} color={subscriptionActive ? '#10b981' : c.muted} />
                <ThemedText style={{ color: subscriptionActive ? '#10b981' : c.muted, fontSize: 12 }}>
                  {subscriptionActive ? 'Active' : 'Inactive'}
                </ThemedText>
              </View>
            </View>

            {subscriptionActive && (
              <View style={styles.infoGrid}>
                <InfoRow icon="payments" label="Monthly Fee" value={formatMoney(reporter.monthlySubscriptionAmount)} c={c} />
                <InfoRow icon="credit-card" label="ID Card Charge" value={formatMoney(reporter.idCardCharge)} c={c} />
                <InfoRow icon="event" label="Payment Status" value={reporter.stats?.subscriptionPayment?.currentMonth?.status || '—'} c={c} />
              </View>
            )}
          </View>

          {/* ── Articles Stats ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="analytics" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Article Statistics</ThemedText>
            </View>

            <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>All Time</ThemedText>
            <View style={styles.statsGrid}>
              <StatTile icon="upload-file" label="Submitted" value={reporter.stats?.newspaperArticles?.total?.submitted ?? 0} color="#6366f1" c={c} />
              <StatTile icon="check-circle" label="Published" value={reporter.stats?.newspaperArticles?.total?.published ?? 0} color="#10b981" c={c} />
              <StatTile icon="cancel" label="Rejected" value={reporter.stats?.newspaperArticles?.total?.rejected ?? 0} color="#ef4444" c={c} />
            </View>

            <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 12, marginBottom: 8 }}>This Month</ThemedText>
            <View style={styles.statsGrid}>
              <StatTile icon="upload-file" label="Submitted" value={reporter.stats?.newspaperArticles?.currentMonth?.submitted ?? 0} color="#6366f1" c={c} />
              <StatTile icon="check-circle" label="Published" value={reporter.stats?.newspaperArticles?.currentMonth?.published ?? 0} color="#10b981" c={c} />
              <StatTile icon="cancel" label="Rejected" value={reporter.stats?.newspaperArticles?.currentMonth?.rejected ?? 0} color="#ef4444" c={c} />
            </View>
          </View>

          {/* ── ID Card ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="badge" size={20} color={primary} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>ID Card</ThemedText>
            </View>

            {idCardLoading ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color={primary} />
              </View>
            ) : idCard ? (
              <View style={[styles.idCardBox, { borderColor: isPast(idCard.expiresAt) ? '#ef4444' : c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>{idCard.cardNumber || '—'}</ThemedText>
                  <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Issued: {formatDateISO(idCard.issuedAt)}</ThemedText>
                  <ThemedText style={{ color: isPast(idCard.expiresAt) ? '#ef4444' : c.muted, fontSize: 12 }}>
                    Expires: {formatDateISO(idCard.expiresAt)}{isPast(idCard.expiresAt) ? ' (Expired)' : ''}
                  </ThemedText>
                </View>
                <View style={[styles.idCardStatus, { backgroundColor: isPast(idCard.expiresAt) ? alphaBg('#ef4444', 0.12, c.background) : alphaBg('#10b981', 0.12, c.background) }]}>
                  <MaterialIcons name={isPast(idCard.expiresAt) ? 'error' : 'verified'} size={16} color={isPast(idCard.expiresAt) ? '#ef4444' : '#10b981'} />
                </View>
              </View>
            ) : (
              <ThemedText style={{ color: c.muted }}>No ID card generated yet</ThemedText>
            )}

            {/* Action buttons row */}
            {idCard ? (
              <View style={styles.idCardActionsRow}>
                {/* Download PDF */}
                <Pressable
                  onPress={onIdCardPrimaryAction}
                  disabled={idCardUpdating}
                  style={[styles.idCardActionBtn, { borderColor: primary, backgroundColor: alphaBg(primary, 0.08, c.background) }]}
                >
                  {idCardUpdating ? <ActivityIndicator size="small" color={primary} /> : (
                    <>
                      <MaterialIcons name="download" size={18} color={primary} />
                      <ThemedText style={{ color: primary, fontWeight: '600', fontSize: 13 }}>Download</ThemedText>
                    </>
                  )}
                </Pressable>
                
                {/* View HTML - Same style as PDF */}
                <Pressable
                  onPress={onViewIdCardHtml}
                  style={[styles.idCardActionBtn, { borderColor: '#6366f1', backgroundColor: alphaBg('#6366f1', 0.08, c.background) }]}
                >
                  <MaterialIcons name="open-in-browser" size={18} color="#6366f1" />
                  <ThemedText style={{ color: '#6366f1', fontWeight: '600', fontSize: 13 }}>View</ThemedText>
                </Pressable>
                
                {/* Share */}
                <Pressable
                  onPress={onShareIdCard}
                  style={[styles.idCardActionBtn, { borderColor: '#10b981', backgroundColor: alphaBg('#10b981', 0.08, c.background) }]}
                >
                  <MaterialIcons name="share" size={18} color="#10b981" />
                  <ThemedText style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}>Share</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Requirements checklist */}
                <View style={[styles.idCardRequirements, { backgroundColor: alphaBg(c.muted, 0.05, c.background), borderColor: c.border }]}>
                  <ThemedText style={{ color: c.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 }}>Requirements</ThemedText>
                  
                  {/* Profile Photo */}
                  <View style={styles.idCardReqRow}>
                    <MaterialIcons 
                      name={reporter.profilePhotoUrl ? 'check-circle' : 'cancel'} 
                      size={16} 
                      color={reporter.profilePhotoUrl ? '#10b981' : '#ef4444'} 
                    />
                    <ThemedText style={{ color: reporter.profilePhotoUrl ? c.text : '#ef4444', fontSize: 12, marginLeft: 8 }}>
                      Profile photo uploaded
                    </ThemedText>
                  </View>
                  
                  {/* Payment (only if subscription is active) */}
                  {subscriptionActive && (
                    <View style={styles.idCardReqRow}>
                      <MaterialIcons 
                        name={(() => {
                          const status = reporter.stats?.subscriptionPayment?.currentMonth?.status;
                          const isPaid = status && ['PAID', 'COMPLETED', 'SUCCESS'].includes(String(status).toUpperCase());
                          return isPaid ? 'check-circle' : 'cancel';
                        })()} 
                        size={16} 
                        color={(() => {
                          const status = reporter.stats?.subscriptionPayment?.currentMonth?.status;
                          const isPaid = status && ['PAID', 'COMPLETED', 'SUCCESS'].includes(String(status).toUpperCase());
                          return isPaid ? '#10b981' : '#ef4444';
                        })()} 
                      />
                      <ThemedText style={{ 
                        color: (() => {
                          const status = reporter.stats?.subscriptionPayment?.currentMonth?.status;
                          const isPaid = status && ['PAID', 'COMPLETED', 'SUCCESS'].includes(String(status).toUpperCase());
                          return isPaid ? c.text : '#ef4444';
                        })(), 
                        fontSize: 12, 
                        marginLeft: 8 
                      }}>
                        Subscription payment completed
                      </ThemedText>
                    </View>
                  )}

                  <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>
                    Best practice: use View (HTML) to see the designed card, use Download (PDF) to save/share.
                  </ThemedText>
                </View>
                
                <Pressable
                  onPress={onIdCardPrimaryAction}
                  disabled={idCardUpdating}
                  style={[styles.actionBtn, { borderColor: primary, backgroundColor: alphaBg(primary, 0.08, c.background), marginTop: 12 }]}
                >
                  {idCardUpdating ? <ActivityIndicator size="small" color={primary} /> : (
                    <>
                      <MaterialIcons name="add-card" size={18} color={primary} />
                      <ThemedText style={{ color: primary, fontWeight: '600' }}>Generate ID Card</ThemedText>
                    </>
                  )}
                </Pressable>
              </>
            )}
            {idCardMessage && <ThemedText style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>{idCardMessage}</ThemedText>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Sub-Components  ───────────────────────────── */

function InfoRow({ icon, label, value, c }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; c: typeof Colors.light }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={16} color={c.muted} />
      <ThemedText style={{ color: c.muted, flex: 1 }}>{label}</ThemedText>
      <ThemedText style={{ color: c.text, fontWeight: '500' }}>{value}</ThemedText>
    </View>
  );
}

function StatTile({ icon, label, value, color, c }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: number; color: string; c: typeof Colors.light }) {
  return (
    <View style={[styles.statTile, { backgroundColor: alphaBg(color, 0.08, c.background), borderColor: alphaBg(color, 0.2, c.border) }]}>
      <MaterialIcons name={icon} size={18} color={color} />
      <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 18 }}>{value}</ThemedText>
      <ThemedText style={{ color: c.muted, fontSize: 11 }}>{label}</ThemedText>
    </View>
  );
}

function ReporterDetailSkeleton({ scheme, onBack }: { scheme: 'light' | 'dark'; onBack: () => void }) {
  const c = Colors[scheme];
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[c.muted, alphaBg(c.muted, 0.7, c.muted)]} style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.heroContent}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <View style={{ marginTop: 12 }}>
            <Skeleton width={180} height={24} borderRadius={12} />
          </View>
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
            <Skeleton width={70} height={24} borderRadius={12} />
            <Skeleton width={90} height={24} borderRadius={12} />
          </View>
        </View>
      </LinearGradient>
      <View style={styles.quickStatsRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.quickStat, { backgroundColor: c.card, borderColor: c.border }]}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <Skeleton width={50} height={18} borderRadius={9} style={{ marginTop: 8 }} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <View style={styles.content}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Skeleton width={24} height={24} borderRadius={12} />
              <Skeleton width={140} height={18} borderRadius={9} />
            </View>
            <Skeleton width="100%" height={14} borderRadius={7} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={14} borderRadius={7} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Hero */
  hero: {
    paddingTop: 52,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
  heroContent: { alignItems: 'center', marginTop: 8 },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImg: { width: '100%', height: '100%' },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  heroContactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  heroContactText: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },

  /* Quick Stats */
  quickStatsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: -20, gap: 10 },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickStatIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },

  /* Content */
  content: { padding: 16, gap: 16, paddingBottom: 32 },

  /* Cards */
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },

  /* Info */
  infoGrid: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  /* Settings */
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },

  /* Actions */
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginTop: 12 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 12 },

  /* KYC Form */
  kycForm: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  kycFormHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  kycDecisionChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  
  /* KYC Document Display */
  kycDocSection: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 12 },
  kycDocGrid: { gap: 10 },
  kycDocItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, gap: 12 },
  kycDocIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kycNotesBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
  
  /* KYC Quick Actions */
  kycQuickActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  kycQuickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  
  /* KYC Verification Checkboxes */
  kycVerifyBox: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  kycVerifyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  kycVerifyDivider: { height: 1, marginHorizontal: 14 },
  
  /* KYC Notes Input */
  kycNotesInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  
  /* KYC Form Actions */
  kycFormActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  kycCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  kycSubmitBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  
  /* KYC Message */
  kycMessageBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 12 },

  /* Stats */
  statsGrid: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },

  /* ID Card */
  idCardBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  idCardStatus: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  idCardActionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  idCardActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  idCardRequirements: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 8 },
  idCardReqRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },

  /* Error */
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
