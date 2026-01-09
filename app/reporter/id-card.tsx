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
 * - Has profile photo → prompt to contact publisher
 */
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { getReporterMe, type ReporterMeResponse } from '@/services/reporters';
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

const PRIMARY_COLOR = '#109edc';
const SECONDARY_COLOR = '#fa7c05';

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
  const [message, setMessage] = useState<string | null>(null);

  // ID Card from backend
  const idCard = reporter?.idCard ?? null;
  const hasIdCard = !!idCard;
  const hasProfilePhoto = !!reporter?.profilePhotoUrl;
  const isExpired = idCard ? isPast(idCard.expiresAt) : false;
  const expiringSoon = idCard ? isExpiringSoon(idCard.expiresAt) : false;

  // Load reporter data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);

    try {
      // Load session for tenant info
      const tokens = await loadTokens();
      const sess = (tokens as any)?.session as SessionData | undefined;
      if (sess) setSession(sess);

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
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading ID Card...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} translucent={false} />

      {/* Header */}
      <LinearGradient
        colors={[PRIMARY_COLOR, '#0891b2']}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[PRIMARY_COLOR]} />}
      >
        {/* ── ID Card Exists ── */}
        {hasIdCard && idCard ? (
          <>
            {/* Official Card Display */}
            <View style={styles.officialCard}>
              <LinearGradient
                colors={isExpired ? ['#6B7280', '#4B5563'] : ['#1e3a5f', '#0d2844']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardBrand}>
                    <View style={styles.cardLogo}>
                      <Text style={styles.cardLogoText}>K</Text>
                    </View>
                    <View>
                      <Text style={styles.cardBrandName}>{session?.tenant?.name || 'Kaburlu Media'}</Text>
                      <Text style={styles.cardTagline}>Official Press ID</Text>
                    </View>
                  </View>
                  {/* Status Badge */}
                  <View style={[styles.statusBadge, isExpired ? styles.statusExpired : expiringSoon ? styles.statusWarning : styles.statusActive]}>
                    <MaterialIcons name={isExpired ? 'error' : expiringSoon ? 'schedule' : 'verified'} size={12} color="#fff" />
                    <Text style={styles.statusText}>{isExpired ? 'EXPIRED' : expiringSoon ? 'EXPIRING' : 'ACTIVE'}</Text>
                  </View>
                </View>

                {/* Photo + Info */}
                <View style={styles.cardBody}>
                  <View style={styles.photoFrame}>
                    {reporter?.profilePhotoUrl ? (
                      <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.photo} contentFit="cover" />
                    ) : (
                      <View style={[styles.photo, styles.photoPlaceholder]}>
                        <Ionicons name="person" size={36} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardNumber}>{idCard.cardNumber}</Text>
                    <Text style={styles.reporterName}>{reporter?.fullName || 'Reporter'}</Text>
                    <Text style={styles.designation}>{reporter?.designation?.name || 'Reporter'}</Text>
                  </View>
                </View>

                {/* Dates */}
                <View style={styles.datesRow}>
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Issued</Text>
                    <Text style={styles.dateValue}>{formatDate(idCard.issuedAt)}</Text>
                  </View>
                  <View style={styles.dateDivider} />
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Valid Until</Text>
                    <Text style={[styles.dateValue, isExpired && styles.dateExpired]}>
                      {formatDate(idCard.expiresAt)}
                    </Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <MaterialCommunityIcons name="qrcode-scan" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.footerText}>Scan to verify authenticity</Text>
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

            {/* Action Buttons */}
            <View style={styles.actionsGrid}>
              {/* Download PDF */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="download" size={22} color="#fff" />
                    <Text style={styles.actionTextPrimary}>Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* View in Browser */}
              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={handleViewHtml}>
                <MaterialIcons name="open-in-browser" size={22} color={PRIMARY_COLOR} />
                <Text style={styles.actionTextSecondary}>View</Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={handleShare}>
                <MaterialIcons name="share" size={22} color="#10B981" />
                <Text style={[styles.actionTextSecondary, { color: '#10B981' }]}>Share</Text>
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
              <Text style={styles.instructionsTitle}>📋 About Your ID Card</Text>
              <Text style={styles.instructionItem}>• This is your official Press ID issued by {session?.tenant?.name || 'your publisher'}</Text>
              <Text style={styles.instructionItem}>• Download the PDF for printing or digital use</Text>
              <Text style={styles.instructionItem}>• The HTML view shows the same card style as PDF</Text>
              <Text style={styles.instructionItem}>• Share the link for online verification</Text>
            </View>
          </>
        ) : (
          /* ── No ID Card ── */
          <View style={styles.noCardContainer}>
            <View style={styles.noCardIcon}>
              <MaterialCommunityIcons name="card-bulleted-off-outline" size={64} color="#9CA3AF" />
            </View>

            <Text style={styles.noCardTitle}>No ID Card Yet</Text>

            {!hasProfilePhoto ? (
              /* No profile photo - prompt to upload */
              <>
                <Text style={styles.noCardSubtitle}>
                  Please upload your profile photo first. Your publisher needs your photo to generate your official ID card.
                </Text>
                <View style={styles.noCardSteps}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepNumber, { backgroundColor: SECONDARY_COLOR }]}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Upload your profile photo</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Complete KYC verification</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Publisher generates your ID card</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.uploadPhotoBtn} onPress={goToProfile}>
                  <MaterialIcons name="add-a-photo" size={20} color="#fff" />
                  <Text style={styles.uploadPhotoBtnText}>Upload Profile Photo</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Has profile photo - contact publisher */
              <>
                <Text style={styles.noCardSubtitle}>
                  Your profile is complete! Please contact your publisher to request your official Press ID card.
                </Text>

                <View style={styles.publisherBox}>
                  <View style={styles.publisherIcon}>
                    <MaterialCommunityIcons name="domain" size={28} color={PRIMARY_COLOR} />
                  </View>
                  <View style={styles.publisherInfo}>
                    <Text style={styles.publisherName}>{session?.tenant?.name || 'Your Publisher'}</Text>
                    <Text style={styles.publisherHint}>Contact them to generate your ID card</Text>
                  </View>
                </View>

                <View style={styles.checklistBox}>
                  <Text style={styles.checklistTitle}>Before requesting, ensure:</Text>
                  <View style={styles.checklistItem}>
                    <MaterialIcons name="check-circle" size={18} color="#10B981" />
                    <Text style={styles.checklistText}>Profile photo uploaded</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons 
                      name={reporter?.kycStatus === 'APPROVED' ? 'check-circle' : 'radio-button-unchecked'} 
                      size={18} 
                      color={reporter?.kycStatus === 'APPROVED' ? '#10B981' : '#9CA3AF'} 
                    />
                    <Text style={[styles.checklistText, reporter?.kycStatus !== 'APPROVED' && { color: '#6B7280' }]}>
                      KYC verified
                    </Text>
                  </View>
                </View>

                {reporter?.kycStatus !== 'APPROVED' && (
                  <TouchableOpacity 
                    style={[styles.uploadPhotoBtn, { backgroundColor: '#10B981' }]} 
                    onPress={() => router.push('/reporter/kyc')}
                  >
                    <MaterialIcons name="verified-user" size={20} color="#fff" />
                    <Text style={styles.uploadPhotoBtnText}>Complete KYC</Text>
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
    backgroundColor: PRIMARY_COLOR,
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
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionPrimary: {
    flex: 2,
    backgroundColor: PRIMARY_COLOR,
  },
  actionSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
  },
  actionTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  actionTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
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
    backgroundColor: SECONDARY_COLOR,
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
});
