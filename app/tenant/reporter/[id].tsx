/**
 * Simplified Reporter Details Screen
 * Telugu UI - Easy toggle cards for all settings
 *
 * Quick Actions:
 * - Subscription ON/OFF (with pricing bottom sheet)
 * - Manual Login ON/OFF (mutually exclusive with subscription)
 * - Auto Publish ON/OFF
 * - KYC Approval
 * - ID Card Generate + WhatsApp Send
 * - Profile Photo Upload
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { uploadProfilePhoto } from '@/services/media';
import {
  generateReporterIdCard,
  getReporterIdCard,
  getTenantReporter,
  regenerateReporterIdCard,
  resendIdCardToWhatsApp,
  updateReporterAutoPublish,
  updateReporterProfilePhoto,
  updateTenantReporter,
  verifyReporterKyc,
  type ReporterIdCard,
  type TenantReporter,
} from '@/services/reporters';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────────────────────  Constants  ───────────────────────────── */

const PRIMARY_COLOR = '#DC2626';
const SUCCESS_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const WHATSAPP_COLOR = '#25D366';
const INFO_COLOR = '#6366F1';

/* ─────────────────────────────  Helpers  ───────────────────────────── */

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

const LEVEL_LABELS: Record<string, string> = {
  STATE: 'రాష్ట్ర స్థాయి',
  DISTRICT: 'జిల్లా స్థాయి',
  ASSEMBLY: 'నియోజకవర్గ స్థాయి',
  MANDAL: 'మండల స్థాయి',
};

const KYC_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: '✓ వెరిఫైడ్', color: SUCCESS_COLOR },
  SUBMITTED: { label: '⏳ సమీక్షలో', color: WARNING_COLOR },
  PENDING: { label: '⏳ పెండింగ్', color: WARNING_COLOR },
  REJECTED: { label: '✕ తిరస్కరించబడింది', color: '#EF4444' },
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function TenantReporterDetailsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  // Use muted for secondary text color
  const secondaryText = c.muted;
  const params = useLocalSearchParams();
  const reporterId = String(params?.id || '');

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporter, setReporter] = useState<TenantReporter | null>(null);
  const [idCard, setIdCard] = useState<ReporterIdCard | null>(null);

  // Action states
  const [updating, setUpdating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscription Modal State
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [idCardCharge, setIdCardCharge] = useState('');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  // Manual Login Days Modal
  const [showLoginDaysModal, setShowLoginDaysModal] = useState(false);
  const [loginDays, setLoginDays] = useState('365');

  // Photo Upload Prompt Modal
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [photoPromptShown, setPhotoPromptShown] = useState(false);

  /* ── Load session ── */
  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);
    })();
  }, []);

  /* ── Load reporter ── */
  const load = useCallback(
    async (isRefresh = false) => {
      if (!tenantId || !reporterId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const r = await getTenantReporter(tenantId, reporterId);
        setReporter(r);

        // Load ID card
        try {
          const card = await getReporterIdCard(tenantId, reporterId);
          setIdCard(card?.cardNumber ? card : null);
        } catch {
          setIdCard(null);
        }

        // Show photo upload prompt if no photo (only once)
        if (!r.profilePhotoUrl && !photoPromptShown) {
          setPhotoPromptShown(true);
          setTimeout(() => setShowPhotoPrompt(true), 500);
        }
      } catch (e: any) {
        setError(e?.message || 'లోడ్ కాలేదు');
        setReporter(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tenantId, reporterId]
  );

  useEffect(() => {
    if (tenantId && reporterId) load();
  }, [tenantId, reporterId, load]);

  /* ── Show message temporarily ── */
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  /* ── Upload Profile Photo ── */
  const handleUploadPhoto = useCallback(async () => {
    if (!tenantId || !reporter) return;

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('అనుమతి అవసరం', 'ఫోటో అప్‌లోడ్ చేయడానికి గ్యాలరీ యాక్సెస్ అవసరం');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUpdating('photo');
      const asset = result.assets[0];

      // Upload to server
      const { publicUrl } = await uploadProfilePhoto({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        filename: `reporter_${reporter.id}.jpg`,
      });

      // Update reporter profile photo URL
      await updateReporterProfilePhoto(tenantId, reporter.id, publicUrl);
      setReporter((prev) => (prev ? { ...prev, profilePhotoUrl: publicUrl } : prev));
      showMessage('success', 'ఫోటో అప్‌లోడ్ అయింది ✓');
    } catch (e: any) {
      showMessage('error', e?.message || 'ఫోటో అప్‌లోడ్ కాలేదు');
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, showMessage]);

  /* ── Toggle Subscription ── */
  const handleSubscriptionToggle = useCallback(
    (enabled: boolean) => {
      if (!tenantId || !reporter) return;

      if (enabled) {
        // Show modal to get subscription amounts
        setMonthlyAmount(String(reporter.monthlySubscriptionAmount || '500'));
        setIdCardCharge(String(reporter.idCardCharge || '500'));
        setSubscriptionStartDate(null); // Reset to immediate activation
        setShowSubscriptionModal(true);
      } else {
        // Turn off subscription, enable manual login
        Alert.alert(
          'Subscription OFF చేయాలా?',
          'Subscription OFF చేస్తే Manual Login ON అవుతుంది (365 రోజులు)',
          [
            { text: 'రద్దు', style: 'cancel' },
            {
              text: 'OFF చేయండి',
              onPress: async () => {
                setUpdating('subscription');
                try {
                  const updated = await updateTenantReporter(tenantId, reporter.id, {
                    subscriptionActive: false,
                    manualLoginEnabled: true,
                    manualLoginDays: 365,
                  });
                  setReporter((prev) => (prev ? { ...prev, ...updated } : prev));
                  showMessage('success', 'Subscription OFF, 365 రోజులు ఫ్రీ యాక్సెస్ ✓');
                } catch (e: any) {
                  showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
                } finally {
                  setUpdating(null);
                }
              },
            },
          ]
        );
      }
    },
    [tenantId, reporter, showMessage]
  );

  /* ── Confirm Subscription with Amounts ── */
  const confirmSubscription = useCallback(async () => {
    if (!tenantId || !reporter) return;
    
    const amount = Number(monthlyAmount) || 0;
    const cardCharge = Number(idCardCharge) || 0;

    if (amount < 1) {
      Alert.alert('Invalid Amount', 'Monthly amount కనీసం ₹1 ఉండాలి');
      return;
    }

    // Validate start date if provided
    if (subscriptionStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(subscriptionStartDate);
      startDate.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        Alert.alert('Invalid Date', 'Start date గతంలో ఉండకూడదు');
        return;
      }
    }

    setShowSubscriptionModal(false);
    setUpdating('subscription');
    try {
      const body: any = {
        subscriptionActive: true,
        manualLoginEnabled: false,
        monthlySubscriptionAmount: amount,
        idCardCharge: cardCharge, // 0 is valid
      };
      
      // Add start date if specified (for scheduled activation)
      if (subscriptionStartDate) {
        body.subscriptionStartDate = subscriptionStartDate.toISOString();
      }
      
      const updated = await updateTenantReporter(tenantId, reporter.id, body);
      setReporter((prev) => (prev ? { ...prev, ...updated } : prev));
      
      const dateStr = subscriptionStartDate 
        ? ` (${subscriptionStartDate.toLocaleDateString('te-IN')} నుండి)`
        : '';
      showMessage('success', `Subscription ON ✓${dateStr} (₹${amount}/నెల)`);
    } catch (e: any) {
      showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, monthlyAmount, idCardCharge, subscriptionStartDate, showMessage]);

  /* ── Toggle Manual Login ── */
  const handleManualLoginToggle = useCallback(
    (enabled: boolean) => {
      if (!tenantId || !reporter) return;

      if (enabled) {
        // Show days input modal
        setLoginDays('365');
        setShowLoginDaysModal(true);
      } else {
        // Turn off manual login
        Alert.alert(
          'Login Access OFF చేయాలా?',
          'రిపోర్టర్ యాప్ లోకి లాగిన్ అవ్వలేరు',
          [
            { text: 'రద్దు', style: 'cancel' },
            {
              text: 'OFF చేయండి',
              onPress: async () => {
                setUpdating('manualLogin');
                try {
                  const updated = await updateTenantReporter(tenantId, reporter.id, {
                    manualLoginEnabled: false,
                  });
                  setReporter((prev) => (prev ? { ...prev, ...updated } : prev));
                  showMessage('success', 'Login OFF ✓');
                } catch (e: any) {
                  showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
                } finally {
                  setUpdating(null);
                }
              },
            },
          ]
        );
      }
    },
    [tenantId, reporter, showMessage]
  );

  /* ── Confirm Manual Login with Days ── */
  const confirmManualLogin = useCallback(async () => {
    if (!tenantId || !reporter) return;
    
    const days = Number(loginDays) || 0;
    if (days < 1 || days > 365) {
      Alert.alert('Invalid Days', 'రోజులు 1-365 మధ్య ఉండాలి');
      return;
    }

    setShowLoginDaysModal(false);
    setUpdating('manualLogin');
    try {
      const updated = await updateTenantReporter(tenantId, reporter.id, {
        manualLoginEnabled: true,
        manualLoginDays: days,
        subscriptionActive: false, // Turn off subscription when enabling manual login
      });
      setReporter((prev) => (prev ? { ...prev, ...updated } : prev));
      showMessage('success', `Login ON ✓ (${days} రోజులు)`);
    } catch (e: any) {
      showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, loginDays, showMessage]);

  /* ── Toggle Auto Publish ── */
  const toggleAutoPublish = useCallback(
    async (enabled: boolean) => {
      if (!tenantId || !reporter) return;
      setUpdating('autoPublish');
      try {
        await updateReporterAutoPublish(tenantId, reporter.id, enabled);
        setReporter((prev) => (prev ? { ...prev, autoPublish: enabled } : prev));
        showMessage('success', enabled ? 'Auto Publish ON ✓' : 'Auto Publish OFF ✓');
      } catch (e: any) {
        showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
      } finally {
        setUpdating(null);
      }
    },
    [tenantId, reporter, showMessage]
  );

  /* ── Approve KYC ── */
  const approveKyc = useCallback(async () => {
    if (!tenantId || !reporter) return;
    setUpdating('kyc');
    try {
      const res = await verifyReporterKyc(tenantId, reporter.id, {
        status: 'APPROVED',
        verifiedAadhar: true,
        verifiedPan: true,
        verifiedWorkProof: true,
      });
      setReporter((prev) => (prev ? { ...prev, kycStatus: res.kycStatus } : prev));
      showMessage('success', 'KYC అప్రూవ్ అయింది ✓');
    } catch (e: any) {
      showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, showMessage]);

  /* ── Reject KYC ── */
  const rejectKyc = useCallback(async () => {
    if (!tenantId || !reporter) return;
    Alert.alert(
      'KYC రిజెక్ట్ చేయాలా?',
      'మీరు KYC తిరస్కరించాలనుకుంటున్నారా?',
      [
        { text: 'రద్దు', style: 'cancel' },
        {
          text: 'రిజెక్ట్ చేయండి',
          style: 'destructive',
          onPress: async () => {
            setUpdating('kyc');
            try {
              const res = await verifyReporterKyc(tenantId, reporter.id, {
                status: 'REJECTED',
                notes: 'Rejected by admin',
              });
              setReporter((prev) => (prev ? { ...prev, kycStatus: res.kycStatus } : prev));
              showMessage('success', 'KYC రిజెక్ట్ అయింది');
            } catch (e: any) {
              showMessage('error', e?.message || 'అప్డేట్ కాలేదు');
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  }, [tenantId, reporter, showMessage]);

  /* ── Generate ID Card ── */
  const handleGenerateIdCard = useCallback(async () => {
    if (!tenantId || !reporter) return;

    // Validation checks
    if (!reporter.profilePhotoUrl) {
      Alert.alert('⚠️ ఫోటో అవసరం', 'ID కార్డ్ కోసం ముందుగా ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయాలి.');
      return;
    }

    setUpdating('idCard');
    try {
      await generateReporterIdCard(tenantId, reporter.id);

      // Wait and retry to get the card
      await new Promise((r) => setTimeout(r, 1000));
      const card = await getReporterIdCard(tenantId, reporter.id);
      if (card?.cardNumber) {
        setIdCard(card);
        showMessage('success', 'ID కార్డ్ జెనరేట్ అయింది ✓');
      } else {
        showMessage('success', 'ID కార్డ్ రూపొందించబడుతోంది...');
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('photo')) {
        Alert.alert('⚠️ ఫోటో అవసరం', 'ముందుగా ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయండి.');
      } else if (String(e?.message || '').includes('payment') || String(e?.message || '').includes('subscription')) {
        Alert.alert('⚠️ పేమెంట్ అవసరం', 'Subscription లేదా Onboarding పేమెంట్ పూర్తి కావాలి.');
      } else {
        showMessage('error', e?.message || 'జెనరేట్ కాలేదు');
      }
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, showMessage]);

  /* ── Regenerate ID Card (full regenerate) ── */
  const handleRegenerateIdCard = useCallback(async () => {
    if (!tenantId || !reporter) return;

    if (!reporter.profilePhotoUrl) {
      Alert.alert('⚠️ ఫోటో అవసరం', 'ID కార్డ్ కోసం ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయాలి.');
      return;
    }

    Alert.alert(
      '🔄 ID కార్డ్ రీజెనరేట్',
      'ID కార్డ్‌ను పూర్తిగా రీజెనరేట్ చేయాలా?',
      [
        { text: 'వద్దు', style: 'cancel' },
        {
          text: 'అవును',
          onPress: async () => {
            setUpdating('idCard');
            try {
              await regenerateReporterIdCard(tenantId, reporter.id);
              
              // Fetch updated card details
              await new Promise((r) => setTimeout(r, 1000));
              const card = await getReporterIdCard(tenantId, reporter.id);
              if (card?.cardNumber) {
                setIdCard(card);
                showMessage('success', 'ID కార్డ్ రీజెనరేట్ అయింది ✓');
              }
            } catch (e: any) {
              showMessage('error', e?.message || 'రీజెనరేట్ కాలేదు');
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  }, [tenantId, reporter, showMessage]);

  /* ── Send ID Card to WhatsApp ── */
  const handleSendWhatsApp = useCallback(async () => {
    if (!tenantId || !reporter) {
      console.log('[WhatsApp] Missing data:', { tenantId, reporterId: reporter?.id });
      return;
    }
    if (!idCard?.cardNumber) {
      Alert.alert('⚠️', 'ముందుగా ID కార్డ్ జెనరేట్ చేయండి.');
      return;
    }

    console.log('[WhatsApp] Sending ID card:', { tenantId, reporterId: reporter.id, cardNumber: idCard.cardNumber });
    setUpdating('whatsapp');
    try {
      // Backend automatically regenerates PDF if missing, just call resend
      const result = await resendIdCardToWhatsApp(tenantId, reporter.id);
      console.log('[WhatsApp] Success:', result);
      showMessage('success', 'WhatsApp కు పంపబడింది ✓');
    } catch (e: any) {
      console.error('[WhatsApp] Error:', { status: e?.status, message: e?.message, body: e?.body });
      if (e?.body?.error?.includes('not found')) {
        showMessage('error', 'ID కార్డ్ కనిపించలేదు. మళ్ళీ జెనరేట్ చేయండి.');
      } else if (e?.body?.error?.includes('Mobile')) {
        showMessage('error', 'మొబైల్ నంబర్ అవసరం.');
      } else {
        showMessage('error', e?.message || 'పంపలేకపోయాము');
      }
    } finally {
      setUpdating(null);
    }
  }, [tenantId, reporter, idCard, showMessage]);

  /* ── Download ID Card PDF ── */
  const handleDownloadPdf = useCallback(async () => {
    if (!reporter?.id) return;
    setDownloading(true);

    try {
      const t = await loadTokens();
      const jwt = t?.jwt;
      if (!jwt) throw new Error('దయచేసి మళ్ళీ లాగిన్ చేయండి');

      const base = getBaseUrl().replace(/\/$/, '');
      const url = `${base}/id-cards/pdf?reporterId=${encodeURIComponent(reporter.id)}`;
      const cacheRoot = (LegacyFileSystem as any).cacheDirectory as string | null;
      if (!cacheRoot) throw new Error('Storage అందుబాటులో లేదు');

      const cacheDir = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
      const target = `${cacheDir}id-card-${reporter.id}.pdf`;

      console.log('[PDF Download] Starting download:', url);
      const result = await LegacyFileSystem.downloadAsync(url, target, {
        headers: { Accept: 'application/pdf', Authorization: `Bearer ${jwt}` },
      });

      if ((result as any)?.status && Number((result as any).status) !== 200) {
        throw new Error(`డౌన్‌లోడ్ విఫలమైంది (HTTP ${(result as any).status})`);
      }

      const info = await LegacyFileSystem.getInfoAsync(result.uri).catch(() => null as any);
      if (!info?.exists) throw new Error('PDF ఫైల్ కనుగొనబడలేదు');

      // Copy to documents
      const docRoot = (LegacyFileSystem as any).documentDirectory as string | null;
      if (!docRoot) throw new Error('డాక్యుమెంట్ డైరెక్టరీ లేదు');
      const downloadsDir = docRoot + 'downloads/';
      const downDirInfo = await LegacyFileSystem.getInfoAsync(downloadsDir).catch(() => ({ exists: false } as any));
      if (!downDirInfo?.exists) {
        await LegacyFileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true }).catch(() => {});
      }
      const persisted = `${downloadsDir}id-card-${reporter.id}.pdf`;
      await LegacyFileSystem.copyAsync({ from: result.uri, to: persisted });

      // Android: Save to Downloads folder
      if (Platform.OS === 'android' && (FileSystem as any)?.StorageAccessFramework) {
        const SAF = (FileSystem as any).StorageAccessFramework;
        const DIR_KEY = 'saf_downloads_dir_uri';
        let directoryUri = await AsyncStorage.getItem(DIR_KEY);
        if (!directoryUri) {
          const perm = await SAF.requestDirectoryPermissionsAsync();
          if (!perm?.granted) throw new Error('అనుమతి నిరాకరించబడింది');
          await AsyncStorage.setItem(DIR_KEY, String(perm.directoryUri || ''));
          directoryUri = perm.directoryUri;
        }
        if (directoryUri) {
          const filename = `id-card-${idCard?.cardNumber || reporter.id}.pdf`;
          const base64 = await LegacyFileSystem.readAsStringAsync(persisted, {
            encoding: (LegacyFileSystem as any).EncodingType.Base64,
          });
          const destUri = await SAF.createFileAsync(directoryUri, filename, 'application/pdf');
          await FileSystem.writeAsStringAsync(destUri, base64, {
            encoding: (FileSystem as any).EncodingType.Base64,
          });
          showMessage('success', '✅ Downloads లో సేవ్ అయింది');
        }
        // Also offer to share
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(persisted, { mimeType: 'application/pdf', dialogTitle: 'ID Card PDF' } as any);
        }
        return;
      }

      // iOS: Share
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(persisted, { mimeType: 'application/pdf', dialogTitle: 'ID Card PDF' } as any);
        showMessage('success', '✅ PDF సిద్ధంగా ఉంది');
      }
    } catch (e: any) {
      console.error('[PDF Download] Failed:', e);
      showMessage('error', e?.message || 'డౌన్‌లోడ్ విఫలమైంది');
    } finally {
      setDownloading(false);
    }
  }, [reporter?.id, idCard?.cardNumber, showMessage]);

  /* ── Computed Values ── */
  const kycStatus = String(reporter?.kycStatus || '').toUpperCase() as keyof typeof KYC_LABELS;
  const kycInfo = KYC_LABELS[kycStatus] || KYC_LABELS.PENDING;
  const levelLabel = LEVEL_LABELS[String(reporter?.level || '').toUpperCase()] || '';
  const location = reporter ? locationNameForReporter(reporter) : '—';

  const hasPhoto = !!reporter?.profilePhotoUrl;
  const hasIdCard = !!idCard?.cardNumber;
  const isKycApproved = kycStatus === 'APPROVED';
  const subscriptionActive = reporter?.subscriptionActive === true;
  const manualLoginEnabled = reporter?.manualLoginEnabled === true;
  const autoPublish = reporter?.autoPublish === true;
  
  // Check if subscription is scheduled for future
  const activationDate = reporter?.subscriptionActivationDate ? new Date(reporter.subscriptionActivationDate) : null;
  const isScheduled = activationDate && activationDate > new Date() && !subscriptionActive;
  
  // Payment due check - subscription active but current month payment not paid
  const currentMonthPaymentStatus = reporter?.stats?.subscriptionPayment?.currentMonth?.status;
  const paymentDue = subscriptionActive && currentMonthPaymentStatus !== 'PAID' && currentMonthPaymentStatus !== null;

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { color: c.text }]}>లోడ్ అవుతోంది...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !reporter) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <MaterialIcons name="error-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error || 'రిపోర్టర్ కనుగొనబడలేదు'}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>మళ్ళీ ప్రయత్నించండి</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: PRIMARY_COLOR }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerInfo}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {hasPhoto ? (
              <Image source={{ uri: reporter.profilePhotoUrl! }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#fff' }]}>
                <Text style={[styles.avatarInitials, { color: PRIMARY_COLOR }]}>{initials(reporter.fullName)}</Text>
              </View>
            )}
            {/* Photo Upload Button - Always visible for admin */}
            <Pressable
              style={styles.photoUploadBadge}
              onPress={handleUploadPhoto}
              disabled={updating === 'photo'}
            >
              {updating === 'photo' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name={hasPhoto ? 'edit' : 'add-a-photo'} size={14} color="#fff" />
              )}
            </Pressable>
          </View>

          {/* Name & Info */}
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {reporter.fullName || 'Unknown'}
            </Text>
            <Text style={styles.headerDesig} numberOfLines={1}>
              {reporter.designation?.name || '—'} • {location}
            </Text>
            <Text style={styles.headerLevel}>{levelLabel}</Text>
          </View>
        </View>
      </View>

      {/* Message Toast */}
      {message && (
        <View
          style={[
            styles.toast,
            { backgroundColor: message.type === 'success' ? SUCCESS_COLOR : '#EF4444' },
          ]}
        >
          <Ionicons
            name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color="#fff"
          />
          <Text style={styles.toastText}>{message.text}</Text>
        </View>
      )}

      {/* Subscription Amount Modal */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable style={styles.modalDismiss} onPress={() => setShowSubscriptionModal(false)} />
          <Pressable style={[styles.modalContent, { backgroundColor: c.background }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>💳 Subscription సెట్టింగ్స్</Text>
                <Pressable onPress={() => setShowSubscriptionModal(false)}>
                  <Ionicons name="close" size={24} color={c.text} />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: c.text }]}>నెలవారీ చార్జ్ (₹) *</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                    placeholder="500"
                    placeholderTextColor={secondaryText}
                    value={monthlyAmount}
                    onChangeText={setMonthlyAmount}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: c.text }]}>ID కార్డ్ చార్జ్ (₹) (0 కావచ్చు)</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                    placeholder="0"
                    placeholderTextColor={secondaryText}
                    value={idCardCharge}
                    onChangeText={setIdCardCharge}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>

                {/* Start Date (Optional) */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: c.text }]}>📅 స్టార్ట్ తేదీ (ఐచ్ఛికం)</Text>
                  <Pressable
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card, justifyContent: 'center' }]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={{ color: subscriptionStartDate ? c.text : secondaryText }}>
                      {subscriptionStartDate 
                        ? subscriptionStartDate.toLocaleDateString('te-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'ఇప్పుడే ప్రారంభించు'}
                    </Text>
                  </Pressable>
                  {subscriptionStartDate && (
                    <Pressable
                      style={{ marginTop: 4, alignSelf: 'flex-start' }}
                      onPress={() => setSubscriptionStartDate(null)}
                    >
                      <Text style={{ color: PRIMARY_COLOR, fontSize: 13 }}>✕ Clear (ఇప్పుడే ప్రారంభించు)</Text>
                    </Pressable>
                  )}
                </View>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={subscriptionStartDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setSubscriptionStartDate(selectedDate);
                      }
                    }}
                  />
                )}

                <View style={[styles.infoBox, { backgroundColor: INFO_COLOR + '15' }]}>
                  <Ionicons name="information-circle" size={18} color={INFO_COLOR} />
                  <Text style={[styles.infoText, { color: INFO_COLOR }]}>
                    Subscription ON చేస్తే Manual Login OFF అవుతుంది
                  </Text>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#E5E7EB' }]}
                onPress={() => setShowSubscriptionModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: '#374151' }]}>రద్దు</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: SUCCESS_COLOR }]}
                onPress={confirmSubscription}
              >
                <Text style={styles.modalBtnText}>ON చేయండి</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual Login Days Modal */}
      <Modal
        visible={showLoginDaysModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoginDaysModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable style={styles.modalDismiss} onPress={() => setShowLoginDaysModal(false)} />
          <Pressable style={[styles.modalContent, { backgroundColor: c.background }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>🔐 Login Access</Text>
                <Pressable onPress={() => setShowLoginDaysModal(false)}>
                  <Ionicons name="close" size={24} color={c.text} />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: c.text }]}>ఎన్ని రోజులు? (1-365) *</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                    placeholder="365"
                    placeholderTextColor={secondaryText}
                    value={loginDays}
                    onChangeText={setLoginDays}
                    keyboardType="number-pad"
                    maxLength={3}
                    returnKeyType="done"
                  />
                </View>

                {/* Quick select buttons */}
                <View style={styles.quickDays}>
                  {[30, 90, 180, 365].map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.quickDayBtn,
                        { backgroundColor: loginDays === String(d) ? INFO_COLOR : c.card, borderColor: c.border },
                      ]}
                      onPress={() => setLoginDays(String(d))}
                    >
                      <Text style={{ color: loginDays === String(d) ? '#fff' : c.text, fontWeight: '600' }}>
                        {d} రోజులు
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={[styles.infoBox, { backgroundColor: WARNING_COLOR + '15' }]}>
                  <Ionicons name="information-circle" size={18} color={WARNING_COLOR} />
                  <Text style={[styles.infoText, { color: WARNING_COLOR }]}>
                    Manual Login ON చేస్తే Subscription OFF అవుతుంది
                  </Text>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#E5E7EB' }]}
                  onPress={() => setShowLoginDaysModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: '#374151' }]}>రద్దు</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: INFO_COLOR }]}
                  onPress={confirmManualLogin}
                >
                  <Text style={styles.modalBtnText}>ON చేయండి</Text>
                </Pressable>
              </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Upload Prompt Modal */}
      <Modal
        visible={showPhotoPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowPhotoPrompt(false)} />
          <View style={[styles.modalContent, { backgroundColor: c.background, padding: 24 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[styles.actionIcon, { backgroundColor: WARNING_COLOR + '20', width: 60, height: 60, borderRadius: 30, marginBottom: 12 }]}>
                <MaterialIcons name="add-a-photo" size={30} color={WARNING_COLOR} />
              </View>
              <Text style={[styles.modalTitle, { color: c.text, textAlign: 'center' }]}>📸 ప్రొఫైల్ ఫోటో అవసరం</Text>
              <Text style={[styles.infoText, { color: secondaryText, textAlign: 'center', marginTop: 8 }]}>
                ID కార్డ్ జెనరేట్ చేయడానికి ముందుగా రిపోర్టర్ ఫోటో అప్‌లోడ్ చేయండి
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#E5E7EB' }]}
                onPress={() => setShowPhotoPrompt(false)}
              >
                <Text style={[styles.modalBtnText, { color: '#374151' }]}>తర్వాత</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: PRIMARY_COLOR }]}
                onPress={() => {
                  setShowPhotoPrompt(false);
                  handleUploadPhoto();
                }}
              >
                <MaterialIcons name="add-a-photo" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalBtnText}>ఫోటో అప్‌లోడ్</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY_COLOR]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Quick Actions Section ── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Quick Actions</Text>

        {/* Row 1: Subscription & Manual Login */}
        <View style={styles.actionRow}>
          {/* Subscription Toggle */}
          <View style={[styles.actionCard, { backgroundColor: c.card, borderColor: paymentDue ? '#DC2626' : c.border }]}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIcon, { backgroundColor: subscriptionActive ? (paymentDue ? '#DC262620' : SUCCESS_COLOR + '20') : isScheduled ? WARNING_COLOR + '20' : '#9CA3AF20' }]}>
                <MaterialCommunityIcons
                  name={subscriptionActive ? 'credit-card-check' : isScheduled ? 'calendar-clock' : 'credit-card-off'}
                  size={20}
                  color={subscriptionActive ? (paymentDue ? '#DC2626' : SUCCESS_COLOR) : isScheduled ? WARNING_COLOR : '#9CA3AF'}
                />
              </View>
              <View style={styles.actionCardInfo}>
                <Text style={[styles.actionCardTitle, { color: c.text }]}>Subscription</Text>
                <Text style={[styles.actionCardSubtitle, { color: subscriptionActive ? (paymentDue ? '#DC2626' : SUCCESS_COLOR) : isScheduled ? WARNING_COLOR : secondaryText }]}>
                  {subscriptionActive 
                    ? paymentDue 
                      ? `⚠️ పేమెంట్ పెండింగ్` 
                      : `₹${reporter.monthlySubscriptionAmount || 0}/నెల` 
                    : isScheduled && activationDate
                    ? `⏰ షెడ్యూల్డ్ (${activationDate.toLocaleDateString('te-IN', { day: '2-digit', month: 'short' })})`
                    : 'OFF'}
                </Text>
              </View>
            </View>
            {updating === 'subscription' ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <Switch
                value={subscriptionActive || isScheduled}
                onValueChange={handleSubscriptionToggle}
                disabled={isScheduled}
                trackColor={{ false: '#D1D5DB', true: isScheduled ? WARNING_COLOR + '60' : paymentDue ? '#DC262660' : SUCCESS_COLOR + '60' }}
                thumbColor={(subscriptionActive || isScheduled) ? (paymentDue ? '#DC2626' : isScheduled ? WARNING_COLOR : SUCCESS_COLOR) : '#f4f3f4'}
              />
            )}
          </View>

          {/* Manual Login Toggle */}
          <View style={[styles.actionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIcon, { backgroundColor: manualLoginEnabled ? INFO_COLOR + '20' : '#9CA3AF20' }]}>
                <MaterialIcons
                  name="login"
                  size={20}
                  color={manualLoginEnabled ? INFO_COLOR : '#9CA3AF'}
                />
              </View>
              <View style={styles.actionCardInfo}>
                <Text style={[styles.actionCardTitle, { color: c.text }]}>Login Access</Text>
                <Text style={[styles.actionCardSubtitle, { color: secondaryText }]}>
                  {subscriptionActive
                    ? 'Subscription ద్వారా'
                    : manualLoginEnabled
                    ? `${reporter.manualLoginDays || 365} రోజులు`
                    : 'OFF'}
                </Text>
              </View>
            </View>
            {updating === 'manualLogin' ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <Switch
                value={subscriptionActive ? true : manualLoginEnabled}
                onValueChange={(val) => {
                  if (subscriptionActive) {
                    Alert.alert('ℹ️', 'Subscription ON ఉంటే Login Access మాన్యువల్ గా మార్చలేరు. ముందుగా Subscription OFF చేయండి.');
                    return;
                  }
                  handleManualLoginToggle(val);
                }}
                trackColor={{ false: '#D1D5DB', true: INFO_COLOR + '60' }}
                thumbColor={subscriptionActive || manualLoginEnabled ? INFO_COLOR : '#f4f3f4'}
              />
            )}
          </View>
        </View>

        {/* Row 2: Auto Publish & KYC */}
        <View style={styles.actionRow}>
          {/* Auto Publish Toggle */}
          <View style={[styles.actionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIcon, { backgroundColor: autoPublish ? WARNING_COLOR + '20' : '#9CA3AF20' }]}>
                <MaterialIcons
                  name="publish"
                  size={20}
                  color={autoPublish ? WARNING_COLOR : '#9CA3AF'}
                />
              </View>
              <View style={styles.actionCardInfo}>
                <Text style={[styles.actionCardTitle, { color: c.text }]}>Auto Publish</Text>
                <Text style={[styles.actionCardSubtitle, { color: secondaryText }]}>
                  {autoPublish ? 'ఆటో పబ్లిష్' : 'అప్రూవల్ అవసరం'}
                </Text>
              </View>
            </View>
            {updating === 'autoPublish' ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <Switch
                value={autoPublish}
                onValueChange={toggleAutoPublish}
                trackColor={{ false: '#D1D5DB', true: WARNING_COLOR + '60' }}
                thumbColor={autoPublish ? WARNING_COLOR : '#f4f3f4'}
              />
            )}
          </View>

          {/* KYC Status */}
          <View style={[styles.actionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIcon, { backgroundColor: kycInfo.color + '20' }]}>
                <MaterialIcons 
                  name={isKycApproved ? 'verified-user' : 'pending'} 
                  size={20} 
                  color={kycInfo.color} 
                />
              </View>
              <View style={styles.actionCardInfo}>
                <Text style={[styles.actionCardTitle, { color: c.text }]}>KYC</Text>
                <Text style={[styles.actionCardSubtitle, { color: kycInfo.color }]}>{kycInfo.label}</Text>
              </View>
            </View>
            {updating === 'kyc' ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : isKycApproved ? (
              // Already approved - show reject button
              <Pressable style={[styles.miniBtn, { backgroundColor: '#EF444420' }]} onPress={rejectKyc}>
                <Text style={[styles.miniBtnText, { color: '#EF4444' }]}>✕</Text>
              </Pressable>
            ) : (
              // Pending/Submitted/Rejected - show approve button
              <Pressable style={[styles.miniBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={approveKyc}>
                <MaterialIcons name="check" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── ID Card Section ── */}
        <Text style={[styles.sectionTitle, { color: c.text, marginTop: 24 }]}>🎫 ID కార్డ్</Text>

        <View style={[styles.idCardSection, { backgroundColor: c.card, borderColor: c.border }]}>
          {hasIdCard ? (
            <>
              <View style={styles.idCardInfo}>
                <View style={[styles.idCardBadge, { backgroundColor: SUCCESS_COLOR + '20' }]}>
                  <MaterialCommunityIcons name="card-account-details" size={24} color={SUCCESS_COLOR} />
                </View>
                <View>
                  <Text style={[styles.idCardNumber, { color: c.text }]}>{idCard?.cardNumber}</Text>
                  <Text style={[styles.idCardStatus, { color: SUCCESS_COLOR }]}>✓ జెనరేట్ అయింది</Text>
                </View>
              </View>

              <View style={styles.idCardActions}>
                {/* Download PDF */}
                <Pressable
                  style={[styles.idCardBtn, { backgroundColor: PRIMARY_COLOR }]}
                  onPress={handleDownloadPdf}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                      <Text style={styles.idCardBtnText}>PDF</Text>
                    </>
                  )}
                </Pressable>

                {/* WhatsApp */}
                <Pressable
                  style={[styles.idCardBtn, { backgroundColor: WHATSAPP_COLOR }]}
                  onPress={handleSendWhatsApp}
                  disabled={updating === 'whatsapp'}
                >
                  {updating === 'whatsapp' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      <Text style={styles.idCardBtnText}>పంపండి</Text>
                    </>
                  )}
                </Pressable>

                {/* Regenerate */}
                <Pressable
                  style={[styles.idCardBtn, { backgroundColor: WARNING_COLOR }]}
                  onPress={handleRegenerateIdCard}
                  disabled={updating === 'idCard'}
                >
                  {updating === 'idCard' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="refresh" size={18} color="#fff" />
                      <Text style={styles.idCardBtnText}>రీజెనరేట్</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.noIdCard}>
                <MaterialCommunityIcons name="card-bulleted-off-outline" size={40} color="#9CA3AF" />
                <Text style={[styles.noIdCardText, { color: secondaryText }]}>ID కార్డ్ ఇంకా లేదు</Text>
                
                {/* Step indicators */}
                <View style={{ marginTop: 12, alignItems: 'flex-start', width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: hasPhoto ? SUCCESS_COLOR : WARNING_COLOR, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      {hasPhoto ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>1</Text>}
                    </View>
                    <Text style={{ color: hasPhoto ? SUCCESS_COLOR : WARNING_COLOR, fontSize: 13 }}>
                      {hasPhoto ? '✓ ఫోటో అప్‌లోడ్ అయింది' : 'ముందుగా ఫోటో అప్‌లోడ్ చేయండి'}
                    </Text>
                  </View>
                  
                  {subscriptionActive && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: !paymentDue ? SUCCESS_COLOR : '#DC2626', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                        {!paymentDue ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>2</Text>}
                      </View>
                      <Text style={{ color: !paymentDue ? SUCCESS_COLOR : '#DC2626', fontSize: 13 }}>
                        {!paymentDue ? '✓ పేమెంట్ పూర్తయింది' : 'రిపోర్టర్ పేమెంట్ చేయాలి'}
                      </Text>
                    </View>
                  )}
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{subscriptionActive ? '3' : '2'}</Text>
                    </View>
                    <Text style={{ color: '#9CA3AF', fontSize: 13 }}>ID కార్డ్ జెనరేట్ చేయండి</Text>
                  </View>
                </View>
              </View>

              {/* Photo upload button if no photo */}
              {!hasPhoto && (
                <Pressable
                  style={[styles.generateBtn, { backgroundColor: WARNING_COLOR, marginBottom: 8 }]}
                  onPress={handleUploadPhoto}
                  disabled={updating === 'photo'}
                >
                  {updating === 'photo' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="add-a-photo" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>ఫోటో అప్‌లోడ్ చేయండి</Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* ID Card generate button */}
              <Pressable
                style={[
                  styles.generateBtn,
                  { backgroundColor: (hasPhoto && !paymentDue) ? PRIMARY_COLOR : '#D1D5DB' },
                ]}
                onPress={handleGenerateIdCard}
                disabled={!hasPhoto || paymentDue || updating === 'idCard'}
              >
                {updating === 'idCard' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="card-account-details" size={20} color="#fff" />
                    <Text style={styles.generateBtnText}>
                      {!hasPhoto 
                        ? 'ముందుగా ఫోటో అవసరం' 
                        : paymentDue 
                          ? 'రిపోర్టర్ పేమెంట్ తర్వాత' 
                          : 'ID కార్డ్ జెనరేట్ చేయండి'}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* ── Reporter Details ── */}
        <Text style={[styles.sectionTitle, { color: c.text, marginTop: 24 }]}>📋 వివరాలు</Text>

        <View style={[styles.detailsCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: secondaryText }]}>📱 ఫోన్</Text>
            <Text style={[styles.detailValue, { color: c.text }]}>+91 {reporter.mobileNumber || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: secondaryText }]}>🏢 హోదా</Text>
            <Text style={[styles.detailValue, { color: c.text }]}>{reporter.designation?.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: secondaryText }]}>📍 ప్రాంతం</Text>
            <Text style={[styles.detailValue, { color: c.text }]}>{location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: secondaryText }]}>📸 ఫోటో</Text>
            <Text style={[styles.detailValue, { color: hasPhoto ? SUCCESS_COLOR : WARNING_COLOR }]}>
              {hasPhoto ? '✓ అప్‌లోడ్ అయింది' : '⚠️ లేదు'}
            </Text>
          </View>
          {subscriptionActive && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: secondaryText }]}>💰 నెలవారీ ఫీ</Text>
              <Text style={[styles.detailValue, { color: c.text }]}>
                ₹{reporter.monthlySubscriptionAmount || 0}
              </Text>
            </View>
          )}
        </View>

        {/* Help Box */}
        <View style={styles.helpBox}>
          <Ionicons name="information-circle" size={18} color={INFO_COLOR} />
          <Text style={styles.helpText}>
            Subscription ON → నెలవారీ చెల్లింపు అవసరం{'\n'}
            Subscription OFF → Manual Login ఆటోమేటిక్‌గా ON (365 రోజులు)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
  },
  noPhotoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WARNING_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerDesig: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginTop: 3,
  },
  headerLevel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
    fontWeight: '500',
  },

  // Toast
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 4,
    letterSpacing: -0.3,
  },

  // Action Cards
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  actionCardSubtitle: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ID Card Section
  idCardSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  idCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  idCardBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idCardNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  idCardStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  idCardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  idCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  idCardBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  noIdCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noIdCardText: {
    fontSize: 15,
    marginTop: 8,
  },
  noIdCardHint: {
    fontSize: 13,
    marginTop: 4,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Details Card
  detailsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Help Box
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  helpText: {
    color: '#4338CA',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  // Photo Upload Badge
  photoUploadBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  quickDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickDayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
