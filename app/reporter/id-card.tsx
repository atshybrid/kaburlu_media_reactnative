/**
 * Reporter ID Card - Official Backend-Generated Card
 * 
 * Displays the official ID card from tenant with:
 * - Card number, issue date, expiry date
 * - PDF download (same as tenant admin)
 * - HTML view in browser (same styling as PDF)
 * - Share options
 * 
 * If no ID card:
 * - No profile photo → prompt to upload photo first
 * - Has profile photo → Generate ID Card button
 */
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { generateMyIdCard, getReporterMe, regenerateMyIdCard, resendMyIdCardToWhatsApp, type ReporterMeResponse } from '@/services/reporters';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_PRIMARY = '#109edc';
const DEFAULT_SECONDARY = '#fa7c05';
const WHATSAPP_COLOR = '#25D366';

// Check if valid hex color
function isValidHexColor(color: any): boolean {
  if (!color || typeof color !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// Format date helper
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// Check if date is in the past
function isPast(dateStr: string): boolean {
  try {
    return new Date(dateStr) < new Date();
  } catch {
    return false;
  }
}

// Check if date is expiring within 30 days
function isExpiringSoon(dateStr: string): boolean {
  try {
    const expiry = new Date(dateStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  } catch {
    return false;
  }
}

type SessionData = {
  reporter?: {
    id?: string;
    designation?: { name?: string } | string;
    profilePhoto?: string;
  };
  tenant?: { id?: string; name?: string };
  user?: { name?: string; mobileNumber?: string };
};

export default function ReporterIdCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reporter, setReporter] = useState<ReporterMeResponse | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // Dynamic tenant colors
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);

  // ID Card from backend
  const idCard = reporter?.idCard ?? null;
  const hasIdCard = !!idCard;
  const hasProfilePhoto = !!reporter?.profilePhotoUrl;
  const isExpired = idCard ? isPast(idCard.expiresAt) : false;
  const expiringSoon = idCard ? isExpiringSoon(idCard.expiresAt) : false;
  const tenantId = reporter?.tenantId || (session?.tenant?.id as string);
  const reporterId = reporter?.id;
  
  // Payment due check - disable ID card generation if payment is required
  const paymentDue = reporter?.paymentStatus?.required === true;

  // Load reporter data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);

    try {
      // Load session for tenant info and branding colors
      const tokens = await loadTokens();
      const sess = (tokens as any)?.session as SessionData | undefined;
      if (sess) setSession(sess);

      // Extract tenant colors from domainSettings
      const domainSettings = (tokens as any)?.session?.domainSettings;
      const colors = domainSettings?.data?.theme?.colors;
      if (colors) {
        const pColor = colors.primary || colors.accent;
        const sColor = colors.secondary || colors.accent;
        if (isValidHexColor(pColor)) setPrimaryColor(pColor);
        if (isValidHexColor(sColor)) setSecondaryColor(sColor);
      }

      // Load reporter profile with ID card
      const data = await getReporterMe();
      setReporter(data);
    } catch (e: any) {
      console.error('[ID Card] Failed to load:', e);
      setMessage(e?.message || 'Failed to load ID card');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate ID Card
  const handleGenerateIdCard = useCallback(async () => {
    console.log('[ID Card] Generate request using /reporters/me/id-card');

    Alert.alert(
      'ID కార్డ్ జనరేట్',
      'మీ అధికారిక ప్రెస్ ID కార్డ్ జనరేట్ చేయాలా?',
      [
        { text: 'రద్దు', style: 'cancel' },
        {
          text: 'జనరేట్',
          onPress: async () => {
            setGenerating(true);
            setMessage(null);
            try {
              console.log('[ID Card] Calling /reporters/me/id-card API...');
              const result = await generateMyIdCard();
              console.log('[ID Card] Generated:', result);
              
              if (result.alreadyExists) {
                setMessage('ℹ️ ID కార్డ్ ఇప్పటికే ఉంది!');
              } else {
                setMessage('✅ ID కార్డ్ జనరేట్ అయింది! WhatsApp కి పంపబడింది.');
              }
              // Reload to get the new ID card
              await loadData(true);
            } catch (e: any) {
              console.error('[ID Card] Generate failed:', e);
              console.error('[ID Card] Error details:', { status: e?.status, message: e?.message, body: e?.body });
              const errMsg = e?.message || 'జనరేట్ విఫలమైంది';
              // Check for common error cases
              if (e?.status === 402) {
                setMessage('❌ పేమెంట్ పెండింగ్. ముందుగా పేమెంట్ చేయండి.');
              } else if (e?.status === 403) {
                setMessage('❌ అనుమతి లేదు. లాగిన్ మళ్ళీ ప్రయత్నించండి.');
              } else if (errMsg.includes('photo')) {
                setMessage('❌ ముందుగా ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయండి');
              } else if (errMsg.includes('payment') || errMsg.includes('paid')) {
                setMessage('❌ పేమెంట్ పెండింగ్. పబ్లిషర్‌ని సంప్రదించండి.');
              } else {
                setMessage(`❌ ${errMsg}`);
              }
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  }, [loadData]);

  // Send ID Card via WhatsApp
  const handleSendWhatsApp = useCallback(async () => {
    setSendingWhatsApp(true);
    setMessage(null);

    try {
      console.log('[ID Card] Resending via /reporters/me/id-card/resend...');
      const result = await resendMyIdCardToWhatsApp();
      console.log('[ID Card] WhatsApp sent:', result);
      if (result.success) {
        setMessage(`✅ WhatsApp కు పంపబడింది${result.sentTo ? ` (${result.sentTo})` : ''}`);
      } else {
        setMessage(`❌ ${result.message || 'పంపడం విఫలమైంది'}`);
      }
    } catch (e: any) {
      console.error('[ID Card] WhatsApp send failed:', e);
      if (e?.status === 404) {
        setMessage('❌ ముందుగా ID కార్డ్ జనరేట్ చేయండి');
      } else {
        setMessage(`❌ ${e?.message || 'WhatsApp పంపడం విఫలమైంది'}`);
      }
    } finally {
      setSendingWhatsApp(false);
    }
  }, []);

  // Regenerate ID Card (after photo update)
  const [regenerating, setRegenerating] = useState(false);
  
  const handleRegenerateIdCard = useCallback(async () => {
    Alert.alert(
      'ID కార్డ్ Regenerate',
      'ఫోటో లేదా వివరాలు మారినప్పుడు ID కార్డ్ regenerate చేయవచ్చు. Same card number ఉంచాలా?',
      [
        { text: 'రద్దు', style: 'cancel' },
        {
          text: 'Same Number',
          onPress: () => doRegenerate(true),
        },
        {
          text: 'New Number',
          onPress: () => doRegenerate(false),
          style: 'destructive',
        },
      ]
    );
  }, []);

  const doRegenerate = useCallback(async (keepCardNumber: boolean) => {
    setRegenerating(true);
    setMessage(null);
    try {
      console.log('[ID Card] Regenerating with keepCardNumber:', keepCardNumber);
      const result = await regenerateMyIdCard(keepCardNumber);
      console.log('[ID Card] Regenerated:', result);
      setMessage('✅ ID కార్డ్ regenerate అయింది! WhatsApp కి పంపబడింది.');
      // Reload to get the updated ID card
      await loadData(true);
    } catch (e: any) {
      console.error('[ID Card] Regenerate failed:', e);
      if (e?.status === 403) {
        setMessage('❌ ప్రొఫైల్ ఫోటో అవసరం');
      } else if (e?.status === 404) {
        setMessage('❌ ముందుగా ID కార్డ్ జనరేట్ చేయండి');
      } else {
        setMessage(`❌ ${e?.message || 'Regenerate విఫలమైంది'}`);
      }
    } finally {
      setRegenerating(false);
    }
  }, [loadData]);

  // Download PDF
  const handleDownloadPdf = useCallback(async () => {
    if (!reporter?.id) return;
    setDownloading(true);
    setMessage(null);

    try {
      const t = await loadTokens();
      const jwt = t?.jwt;
      if (!jwt) throw new Error('Please login again');

      const base = getBaseUrl().replace(/\/$/, '');
      const url = `${base}/id-cards/pdf?reporterId=${encodeURIComponent(reporter.id)}`;
      const cacheRoot = (LegacyFileSystem as any).cacheDirectory as string | null;
      if (!cacheRoot) throw new Error('Storage not available');

      const cacheDir = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
      const target = `${cacheDir}id-card-${reporter.id}.pdf`;

      const result = await LegacyFileSystem.downloadAsync(url, target, {
        headers: { Accept: 'application/pdf', Authorization: `Bearer ${jwt}` },
      });

      if ((result as any)?.status && Number((result as any).status) !== 200) {
        throw new Error(`Download failed (HTTP ${(result as any).status})`);
      }

      const info = await LegacyFileSystem.getInfoAsync(result.uri).catch(() => null as any);
      if (!info?.exists) throw new Error('PDF file not found');

      // Copy to documents
      const docRoot = (LegacyFileSystem as any).documentDirectory as string | null;
      if (!docRoot) throw new Error('Missing document directory');
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
          if (!perm?.granted) throw new Error('Permission denied');
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
          setMessage('✅ Saved to Downloads');
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
      }
      setMessage('✅ PDF ready');
    } catch (e: any) {
      console.error('[ID Card] Download failed:', e);
      setMessage(e?.message || 'Failed to download');
    } finally {
      setDownloading(false);
    }
  }, [reporter?.id, idCard?.cardNumber]);

  // View HTML in browser
  const handleViewHtml = useCallback(async () => {
    if (!reporter?.id) return;
    try {
      const base = getBaseUrl().replace(/\/$/, '');
      const url = `${base}/id-cards/html?reporterId=${encodeURIComponent(reporter.id)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        setMessage('Unable to open browser');
      }
    } catch (e: any) {
      setMessage(e?.message || 'Failed to open');
    }
  }, [reporter?.id]);

  // Share ID Card
  const handleShare = useCallback(async () => {
    if (!reporter?.id) return;
    const base = getBaseUrl().replace(/\/$/, '');
    const htmlUrl = `${base}/id-cards/html?reporterId=${encodeURIComponent(reporter.id)}`;

    Alert.alert(
      'Share ID Card',
      'Choose how to share your ID card',
      [
        {
          text: 'Share Link',
          onPress: async () => {
            try {
              // Android: only use message (url param is treated as file)
              // iOS: can use both message and url
              await Share.share(
                Platform.OS === 'android'
                  ? { message: `My Reporter ID Card: ${htmlUrl}` }
                  : { message: `My Reporter ID Card: ${htmlUrl}`, url: htmlUrl, title: 'Reporter ID Card' }
              );
            } catch (e: any) {
              setMessage(e?.message || 'Failed to share');
            }
          },
        },
        {
          text: 'Download & Share PDF',
          onPress: handleDownloadPdf,
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [reporter?.id, handleDownloadPdf]);

  // Navigate to profile to upload photo
  const goToProfile = useCallback(() => {
    router.push('/reporter/profile' as any);
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading ID Card...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} translucent={false} />

      {/* Header */}
      <LinearGradient
        colors={[primaryColor, secondaryColor]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My ID Card</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[primaryColor]} />}
      >
        {/* ── ID Card Exists ── */}
        {hasIdCard && idCard ? (
          <>
            {/* Digital ID Card - Modern Design */}
            <View style={styles.digitalCard}>
              {/* Main Card with Gradient */}
              <LinearGradient
                colors={isExpired ? ['#374151', '#1F2937', '#111827'] : ['#0f172a', '#1e3a5f', '#0c4a6e']}
                style={styles.digitalCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Holographic Overlay */}
                <View style={styles.holoOverlay} />
                
                {/* Top Bar with Logo & Status */}
                <View style={styles.digitalHeader}>
                  <View style={styles.digitalBrand}>
                    <LinearGradient
                      colors={['#f97316', '#ea580c']}
                      style={styles.digitalLogo}
                    >
                      <Text style={styles.digitalLogoText}>K</Text>
                    </LinearGradient>
                    <View>
                      <Text style={styles.digitalBrandName}>{session?.tenant?.name || 'KABURLU MEDIA'}</Text>
                      <Text style={styles.digitalBrandTag}>OFFICIAL PRESS ID</Text>
                    </View>
                  </View>
                  <View style={[styles.digitalStatus, isExpired ? styles.statusExpired : expiringSoon ? styles.statusWarning : styles.statusActive]}>
                    <View style={styles.statusDot} />
                    <Text style={styles.digitalStatusText}>{isExpired ? 'EXPIRED' : expiringSoon ? 'EXPIRING' : 'ACTIVE'}</Text>
                  </View>
                </View>

                {/* Profile Section */}
                <View style={styles.digitalProfile}>
                  <View style={styles.digitalPhotoContainer}>
                    <LinearGradient
                      colors={['#06b6d4', '#0891b2', '#0e7490']}
                      style={styles.digitalPhotoBorder}
                    >
                      {reporter?.profilePhotoUrl ? (
                        <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.digitalPhoto} contentFit="cover" />
                      ) : (
                        <View style={[styles.digitalPhoto, styles.photoPlaceholder]}>
                          <Ionicons name="person" size={40} color="#6B7280" />
                        </View>
                      )}
                    </LinearGradient>
                    {/* Verified Badge */}
                    {!isExpired && (
                      <View style={styles.verifiedBadge}>
                        <MaterialIcons name="verified" size={18} color="#22c55e" />
                      </View>
                    )}
                  </View>

                  <View style={styles.digitalInfo}>
                    <Text style={styles.digitalCardNumber}>{idCard.cardNumber}</Text>
                    <Text style={styles.digitalName}>{reporter?.fullName || 'Reporter'}</Text>
                    <View style={styles.designationBadge}>
                      <Text style={styles.designationText}>{reporter?.designation?.name || 'Reporter'}</Text>
                    </View>
                  </View>
                </View>

                {/* Validity Section with Chip Design */}
                <View style={styles.digitalDates}>
                  <View style={styles.chipDecor}>
                    <View style={styles.chipLines}>
                      <View style={styles.chipLine} />
                      <View style={styles.chipLine} />
                      <View style={styles.chipLine} />
                    </View>
                  </View>
                  <View style={styles.datesContainer}>
                    <View style={styles.digitalDateItem}>
                      <Text style={styles.digitalDateLabel}>ISSUED</Text>
                      <Text style={styles.digitalDateValue}>{formatDate(idCard.issuedAt)}</Text>
                    </View>
                    <View style={styles.dateSeparator}>
                      <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                    <View style={styles.digitalDateItem}>
                      <Text style={styles.digitalDateLabel}>VALID UNTIL</Text>
                      <Text style={[styles.digitalDateValue, isExpired && styles.dateExpired]}>
                        {formatDate(idCard.expiresAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Bar */}
                <View style={styles.digitalFooter}>
                  <View style={styles.qrHint}>
                    <MaterialCommunityIcons name="qrcode-scan" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.digitalFooterText}>Scan QR to verify</Text>
                  </View>
                  <View style={styles.securityPattern}>
                    <Text style={styles.securityText}>● ● ●</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Expired Warning */}
            {isExpired && (
              <View style={styles.warningBox}>
                <MaterialIcons name="error" size={20} color="#DC2626" />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>ID Card Expired</Text>
                  <Text style={styles.warningSubtitle}>Contact your publisher to renew your ID card</Text>
                </View>
              </View>
            )}

            {/* Expiring Soon Warning */}
            {!isExpired && expiringSoon && (
              <View style={[styles.warningBox, styles.warningOrange]}>
                <MaterialIcons name="schedule" size={20} color="#D97706" />
                <View style={styles.warningContent}>
                  <Text style={[styles.warningTitle, { color: '#92400E' }]}>Expiring Soon</Text>
                  <Text style={[styles.warningSubtitle, { color: '#B45309' }]}>
                    Your ID card will expire on {formatDate(idCard.expiresAt)}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons - Row 1 */}
            <View style={styles.actionsRow}>
              {/* Download PDF */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: primaryColor }]}
                onPress={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="download" size={22} color="#fff" />
                    <Text style={styles.actionTextPrimary}>PDF డౌన్లోడ్</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Send to WhatsApp */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: WHATSAPP_COLOR }]}
                onPress={handleSendWhatsApp}
                disabled={sendingWhatsApp}
              >
                {sendingWhatsApp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                    <Text style={styles.actionTextPrimary}>WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons - Row 2 */}
            <View style={styles.actionsRow}>
              {/* Regenerate */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: secondaryColor }]}
                onPress={handleRegenerateIdCard}
                disabled={regenerating}
              >
                {regenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="refresh" size={22} color="#fff" />
                    <Text style={styles.actionTextPrimary}>Regenerate</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary, { borderColor: primaryColor }]} onPress={handleShare}>
                <MaterialIcons name="share" size={22} color={primaryColor} />
                <Text style={[styles.actionTextSecondary, { color: primaryColor }]}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Message */}
            {message && (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>📋 మీ ID కార్డ్ గురించి</Text>
              <Text style={styles.instructionItem}>• ఇది {session?.tenant?.name || 'మీ పబ్లిషర్'} జారీచేసిన అధికారిక ప్రెస్ ID</Text>
              <Text style={styles.instructionItem}>• PDF డౌన్‌లోడ్ చేసి ప్రింట్ లేదా డిజిటల్‌గా వాడండి</Text>
              <Text style={styles.instructionItem}>• WhatsApp బటన్ ద్వారా PDF మీ ఫోన్‌కు వస్తుంది</Text>
              <Text style={styles.instructionItem}>• లింక్ షేర్ చేసి ఆన్‌లైన్ వెరిఫికేషన్ చేయవచ్చు</Text>
            </View>
          </>
        ) : (
          /* ── No ID Card ── */
          <View style={styles.noCardContainer}>
            <View style={styles.noCardIcon}>
              <MaterialCommunityIcons name="card-bulleted-off-outline" size={64} color="#9CA3AF" />
            </View>

            <Text style={styles.noCardTitle}>ID కార్డ్ ఇంకా లేదు</Text>

            {!hasProfilePhoto ? (
              /* No profile photo - prompt to upload */
              <>
                <Text style={styles.noCardSubtitle}>
                  ముందుగా మీ ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయండి. ID కార్డ్ రూపొందించడానికి మీ ఫోటో అవసరం.
                </Text>
                <View style={styles.noCardSteps}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepNumber, { backgroundColor: secondaryColor }]}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>ప్రొఫైల్ ఫోటో అప్‌లోడ్ చేయండి</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>KYC వెరిఫికేషన్ పూర్తి చేయండి</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>ID కార్డ్ రూపొందించండి</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.uploadPhotoBtn} onPress={goToProfile}>
                  <MaterialIcons name="add-a-photo" size={20} color="#fff" />
                  <Text style={styles.uploadPhotoBtnText}>ఫోటో అప్‌లోడ్ చేయండి</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Has profile photo - can generate ID card */
              <>
                <Text style={styles.noCardSubtitle}>
                  మీ ప్రొఫైల్ పూర్తయింది! ID కార్డ్ రూపొందించడానికి క్రింది బటన్ క్లిక్ చేయండి.
                </Text>

                <View style={styles.publisherBox}>
                  <View style={styles.publisherIcon}>
                    <MaterialCommunityIcons name="domain" size={28} color={primaryColor} />
                  </View>
                  <View style={styles.publisherInfo}>
                    <Text style={styles.publisherName}>{session?.tenant?.name || 'మీ పబ్లిషర్'}</Text>
                    <Text style={styles.publisherHint}>అధికారిక ప్రెస్ ID కార్డ్</Text>
                  </View>
                </View>

                <View style={styles.checklistBox}>
                  <Text style={styles.checklistTitle}>✅ చెక్‌లిస్ట్:</Text>
                  <View style={styles.checklistItem}>
                    <MaterialIcons name="check-circle" size={18} color="#10B981" />
                    <Text style={styles.checklistText}>ప్రొఫైల్ ఫోటో అప్‌లోడ్ అయింది</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons 
                      name={reporter?.kycStatus === 'APPROVED' ? 'check-circle' : 'radio-button-unchecked'} 
                      size={18} 
                      color={reporter?.kycStatus === 'APPROVED' ? '#10B981' : '#9CA3AF'} 
                    />
                    <Text style={[styles.checklistText, reporter?.kycStatus !== 'APPROVED' && { color: '#6B7280' }]}>
                      KYC వెరిఫై {reporter?.kycStatus === 'APPROVED' ? 'అయింది' : 'కావాలి'}
                    </Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons 
                      name={!paymentDue ? 'check-circle' : 'error'} 
                      size={18} 
                      color={!paymentDue ? '#10B981' : '#DC2626'} 
                    />
                    <Text style={[styles.checklistText, paymentDue && { color: '#DC2626' }]}>
                      పేమెంట్ {!paymentDue ? 'అప్‌టు‌డేట్' : 'పెండింగ్'}
                    </Text>
                  </View>
                </View>

                {/* Payment Due Warning */}
                {paymentDue && (
                  <View style={styles.paymentWarningBox}>
                    <MaterialIcons name="error-outline" size={20} color="#DC2626" />
                    <View style={styles.paymentWarningContent}>
                      <Text style={styles.paymentWarningTitle}>పేమెంట్ పెండింగ్</Text>
                      <Text style={styles.paymentWarningText}>
                        ID కార్డ్ జనరేట్ చేయడానికి ముందుగా పేమెంట్ చేయండి
                      </Text>
                    </View>
                  </View>
                )}

                {/* Generate ID Card Button */}
                <TouchableOpacity 
                  style={[
                    styles.uploadPhotoBtn, 
                    { backgroundColor: paymentDue ? '#9CA3AF' : primaryColor }
                  ]} 
                  onPress={handleGenerateIdCard}
                  disabled={generating || paymentDue}
                >
                  {generating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="card-account-details" size={20} color="#fff" />
                      <Text style={styles.uploadPhotoBtnText}>
                        {paymentDue ? 'పేమెంట్ చేసిన తర్వాత జనరేట్' : 'ID కార్డ్ రూపొందించండి'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {reporter?.kycStatus !== 'APPROVED' && (
                  <TouchableOpacity 
                    style={[styles.uploadPhotoBtn, { backgroundColor: '#10B981', marginTop: 12 }]} 
                    onPress={() => router.push('/reporter/kyc')}
                  >
                    <MaterialIcons name="verified-user" size={20} color="#fff" />
                    <Text style={styles.uploadPhotoBtnText}>KYC పూర్తి చేయండి</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Official Card
  officialCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  cardGradient: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: DEFAULT_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  cardBrandName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cardTagline: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusWarning: {
    backgroundColor: '#D97706',
  },
  statusExpired: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Card Body
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  photoFrame: {
    width: 80,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  reporterName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  designation: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // Dates
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dateLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dateExpired: {
    color: '#FCA5A5',
  },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // Warning Box
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 12,
  },
  warningOrange: {
    backgroundColor: '#FEF3C7',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 2,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionPrimary: {
    flex: 2,
    backgroundColor: DEFAULT_PRIMARY,
  },
  actionSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: DEFAULT_PRIMARY,
  },
  actionTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  actionTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: DEFAULT_PRIMARY,
  },

  // Message
  messageBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },

  // Instructions
  instructions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  instructionItem: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 22,
  },

  // No Card
  noCardContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noCardIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  noCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  noCardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  noCardSteps: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DEFAULT_SECONDARY,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  uploadPhotoBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Publisher Box
  publisherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  publisherIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherInfo: {
    flex: 1,
  },
  publisherName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  publisherHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Checklist
  checklistBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  checklistText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },

  // Payment Warning Box
  paymentWarningBox: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  paymentWarningContent: {
    flex: 1,
  },
  paymentWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  paymentWarningText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DIGITAL CARD STYLES - Modern glassmorphism with holographic effect
  // ═══════════════════════════════════════════════════════════════════════════
  digitalCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  digitalCardGradient: {
    padding: 20,
    minHeight: 280,
    position: 'relative',
  },
  holoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.08,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Digital Header
  digitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  digitalBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  digitalLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  digitalLogoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  digitalBrandName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  digitalBrandTag: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  digitalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  digitalStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Digital Profile Section
  digitalProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 20,
  },
  digitalPhotoContainer: {
    position: 'relative',
  },
  digitalPhotoBorder: {
    width: 90,
    height: 110,
    borderRadius: 14,
    padding: 3,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  digitalPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    backgroundColor: '#1e293b',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  digitalInfo: {
    flex: 1,
  },
  digitalCardNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 2,
    marginBottom: 6,
    textShadowColor: 'rgba(251,191,36,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  digitalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  designationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  designationText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },

  // Digital Dates Section
  digitalDates: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipDecor: {
    width: 40,
    height: 30,
    backgroundColor: '#d4af37',
    borderRadius: 6,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  chipLines: {
    width: 28,
    gap: 3,
  },
  chipLine: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 1,
  },
  datesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitalDateItem: {
    flex: 1,
  },
  digitalDateLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  digitalDateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  dateSeparator: {
    paddingHorizontal: 8,
  },

  // Digital Footer
  digitalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 14,
  },
  qrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  digitalFooterText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  securityPattern: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityText: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 4,
  },
});
