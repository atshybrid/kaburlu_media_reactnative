import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import {
    getMyProfile,
    submitReporterKyc,
    type MyProfileResponse,
} from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

// Telugu text for KYC status
const KYC_STATUS_META: Record<string, { label: string; labelTe: string; color: string; icon: keyof typeof MaterialIcons.glyphMap; desc: string; descTe: string }> = {
  APPROVED: { label: 'Verified', labelTe: '✅ వెరిఫై అయింది', color: '#10b981', icon: 'verified-user', desc: 'Your KYC documents have been verified', descTe: 'మీ KYC పూర్తయింది. ID కార్డ్ డౌన్‌లోడ్ చేసుకోండి!' },
  SUBMITTED: { label: 'Under Review', labelTe: '⏳ రివ్యూలో ఉంది', color: '#f59e0b', icon: 'pending', desc: 'Your documents are being reviewed', descTe: 'మీ డాక్యుమెంట్స్ చెక్ అవుతున్నాయి. 1-2 రోజుల్లో అప్‌డేట్ వస్తుంది.' },
  PENDING: { label: 'Pending', labelTe: '📝 సబ్మిట్ చేయండి', color: '#6366f1', icon: 'hourglass-empty', desc: 'Please submit your KYC documents', descTe: 'మీ ఆధార్ లేదా PAN నంబర్ ఇవ్వండి.' },
  REJECTED: { label: 'Rejected', labelTe: '❌ రిజెక్ట్ అయింది', color: '#ef4444', icon: 'cancel', desc: 'Your documents were rejected. Please resubmit', descTe: 'డాక్యుమెంట్స్ రిజెక్ట్ అయ్యాయి. మళ్ళీ సబ్మిట్ చేయండి.' },
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

  // Form fields - simplified to just Aadhar last 4 digits
  const [aadharLast4, setAadharLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
    setSubmitSuccess(false);

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
      setError(e?.message || 'లోడ్ కాలేదు');
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
      Alert.alert('Error', 'మళ్ళీ లాగిన్ అవ్వండి');
      return;
    }

    const last4 = aadharLast4.trim();
    if (!last4 || last4.length !== 4 || !/^\d{4}$/.test(last4)) {
      Alert.alert('ఆధార్ నంబర్', 'ఆధార్ చివరి 4 అంకెలు సరిగ్గా ఇవ్వండి');
      return;
    }

    setSubmitting(true);

    try {
      // Format as masked Aadhar: XXXX-XXXX-1234
      const maskedAadhar = `XXXX-XXXX-${last4}`;
      
      const result = await submitReporterKyc(tenantId, reporterId, {
        aadharNumberMasked: maskedAadhar,
      });

      setProfile((prev) =>
        prev ? { ...prev, reporter: { ...prev.reporter, kycStatus: result.kycStatus } } : prev
      );
      setSubmitSuccess(true);
      setAadharLast4('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'సబ్మిట్ కాలేదు. మళ్ళీ ట్రై చేయండి.');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, reporterId, aadharLast4]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={{ color: c.muted, marginTop: 12 }}>లోడ్ అవుతోంది...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={56} color="#ef4444" />
          <ThemedText style={{ color: c.text, marginTop: 12, fontSize: 16 }}>{error}</ThemedText>
          <Pressable
            onPress={() => loadData()}
            style={[styles.retryBtn, { backgroundColor: primary }]}
          >
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>మళ్ళీ ట్రై</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <ThemedText style={{ color: primary }}>వెనక్కి</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 18 }}>
          KYC వెరిఫికేషన్
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: kycMeta.color + '15', borderColor: kycMeta.color + '40' }]}>
          <MaterialIcons name={kycMeta.icon} size={40} color={kycMeta.color} />
          <ThemedText type="defaultSemiBold" style={{ color: kycMeta.color, fontSize: 18, marginTop: 12 }}>
            {kycMeta.labelTe}
          </ThemedText>
          <ThemedText style={{ color: c.muted, fontSize: 14, textAlign: 'center', marginTop: 6 }}>
            {kycMeta.descTe}
          </ThemedText>
        </View>

        {/* Success Message */}
        {submitSuccess && (
          <View style={[styles.successBanner, { backgroundColor: '#10b98120' }]}>
            <MaterialIcons name="check-circle" size={24} color="#10b981" />
            <ThemedText style={{ color: '#10b981', marginLeft: 8, flex: 1, fontSize: 15 }}>
              సబ్మిట్ అయింది! 1-2 రోజుల్లో అప్రూవల్ వస్తుంది.
            </ThemedText>
          </View>
        )}

        {/* Submit Form - Only show if PENDING or REJECTED */}
        {canSubmit && !submitSuccess && (
          <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16, marginBottom: 4 }}>
              ఆధార్ వెరిఫికేషన్
            </ThemedText>
            <ThemedText style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>
              మీ ఆధార్ కార్డ్ చివరి 4 అంకెలు ఇవ్వండి
            </ThemedText>

            <View style={styles.inputRow}>
              <View style={[styles.maskedPart, { backgroundColor: c.background, borderColor: c.border }]}>
                <ThemedText style={{ color: c.muted, fontSize: 18, letterSpacing: 2 }}>XXXX XXXX</ThemedText>
              </View>
              <TextInput
                style={[styles.last4Input, { backgroundColor: c.background, borderColor: primary, color: c.text }]}
                placeholder="1234"
                placeholderTextColor={c.muted}
                value={aadharLast4}
                onChangeText={(text) => setAadharLast4(text.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
              🔒 మీ ఫుల్ ఆధార్ నంబర్ మా దగ్గర స్టోర్ కాదు
            </ThemedText>

            <Pressable
              onPress={onSubmitKyc}
              disabled={submitting || aadharLast4.length !== 4}
              style={[
                styles.submitBtn,
                { backgroundColor: primary },
                (submitting || aadharLast4.length !== 4) && { opacity: 0.5 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  సబ్మిట్ KYC
                </ThemedText>
              )}
            </Pressable>
          </View>
        )}

        {/* ID Card Button - Only show if APPROVED */}
        {kycStatus === 'APPROVED' && (
          <Pressable
            onPress={() => router.push('/reporter/id-card')}
            style={[styles.idCardBtn, { backgroundColor: '#10b981' }]}
          >
            <MaterialIcons name="badge" size={24} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
              ID కార్డ్ డౌన్‌లోడ్
            </ThemedText>
          </Pressable>
        )}

        {/* Info Section */}
        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginBottom: 12 }}>
            ℹ️ KYC ఎందుకు?
          </ThemedText>
          <View style={styles.infoRow}>
            <MaterialIcons name="verified-user" size={18} color="#10b981" />
            <ThemedText style={{ color: c.muted, marginLeft: 8, flex: 1 }}>
              వెరిఫైడ్ రిపోర్టర్ బ్యాడ్జ్ పొందండి
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={18} color="#6366f1" />
            <ThemedText style={{ color: c.muted, marginLeft: 8, flex: 1 }}>
              ప్రెస్ ID కార్డ్ డౌన్‌లోడ్ చేసుకోండి
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="star" size={18} color="#f59e0b" />
            <ThemedText style={{ color: c.muted, marginLeft: 8, flex: 1 }}>
              మీ వార్తలకు ఎక్కువ ప్రాధాన్యత
            </ThemedText>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  content: { padding: 16 },
  
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  maskedPart: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  last4Input: {
    width: 80,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
  },
  
  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  
  idCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
});

