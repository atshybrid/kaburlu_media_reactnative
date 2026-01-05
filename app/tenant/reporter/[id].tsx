import { ThemedText } from '@/components/ThemedText';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  if (!Number.isFinite(v)) return '—';
  return String(v);
}

function formatMonthYear(m?: number, y?: number) {
  if (!m || !y) return '—';
  return `${m}/${y}`;
}

function formatDateISO(d?: string | null) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return '—';
  const dt = new Date(t);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
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

export default function TenantReporterDetailsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams();
  const reporterId = String(params?.id || '');

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reporter, setReporter] = useState<TenantReporter | null>(null);

  const [autoPublishUpdating, setAutoPublishUpdating] = useState(false);
  const [idCardUpdating, setIdCardUpdating] = useState(false);
  const [idCardMessage, setIdCardMessage] = useState<string | null>(null);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [idCardError, setIdCardError] = useState<string | null>(null);
  const [idCard, setIdCard] = useState<ReporterIdCard | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [manualLoginMessage, setManualLoginMessage] = useState<string | null>(null);

  const [kycEditing, setKycEditing] = useState(false);
  const [kycUpdating, setKycUpdating] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycStatusDraft, setKycStatusDraft] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [kycNotesDraft, setKycNotesDraft] = useState('');
  const [verifiedAadharDraft, setVerifiedAadharDraft] = useState(true);
  const [verifiedPanDraft, setVerifiedPanDraft] = useState(true);
  const [verifiedWorkProofDraft, setVerifiedWorkProofDraft] = useState(true);

  const canManageAutoPublish = useMemo(() => {
    const r = String(role || '').toUpperCase();
    return !!tenantId && (r === 'SUPER_ADMIN' || r === 'TENANT_ADMIN');
  }, [role, tenantId]);

  const canManageKyc = canManageAutoPublish;

  const canManageBilling = canManageAutoPublish;

  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);
      setRole(String(t?.user?.role || ''));
    })();
  }, []);

  const load = useCallback(async () => {
    if (!tenantId || !reporterId) return;
    setLoading(true);
    setError(null);
    setIdCardMessage(null);
    setIdCardError(null);
    setSubscriptionMessage(null);
    setManualLoginMessage(null);
    setKycMessage(null);
    try {
      const r = await getTenantReporter(tenantId, reporterId);
      setReporter(r);
    } catch (e: any) {
      // Fallback: some builds may not have a reporter-details endpoint.
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
    }
  }, [tenantId, reporterId]);

  const loadIdCard = useCallback(async () => {
    if (!tenantId || !reporterId) return;
    setIdCardLoading(true);
    setIdCardError(null);
    try {
      const card = await getReporterIdCard(tenantId, reporterId);
      setIdCard(card);
    } catch (e: any) {
      setIdCard(null);
      setIdCardError(e?.message || 'Failed to load ID card');
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

  const autoPublish = reporter?.autoPublish === true;
  const subscriptionActive = reporter?.subscriptionActive === true;
  const manualLoginEnabled = reporter?.manualLoginEnabled === true;

  useEffect(() => {
    if (!reporter) return;
    const current = String(reporter.kycStatus || '').toUpperCase();
    const next = (current === 'APPROVED' || current === 'REJECTED' || current === 'PENDING') ? (current as any) : 'APPROVED';
    setKycStatusDraft(next);
  }, [reporter]);

  const onToggleAutoPublish = useCallback(
    async (next: boolean) => {
      if (!tenantId || !reporter) return;
      setAutoPublishUpdating(true);
      try {
        const res = await updateReporterAutoPublish(tenantId, reporter.id, next);
        setReporter((prev) => (prev ? { ...prev, autoPublish: res.autoPublish } : prev));
      } catch (e: any) {
        setError(e?.message || 'Failed to update auto publish');
      } finally {
        setAutoPublishUpdating(false);
      }
    },
    [tenantId, reporter],
  );

  const onDownloadIdCardPdf = useCallback(async () => {
    if (!reporter) return;
    try {
      const t = await loadTokens();
      const jwt = t?.jwt;
      if (!jwt) throw new Error('Missing auth token');

      const base = getBaseUrl().replace(/\/$/, '');
      const url = `${base}/id-cards/pdf?reporterId=${encodeURIComponent(reporter.id)}`;
      const cacheRoot = (LegacyFileSystem as any).cacheDirectory as string | null | undefined;
      if (!cacheRoot) throw new Error('Missing cache directory');
      const cacheDir = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
      const target = `${cacheDir}id-card-${reporter.id}.pdf`;

      const result = await LegacyFileSystem.downloadAsync(url, target, {
        headers: {
          Accept: 'application/pdf',
          Authorization: `Bearer ${jwt}`,
        },
      });

      if ((result as any)?.status && Number((result as any).status) !== 200) {
        throw new Error(`Failed to download PDF (HTTP ${(result as any).status})`);
      }

      const info = await LegacyFileSystem.getInfoAsync(result.uri).catch(() => null as any);
      if (!info?.exists) throw new Error('PDF file not found after download');
      if (typeof info.size === 'number' && info.size <= 0) throw new Error('Downloaded PDF is empty');

      // Persist in app document storage so share targets (e.g., WhatsApp) can reliably access it.
      const docRoot = (LegacyFileSystem as any).documentDirectory as string | null | undefined;
      if (!docRoot) throw new Error('Missing document directory');
      const downloadsDir = docRoot + 'downloads/';
      const downDirInfo = await LegacyFileSystem.getInfoAsync(downloadsDir).catch(() => ({ exists: false } as any));
      if (!downDirInfo?.exists) {
        await LegacyFileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true }).catch(() => {});
      }
      const persisted = `${downloadsDir}id-card-${reporter.id}.pdf`;
      await LegacyFileSystem.copyAsync({ from: result.uri, to: persisted });

      // Android: Save to user-accessible Downloads (best for printing).
      // We ask the user to pick a folder once, then reuse permission.
      if (Platform.OS === 'android' && (FileSystem as any)?.StorageAccessFramework) {
        const SAF = (FileSystem as any).StorageAccessFramework;
        const DIR_KEY = 'saf_downloads_dir_uri';
        let directoryUri = await AsyncStorage.getItem(DIR_KEY);
        if (!directoryUri) {
          const perm = await SAF.requestDirectoryPermissionsAsync();
          if (!perm?.granted) throw new Error('Permission denied to save in Downloads');
          const grantedDir = String(perm.directoryUri || '');
          if (!grantedDir) throw new Error('Missing Downloads directory');
          await AsyncStorage.setItem(DIR_KEY, grantedDir);
          directoryUri = grantedDir;
        }
        if (!directoryUri) throw new Error('Missing Downloads directory');
        const filename = `id-card-${reporter.id}.pdf`;
        const base64 = await LegacyFileSystem.readAsStringAsync(persisted, { encoding: (LegacyFileSystem as any).EncodingType.Base64 });
        const destUri = await SAF.createFileAsync(directoryUri, filename, 'application/pdf');
        await FileSystem.writeAsStringAsync(destUri, base64, { encoding: (FileSystem as any).EncodingType.Base64 });
        setIdCardMessage('Saved to Downloads');

        // Also open share sheet from the persisted file path (best compatibility with WhatsApp).
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(persisted, {
            mimeType: 'application/pdf',
            dialogTitle: 'ID Card PDF',
          } as any);
        }
        return;
      }

      // iOS/others: fall back to share sheet.
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(persisted, {
          mimeType: 'application/pdf',
          dialogTitle: 'ID Card PDF',
        } as any);
      }
      setIdCardMessage('PDF downloaded');
    } catch (e: any) {
      setIdCardMessage(e?.message || 'Failed to download PDF');
    }
  }, [reporter]);

  const onIdCardPrimaryAction = useCallback(async () => {
    if (!tenantId || !reporter) return;
    setIdCardUpdating(true);
    setIdCardMessage(null);
    try {
      // First check GET api (as requested)
      let card: ReporterIdCard | null = null;
      try {
        card = await getReporterIdCard(tenantId, reporter.id);
        setIdCard(card);
      } catch (e: any) {
        // If card doesn't exist, generate it.
        if (e instanceof HttpError && e.status === 404) {
          await generateReporterIdCard(tenantId, reporter.id);
          await loadIdCard();
          card = await getReporterIdCard(tenantId, reporter.id);
          setIdCard(card);
        } else {
          throw e;
        }
      }

      // If we have a card now, download/share the PDF
      if (card) {
        await onDownloadIdCardPdf();
      } else {
        setIdCardMessage('ID card not available');
      }
    } catch (e: any) {
      setIdCardMessage(e?.message || 'Failed to process ID card');
    } finally {
      setIdCardUpdating(false);
    }
  }, [tenantId, reporter, onDownloadIdCardPdf, loadIdCard]);

  const onAddSubscription = useCallback(() => {
    setSubscriptionMessage('Subscription update API not configured in app yet.');
  }, []);

  const onEnableManualLogin = useCallback(() => {
    setManualLoginMessage('Manual login update API not configured in app yet.');
  }, []);

  const onSubmitKyc = useCallback(async () => {
    if (!tenantId || !reporter) return;
    setKycUpdating(true);
    setKycMessage(null);
    try {
      const res = await verifyReporterKyc(tenantId, reporter.id, {
        status: kycStatusDraft,
        notes: kycNotesDraft?.trim() ? kycNotesDraft.trim() : undefined,
        verifiedAadhar: verifiedAadharDraft,
        verifiedPan: verifiedPanDraft,
        verifiedWorkProof: verifiedWorkProofDraft,
      });
      setReporter((prev) => (prev ? { ...prev, kycStatus: res.kycStatus } : prev));
      setKycEditing(false);
      setKycMessage('KYC updated');
    } catch (e: any) {
      setKycMessage(e?.message || 'Failed to update KYC');
    } finally {
      setKycUpdating(false);
    }
  }, [tenantId, reporter, kycNotesDraft, kycStatusDraft, verifiedAadharDraft, verifiedPanDraft, verifiedWorkProofDraft]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16, flex: 1 }} numberOfLines={1}>
          Reporter Details
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.muted} />
          <ThemedText style={{ color: c.muted }}>Loading…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
            Couldn’t load reporter
          </ThemedText>
          <ThemedText style={{ color: c.muted, textAlign: 'center' }}>{error}</ThemedText>
          <Pressable onPress={load} style={[styles.primaryBtn, { backgroundColor: c.tint }]}>
            <ThemedText type="defaultSemiBold" style={{ color: Colors.light.background }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      ) : reporter ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={[styles.headerCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.headerRow}>
              <View style={[styles.avatar, { borderColor: c.border, backgroundColor: c.background }]}>
                {reporter.profilePhotoUrl ? (
                  <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                    {initials(reporter.fullName)}
                  </ThemedText>
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }} numberOfLines={1}>
                  {reporter.fullName || '—'}
                </ThemedText>
                <ThemedText style={{ color: c.muted }} numberOfLines={1}>
                  {reporter.mobileNumber || '—'}
                </ThemedText>
                <ThemedText style={{ color: c.muted }} numberOfLines={1}>
                  {reporter.designation?.name || '—'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* KYC */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              KYC
            </ThemedText>
            <ThemedText style={{ color: c.muted }}>Status: {reporter.kycStatus || '—'}</ThemedText>

            {canManageKyc ? (
              <>
                <Pressable
                  onPress={() => {
                    setKycEditing((v) => !v);
                    setKycMessage(null);
                  }}
                  style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
                >
                  <MaterialIcons name="fact-check" size={18} color={c.text} />
                  <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                    {kycEditing ? 'Close KYC Update' : 'Update KYC'}
                  </ThemedText>
                </Pressable>

                {kycEditing ? (
                  <View style={{ gap: 10, marginTop: 10 }}>
                    <View style={{ gap: 8 }}>
                      <ThemedText style={{ color: c.muted }}>Status</ThemedText>
                      <View style={styles.chipSelectRow}>
                        {(['APPROVED', 'PENDING', 'REJECTED'] as const).map((s) => {
                          const selected = kycStatusDraft === s;
                          return (
                            <Pressable
                              key={s}
                              onPress={() => setKycStatusDraft(s)}
                              style={[
                                styles.selectChip,
                                {
                                  borderColor: selected ? c.tint : c.border,
                                  backgroundColor: selected ? c.background : c.card,
                                },
                              ]}
                            >
                              <ThemedText style={{ color: selected ? c.text : c.muted, fontSize: 12 }} type={selected ? 'defaultSemiBold' : undefined}>
                                {s}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={{ gap: 8 }}>
                      <ThemedText style={{ color: c.muted }}>Notes</ThemedText>
                      <TextInput
                        value={kycNotesDraft}
                        onChangeText={setKycNotesDraft}
                        placeholder="e.g. good"
                        placeholderTextColor={c.muted}
                        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                      />
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={styles.rowBetweenCompact}>
                        <ThemedText style={{ color: c.muted }}>Verified Aadhar</ThemedText>
                        <Switch value={verifiedAadharDraft} onValueChange={setVerifiedAadharDraft} />
                      </View>
                      <View style={styles.rowBetweenCompact}>
                        <ThemedText style={{ color: c.muted }}>Verified PAN</ThemedText>
                        <Switch value={verifiedPanDraft} onValueChange={setVerifiedPanDraft} />
                      </View>
                      <View style={styles.rowBetweenCompact}>
                        <ThemedText style={{ color: c.muted }}>Verified Work Proof</ThemedText>
                        <Switch value={verifiedWorkProofDraft} onValueChange={setVerifiedWorkProofDraft} />
                      </View>
                    </View>

                    <Pressable
                      onPress={onSubmitKyc}
                      disabled={kycUpdating}
                      style={[styles.primaryActionBtn, { backgroundColor: c.tint, opacity: kycUpdating ? 0.7 : 1 }]}
                    >
                      {kycUpdating ? (
                        <ActivityIndicator size="small" color={Colors.light.background} />
                      ) : (
                        <ThemedText type="defaultSemiBold" style={{ color: Colors.light.background }}>
                          Save KYC
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {kycMessage ? <ThemedText style={{ color: c.muted }}>{kycMessage}</ThemedText> : null}
              </>
            ) : null}
          </View>

          {/* Publishing */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              Publishing
            </ThemedText>

            <View style={styles.rowBetween}>
              <ThemedText style={{ color: c.muted }}>Auto publish</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ThemedText style={{ color: autoPublish ? c.tint : c.muted }} type={autoPublish ? 'defaultSemiBold' : undefined}>
                  {autoPublish ? 'Yes' : 'No'}
                </ThemedText>
                {canManageAutoPublish ? (
                  autoPublishUpdating ? (
                    <ActivityIndicator size="small" color={c.muted} />
                  ) : (
                    <Switch value={autoPublish} onValueChange={(v) => onToggleAutoPublish(!!v)} />
                  )
                ) : null}
              </View>
            </View>
          </View>

          {/* Subscription + payments */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              Subscription & Payment
            </ThemedText>

            {subscriptionActive ? (
              <>
                <ThemedText style={{ color: c.muted }}>Subscription: Active</ThemedText>
                <ThemedText style={{ color: c.muted }}>
                  Monthly: {formatMoney(reporter.monthlySubscriptionAmount)} • ID Card charge: {formatMoney(reporter.idCardCharge)}
                </ThemedText>
                <ThemedText style={{ color: c.muted }}>
                  Payment ({formatMonthYear(reporter.stats?.subscriptionPayment?.currentMonth?.month, reporter.stats?.subscriptionPayment?.currentMonth?.year)}):{' '}
                  {reporter.stats?.subscriptionPayment?.currentMonth?.status ?? '—'}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={{ color: c.muted }}>Subscription: Inactive</ThemedText>
                {canManageBilling ? (
                  <Pressable onPress={onAddSubscription} style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}>
                    <MaterialIcons name="add-circle-outline" size={18} color={c.text} />
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                      Add Subscription
                    </ThemedText>
                  </Pressable>
                ) : null}
                {subscriptionMessage ? <ThemedText style={{ color: c.muted }}>{subscriptionMessage}</ThemedText> : null}
              </>
            )}
          </View>

          {/* Manual login */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              Manual Login
            </ThemedText>
            {manualLoginEnabled ? (
              <>
                <ThemedText style={{ color: c.muted }}>Enabled: Yes</ThemedText>
                <ThemedText style={{ color: c.muted }}>Days: {reporter.manualLoginDays ?? '—'}</ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={{ color: c.muted }}>Enabled: No</ThemedText>
                {canManageBilling ? (
                  <Pressable onPress={onEnableManualLogin} style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}>
                    <MaterialIcons name="schedule" size={18} color={c.text} />
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                      Enable Manual Login
                    </ThemedText>
                  </Pressable>
                ) : null}
                {manualLoginMessage ? <ThemedText style={{ color: c.muted }}>{manualLoginMessage}</ThemedText> : null}
              </>
            )}
          </View>

          {/* Articles */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              Articles
            </ThemedText>

            <ThemedText style={{ color: c.muted }}>Total</ThemedText>
            <View style={styles.tileRow}>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="upload-file" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.total?.submitted ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Submitted</ThemedText>
              </View>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="check-circle-outline" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.total?.published ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Published</ThemedText>
              </View>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="cancel" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.total?.rejected ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Rejected</ThemedText>
              </View>
            </View>

            <ThemedText style={{ color: c.muted, marginTop: 6 }}>This Month</ThemedText>
            <View style={styles.tileRow}>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="upload-file" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.currentMonth?.submitted ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Submitted</ThemedText>
              </View>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="check-circle-outline" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.currentMonth?.published ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Published</ThemedText>
              </View>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="cancel" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.newspaperArticles?.currentMonth?.rejected ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Rejected</ThemedText>
              </View>
            </View>

            <ThemedText style={{ color: c.muted, marginTop: 6 }}>Web Views</ThemedText>
            <View style={styles.tileRow2}>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="public" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.webArticleViews?.total ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>Total</ThemedText>
              </View>
              <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="calendar-today" size={18} color={c.muted} />
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  {reporter.stats?.webArticleViews?.currentMonth ?? 0}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>This Month</ThemedText>
              </View>
              <View style={[styles.tileSpacer]} />
            </View>
          </View>

          {/* ID card */}
          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
              ID Card
            </ThemedText>
            {idCardLoading ? (
              <View style={{ marginTop: 6 }}>
                <ActivityIndicator size="small" color={c.muted} />
              </View>
            ) : idCard ? (
              <View
                style={[
                  styles.idCardBox,
                  {
                    borderColor: isPast(idCard.expiresAt) ? Colors[scheme].danger : c.border,
                    backgroundColor: c.background,
                  },
                ]}
              >
                <View style={styles.idCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                      {idCard.cardNumber || '—'}
                    </ThemedText>
                    <ThemedText style={{ color: c.muted }}>
                      Issued: {formatDateISO(idCard.issuedAt)}
                    </ThemedText>
                    <ThemedText style={{ color: isPast(idCard.expiresAt) ? Colors[scheme].danger : c.muted }}>
                      Expires: {formatDateISO(idCard.expiresAt)}{isPast(idCard.expiresAt) ? ' (Expired)' : ''}
                    </ThemedText>
                  </View>

                  <View style={[styles.idCardStatusPill, { borderColor: c.border, backgroundColor: c.card }]}>
                    <MaterialIcons name={isPast(idCard.expiresAt) ? 'error-outline' : 'verified'} size={18} color={isPast(idCard.expiresAt) ? Colors[scheme].danger : c.tint} />
                    <ThemedText style={{ color: isPast(idCard.expiresAt) ? Colors[scheme].danger : c.tint, fontSize: 12 }} type="defaultSemiBold">
                      {isPast(idCard.expiresAt) ? 'Expired' : 'Active'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : (
              <ThemedText style={{ color: c.muted }}>
                {idCardError || 'No ID card found'}
              </ThemedText>
            )}

            <ThemedText style={{ color: c.muted, marginTop: 6 }}>
              {idCard ? 'Download the ID card PDF.' : 'Generate the ID card to enable download.'}
            </ThemedText>

            <Pressable onPress={onIdCardPrimaryAction} style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}>
              {idCardUpdating ? (
                <ActivityIndicator size="small" color={c.muted} />
              ) : (
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                  {idCard ? 'Download ID Card' : 'Generate ID Card'}
                </ThemedText>
              )}
            </Pressable>

            {idCardMessage ? <ThemedText style={{ color: c.muted }}>{idCardMessage}</ThemedText> : null}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <ThemedText style={{ color: c.muted }}>Reporter not found</ThemedText>
        </View>
      )}
    </SafeAreaView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  content: { padding: 12, paddingBottom: 20, gap: 12 },

  headerCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },

  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 },

  actionBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
  },

  primaryActionBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  chipSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  rowBetweenCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  tileRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  tileRow2: { flexDirection: 'row', gap: 10, marginTop: 6 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 86,
  },
  tileSpacer: { flex: 1 },

  primaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },

  idCardBox: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  idCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  idCardStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
