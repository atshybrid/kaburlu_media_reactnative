import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import {
    getMyProfile,
    submitReporterKyc,
    type MyProfileResponse,
} from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
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

const KYC_STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap; desc: string }> = {
  APPROVED: { label: 'Verified', color: '#10b981', icon: 'verified-user', desc: 'Your KYC documents have been verified' },
  SUBMITTED: { label: 'Under Review', color: '#f59e0b', icon: 'pending', desc: 'Your documents are being reviewed' },
  PENDING: { label: 'Pending', color: '#8b5cf6', icon: 'hourglass-empty', desc: 'Please submit your KYC documents' },
  REJECTED: { label: 'Rejected', color: '#ef4444', icon: 'cancel', desc: 'Your documents were rejected. Please resubmit' },
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function ReporterKycScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);

  // Form fields
  const [aadharMasked, setAadharMasked] = useState('');
  const [panMasked, setPanMasked] = useState('');
  const [workProofUrl, setWorkProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const primary = brandPrimary || c.tint;
  const reporter = profile?.reporter;
  const tenantId = reporter?.tenantId;
  const reporterId = reporter?.id;

  const kycStatus = reporter?.kycStatus || 'PENDING';
  const kycMeta = KYC_STATUS_META[kycStatus] || KYC_STATUS_META.PENDING;
  const canSubmit = kycStatus === 'PENDING' || kycStatus === 'REJECTED';

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSubmitMessage(null);

    try {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      if (isValidHexColor(pColor)) setBrandPrimary(String(pColor));

      const data = await getMyProfile();
      setProfile(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => void loadData(true), [loadData]);

  const onSubmitKyc = useCallback(async () => {
    if (!tenantId || !reporterId) {
      setSubmitMessage('Session expired. Please login again.');
      return;
    }

    if (!aadharMasked.trim() && !panMasked.trim() && !workProofUrl.trim()) {
      Alert.alert('Required', 'Please fill at least one document field');
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const result = await submitReporterKyc(tenantId, reporterId, {
        aadharNumberMasked: aadharMasked.trim() || undefined,
        panNumberMasked: panMasked.trim() || undefined,
        workProofUrl: workProofUrl.trim() || undefined,
      });

      setProfile((prev) =>
        prev ? { ...prev, reporter: { ...prev.reporter, kycStatus: result.kycStatus } } : prev
      );
      setSubmitMessage('KYC documents submitted successfully!');
      setAadharMasked('');
      setPanMasked('');
      setWorkProofUrl('');
    } catch (e: any) {
      setSubmitMessage(e?.message || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, reporterId, aadharMasked, panMasked, workProofUrl]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <KycSkeleton scheme={scheme} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.errorCenter}>
          <View style={[styles.errorIcon, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          </View>
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 12 }}>
            {error}
          </ThemedText>
          <Pressable
            onPress={() => loadData()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: primary }, pressed && { opacity: 0.9 }]}
          >
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Try Again</ThemedText>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[kycMeta.color, alphaBg(kycMeta.color, 0.8, kycMeta.color)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <MaterialIcons name={kycMeta.icon} size={48} color="rgba(255,255,255,0.95)" />
            </View>
            <ThemedText type="title" style={styles.headerTitle}>
              KYC Verification
            </ThemedText>
            <View style={styles.statusBadge}>
              <ThemedText style={styles.statusBadgeText}>{kycMeta.label}</ThemedText>
            </View>
            <ThemedText style={styles.headerDesc}>{kycMeta.desc}</ThemedText>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* ── Status Card ── */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: alphaBg(kycMeta.color, 0.12, c.background) }]}>
                <MaterialIcons name={kycMeta.icon} size={24} color={kycMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                  Verification Status
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>{kycMeta.desc}</ThemedText>
              </View>
            </View>

            {kycStatus === 'APPROVED' && (
              <View style={[styles.successBanner, { backgroundColor: alphaBg('#10b981', 0.1, c.background) }]}>
                <MaterialIcons name="check-circle" size={20} color="#10b981" />
                <ThemedText style={{ color: '#10b981', flex: 1, marginLeft: 8 }}>
                  Your documents have been verified. You can now receive your ID card.
                </ThemedText>
              </View>
            )}

            {kycStatus === 'SUBMITTED' && (
              <View style={[styles.infoBanner, { backgroundColor: alphaBg('#f59e0b', 0.1, c.background) }]}>
                <MaterialIcons name="pending" size={20} color="#f59e0b" />
                <ThemedText style={{ color: '#f59e0b', flex: 1, marginLeft: 8 }}>
                  Your documents are being reviewed. This usually takes 1-2 business days.
                </ThemedText>
              </View>
            )}

            {kycStatus === 'REJECTED' && (
              <View style={[styles.errorBanner, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
                <MaterialIcons name="error" size={20} color="#ef4444" />
                <ThemedText style={{ color: '#ef4444', flex: 1, marginLeft: 8 }}>
                  Your documents were rejected. Please submit valid documents again.
                </ThemedText>
              </View>
            )}
          </View>

          {/* ── Submit KYC Form ── */}
          {canSubmit && (
            <>
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: c.text }]}>
                Submit Documents
              </ThemedText>

              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                {/* Aadhar */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <MaterialIcons name="credit-card" size={18} color="#6366f1" />
                    <ThemedText style={{ color: c.text, marginLeft: 8, fontWeight: '500' }}>
                      Aadhar Number (Masked)
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.text }]}
                    placeholder="XXXX-XXXX-1234"
                    placeholderTextColor={c.muted}
                    value={aadharMasked}
                    onChangeText={setAadharMasked}
                    keyboardType="default"
                    autoCapitalize="characters"
                  />
                  <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                    Enter last 4 digits visible format: XXXX-XXXX-1234
                  </ThemedText>
                </View>

                {/* PAN */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <MaterialIcons name="badge" size={18} color="#f59e0b" />
                    <ThemedText style={{ color: c.text, marginLeft: 8, fontWeight: '500' }}>
                      PAN Number (Masked)
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.text }]}
                    placeholder="XXXXX1234X"
                    placeholderTextColor={c.muted}
                    value={panMasked}
                    onChangeText={setPanMasked}
                    keyboardType="default"
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                  <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                    Format: XXXXX1234X (last 5 characters visible)
                  </ThemedText>
                </View>

                {/* Work Proof URL */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <MaterialIcons name="attachment" size={18} color="#10b981" />
                    <ThemedText style={{ color: c.text, marginLeft: 8, fontWeight: '500' }}>
                      Work Proof URL
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.text }]}
                    placeholder="https://example.com/work-proof.pdf"
                    placeholderTextColor={c.muted}
                    value={workProofUrl}
                    onChangeText={setWorkProofUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                    Upload your work proof document and paste the URL here
                  </ThemedText>
                </View>

                {/* Submit Button */}
                <Pressable
                  onPress={onSubmitKyc}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: primary },
                    pressed && { opacity: 0.9 },
                    submitting && { opacity: 0.7 },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color="#fff" />
                      <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
                        Submit KYC Documents
                      </ThemedText>
                    </>
                  )}
                </Pressable>

                {submitMessage && (
                  <View style={[styles.messageBanner, { backgroundColor: alphaBg(submitMessage.includes('success') ? '#10b981' : '#ef4444', 0.1, c.background) }]}>
                    <MaterialIcons
                      name={submitMessage.includes('success') ? 'check-circle' : 'error'}
                      size={18}
                      color={submitMessage.includes('success') ? '#10b981' : '#ef4444'}
                    />
                    <ThemedText style={{ color: submitMessage.includes('success') ? '#10b981' : '#ef4444', flex: 1, marginLeft: 8 }}>
                      {submitMessage}
                    </ThemedText>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Requirements Info ── */}
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: c.text }]}>
            Requirements
          </ThemedText>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <RequirementRow
              icon="credit-card"
              title="Aadhar Card"
              desc="Valid Aadhar card with masked number"
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <RequirementRow
              icon="badge"
              title="PAN Card"
              desc="Valid PAN card with masked number"
              c={c}
            />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <RequirementRow
              icon="work"
              title="Work Proof"
              desc="Press ID, joining letter, or other work document"
              c={c}
            />
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Sub-Components  ───────────────────────────── */

function RequirementRow({
  icon,
  title,
  desc,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  desc: string;
  c: typeof Colors.light;
}) {
  return (
    <View style={styles.requirementRow}>
      <View style={[styles.requirementIcon, { backgroundColor: alphaBg('#6366f1', 0.12, c.background) }]}>
        <MaterialIcons name={icon} size={20} color="#6366f1" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>{title}</ThemedText>
        <ThemedText style={{ color: c.muted, fontSize: 12 }}>{desc}</ThemedText>
      </View>
      <MaterialIcons name="check-circle-outline" size={20} color={c.muted} />
    </View>
  );
}

function KycSkeleton({ scheme, onBack }: { scheme: 'light' | 'dark'; onBack: () => void }) {
  const c = Colors[scheme];
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={[styles.header, { backgroundColor: c.muted }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <Skeleton width={64} height={64} borderRadius={32} style={{ marginBottom: 12 }} />
          <Skeleton width={180} height={24} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width={120} height={20} borderRadius={4} />
        </View>
      </View>
      <View style={[styles.content, { paddingTop: 20 }]}>
        <Skeleton width="100%" height={120} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={300} borderRadius={12} />
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingTop: 48, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerContent: { alignItems: 'center', marginTop: 24 },
  headerIcon: { marginBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 24, textAlign: 'center' },
  headerDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 8 },
  statusBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 12, marginTop: 8 },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  successBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, margin: 12, marginTop: 0, borderRadius: 8 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, margin: 12, marginTop: 0, borderRadius: 8 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, margin: 12, marginTop: 0, borderRadius: 8 },
  messageBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 12, borderRadius: 8 },

  inputGroup: { padding: 16, paddingBottom: 8 },
  inputLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 16,
    gap: 8,
  },

  requirementRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  requirementIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 16 },

  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
});
