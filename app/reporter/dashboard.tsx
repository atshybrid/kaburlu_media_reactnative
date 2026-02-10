/**
 * Reporter Dashboard - Clean & Simple Design
 * 
 * Main Features:
 * 1. Profile Photo - Check and upload if missing
 * 2. Post News - Simple raw text submission  
 * 3. My Articles - List with status and share
 * 4. ID Card - Download
 * 5. KYC - Easy verification
 */
import ShareableArticleImage, { type ShareableArticleData, type ShareableArticleImageRef } from '@/components/ShareableArticleImage';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens, softLogout } from '@/services/auth';
import { logout } from '@/services/api';
import {
  getMyNewspaperArticles,
  getReporterMe,
  updateReporterProfilePhoto,
  type MyNewspaperArticle,
  type NewspaperArticleStatus,
  type ReporterMeResponse,
} from '@/services/reporters';
import { uploadMedia } from '@/services/media';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─────────────────────────────  Constants  ───────────────────────────── */

const DEFAULT_PRIMARY = '#109edc';

// Validate hex color
function isValidHexColor(color: any): boolean {
  if (!color || typeof color !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

type TabType = 'ALL' | 'PENDING' | 'PUBLISHED' | 'REJECTED';
const TABS: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'ALL', label: 'అన్నీ', icon: 'list' },
  { key: 'PENDING', label: 'పెండింగ్', icon: 'time-outline' },
  { key: 'PUBLISHED', label: 'పబ్లిష్', icon: 'checkmark-circle-outline' },
  { key: 'REJECTED', label: 'రిజెక్ట్', icon: 'close-circle-outline' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#D97706' },
  PUBLISHED: { bg: '#D1FAE5', text: '#059669' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  DRAFT: { bg: '#E5E7EB', text: '#6B7280' },
};

/* ─────────────────────────────  Helpers  ───────────────────────────── */

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ఇప్పుడే';
    if (mins < 60) return `${mins} ని. క్రితం`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} గం. క్రితం`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} రోజుల క్రితం`;
    return new Date(dateStr).toLocaleDateString('te-IN');
  } catch {
    return '';
  }
}

/* ─────────────────────────────  Article Card  ───────────────────────────── */

interface ArticleCardProps {
  article: MyNewspaperArticle;
  onPress: () => void;
  onShare?: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onPress, onShare }) => {
  const statusColors = STATUS_COLORS[article.status] || STATUS_COLORS.DRAFT;
  const coverImage = article.coverImageUrl || article.imageUrl || null;
  const canShare = article.status === 'PUBLISHED' && onShare;

  return (
    <Pressable style={styles.articleCard} onPress={onPress}>
      {/* Image */}
      <View style={styles.articleImageBox}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.articleImage} contentFit="cover" />
        ) : (
          <View style={[styles.articleImage, styles.noImage]}>
            <Ionicons name="newspaper-outline" size={28} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
        
        {/* Meta row */}
        <View style={styles.articleMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>{article.status}</Text>
          </View>
          <Text style={styles.articleDate}>{timeAgo(article.createdAt)}</Text>
          {article.viewCount !== undefined && article.viewCount > 0 && (
            <View style={styles.viewsBox}>
              <Ionicons name="eye-outline" size={12} color="#6B7280" />
              <Text style={styles.viewsText}>{article.viewCount}</Text>
            </View>
          )}
        </View>

        {/* Share button for published */}
        {canShare && (
          <Pressable style={styles.shareBtn} onPress={onShare}>
            <Ionicons name="share-social" size={16} color="#FFF" />
            <Text style={styles.shareBtnText}>షేర్</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

/* ─────────────────────────────  Main Dashboard  ───────────────────────────── */

export default function ReporterDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reporter, setReporter] = useState<ReporterMeResponse | null>(null);
  const [articles, setArticles] = useState<MyNewspaperArticle[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);

  // Share state
  const shareImageRef = useRef<ShareableArticleImageRef>(null);
  const [shareArticle, setShareArticle] = useState<ShareableArticleData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Audio ref for first login
  const audioRef = useRef<Audio.Sound | null>(null);

  // Derived
  const hasProfilePhoto = !!reporter?.profilePhotoUrl;
  const kycStatus = reporter?.kycStatus;
  const isKycApproved = kycStatus === 'APPROVED';

  // Access control states
  const accessStatus = reporter?.accessStatus?.status || 'ACTIVE';
  const paymentRequired = accessStatus === 'PAYMENT_REQUIRED';
  const accessExpired = accessStatus === 'ACCESS_EXPIRED' || reporter?.manualLoginStatus?.expired === true;
  const publisherContact = reporter?.manualLoginStatus?.publisherContact;
  const paymentInfo = reporter?.paymentStatus;
  
  // Play level-based audio for Telugu reporters (max 5 times total, once per day)
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const REPORTER_AUDIO_KEY = 'reporter_audio_plays';
      const APP_SOUND_MUTED_KEY = 'app_sound_muted';
      const MAX_TOTAL_PLAYS = 5;
      
      if (!reporter) return;
      
      (async () => {
        try {
          // Check global mute setting first
          const isMuted = await AsyncStorage.getItem(APP_SOUND_MUTED_KEY);
          if (isMuted === 'true') {
            console.log('[ReporterDashboard] Sound is globally muted');
            return;
          }
          
          // Check play data (total count + last played date)
          const stored = await AsyncStorage.getItem(REPORTER_AUDIO_KEY);
          const today = new Date().toDateString();
          let playData = { totalCount: 0, lastPlayedDate: '' };
          
          if (stored) {
            try {
              playData = JSON.parse(stored);
            } catch {}
          }
          
          // Check if already played today
          if (playData.lastPlayedDate === today) {
            console.log('[ReporterDashboard] Audio already played today');
            return;
          }
          
          // Check if max total reached
          if (playData.totalCount >= MAX_TOTAL_PLAYS) {
            console.log('[ReporterDashboard] Audio limit reached:', playData.totalCount, '/', MAX_TOTAL_PLAYS);
            return;
          }

          // Check language
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          const parsed = langRaw ? JSON.parse(langRaw) : null;
          const langCode = String(parsed?.code || parsed?.id || '').toLowerCase();
          
          console.log('[ReporterDashboard] Language check:', { langCode, totalPlays: playData.totalCount });
          
          if (!langCode.startsWith('te')) {
            console.log('[ReporterDashboard] Not Telugu, skipping');
            return;
          }

          // Get reporter level
          const level = reporter.designation?.level?.toUpperCase();
          console.log('[ReporterDashboard] Reporter level:', level);
          let audioFile;
          
          switch (level) {
            case 'STATE':
              audioFile = require('../../assets/audio/state_te.mp3');
              break;
            case 'DISTRICT':
              audioFile = require('../../assets/audio/Staff_Reporter_te.mp3');
              break;
            case 'ASSEMBLY':
              audioFile = require('../../assets/audio/RC-Incharge_te.mp3');
              break;
            case 'MANDAL':
              audioFile = require('../../assets/audio/Mandal_Reporter_te.mp3');
              break;
            default:
              console.log('[ReporterDashboard] Unknown level, skipping');
              return; // Unknown level, don't play
          }

          // Configure audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });

          // Play audio
          console.log('[ReporterDashboard] Playing audio for level:', level, '(day', playData.totalCount + 1, 'of', MAX_TOTAL_PLAYS, ')');
          const { sound } = await Audio.Sound.createAsync(audioFile, { shouldPlay: true });
          if (mounted) {
            audioRef.current = sound;
            // Update play data
            playData.totalCount += 1;
            playData.lastPlayedDate = today;
            await AsyncStorage.setItem(REPORTER_AUDIO_KEY, JSON.stringify(playData));
            console.log('[ReporterDashboard] Audio started, total plays:', playData.totalCount);
            // Auto unload when finished
            sound.setOnPlaybackStatusUpdate((status) => {
              if ('didJustFinish' in status && status.didJustFinish) {
                console.log('[ReporterDashboard] Audio finished');
                sound.unloadAsync().catch(() => {});
                if (audioRef.current === sound) audioRef.current = null;
              }
            });
          } else {
            await sound.unloadAsync();
          }
        } catch (e) {
          console.warn('[ReporterDashboard] Audio error:', e);
        }
      })();

      return () => {
        mounted = false;
        if (audioRef.current) {
          audioRef.current.stopAsync().then(() => audioRef.current?.unloadAsync()).catch(() => {});
          audioRef.current = null;
        }
      };
    }, [reporter])
  );

  /* ─────────────────────  Data Loading  ───────────────────── */

  const loadReporter = useCallback(async () => {
    try {
      const tokens = await loadTokens();
      const session = (tokens as any)?.session;
      setTenantName(session?.tenant?.name || '');
      setTenantId(session?.reporter?.tenantId || session?.tenant?.id || '');

      // Extract tenant primary color from domainSettings
      const domainSettings = session?.domainSettings;
      const colors = domainSettings?.data?.theme?.colors;
      if (colors) {
        const pColor = colors.primary || colors.accent;
        if (isValidHexColor(pColor)) setPrimaryColor(pColor);
      }

      const data = await getReporterMe();
      setReporter(data);

      // If no profile photo, show modal
      if (!data.profilePhotoUrl) {
        setTimeout(() => setShowPhotoModal(true), 500);
      }
    } catch (e: any) {
      console.error('[Dashboard] Load reporter failed:', e);
      
      // Handle 401/404 - session expired or not a reporter
      if (e?.status === 401 || e?.status === 404) {
        Alert.alert(
          e?.status === 404 ? 'రిపోర్టర్ కాదు' : 'సెషన్ ముగిసింది',
          e?.status === 404 
            ? 'మీరు రిపోర్టర్ కాదు. దయచేసి సరైన ఖాతాతో లాగిన్ చేయండి.'
            : 'మీ లాగిన్ సెషన్ ముగిసింది. దయచేసి మళ్లీ లాగిన్ చేయండి.',
          [{
            text: 'సరే',
            onPress: () => router.replace('/splash')
          }]
        );
      }
    }
  }, [router]);

  const loadArticles = useCallback(async (cursor?: string | null, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setNextCursor(null);
      } else if (!cursor) {
        setLoading(true);
        setNextCursor(null);
      } else {
        setLoadingMore(true);
      }

      const status: NewspaperArticleStatus | undefined = activeTab === 'ALL' ? undefined : activeTab as NewspaperArticleStatus;
      const res = await getMyNewspaperArticles({ limit: 15, cursor: cursor || undefined, status });

      if (!cursor || refresh) {
        setArticles(res.data || []);
      } else {
        setArticles(prev => [...prev, ...(res.data || [])]);
      }

      setNextCursor(res.nextCursor || null);
      setHasMore(!!res.nextCursor);
    } catch (e: any) {
      console.error('[Dashboard] Load articles failed:', e);
      
      // Handle 401 - token expired
      if (e?.status === 401) {
        Alert.alert(
          'సెషన్ ముగిసింది',
          'మీ లాగిన్ సెషన్ ముగిసింది. దయచేసి మళ్లీ లాగిన్ చేయండి.',
          [{
            text: 'సరే',
            onPress: () => router.replace('/splash')
          }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, router]);

  useFocusEffect(
    useCallback(() => {
      loadReporter();
      loadArticles(null, true);
    }, [loadReporter, loadArticles])
  );

  // Hardware back button: go to news page
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/news');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const onRefresh = useCallback(() => {
    loadReporter();
    loadArticles(null, true);
  }, [loadReporter, loadArticles]);

  const onLoadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && hasMore && nextCursor) {
      loadArticles(nextCursor);
    }
  }, [loading, refreshing, loadingMore, hasMore, nextCursor, loadArticles]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setArticles([]);
    setHasMore(true);
    setNextCursor(null);
  }, []);

  // Reload articles when tab changes
  React.useEffect(() => {
    loadArticles(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /* ─────────────────────  Profile Photo Upload  ───────────────────── */

  const pickAndUploadPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingPhoto(true);
      setShowPhotoModal(false);

      // Upload image
      const uploadRes = await uploadMedia({
        uri: result.assets[0].uri,
        folder: 'profiles',
        kind: 'image',
      });

      if (!uploadRes?.publicUrl) {
        throw new Error('Upload failed');
      }

      // Update reporter profile photo
      if (reporter?.id && tenantId) {
        await updateReporterProfilePhoto(tenantId, reporter.id, uploadRes.publicUrl);
      }

      // Refresh reporter data
      await loadReporter();
      Alert.alert('విజయం', 'ప్రొఫైల్ ఫోటో అప్‌డేట్ అయింది!');
    } catch (e: any) {
      console.error('[Dashboard] Photo upload failed:', e);
      Alert.alert('Error', e?.message || 'ఫోటో అప్‌లోడ్ విఫలమైంది');
    } finally {
      setUploadingPhoto(false);
    }
  }, [reporter?.id, tenantId, loadReporter]);

  /* ─────────────────────  Share as Image  ───────────────────── */

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'లాగ్అవుట్',
      'మీరు లాగ్అవుట్ చేయాలనుకుంటున్నారా?',
      [
        { text: 'రద్దు', style: 'cancel' },
        {
          text: 'లాగ్అవుట్',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              const jwt = await AsyncStorage.getItem('jwt');
              const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
              if (jwt) { try { await logout(); } catch (e: any) { console.warn('[Dashboard] remote logout failed', e?.message); } }
              
              // Keep language, location, and push notification preferences
              const keysToKeep = ['selectedLanguage', 'profile_location', 'profile_location_obj', 'push_notifications_enabled'];
              await softLogout(keysToKeep, mobile || undefined);
              
              // Go to account tab
              router.replace('/tech');
            } catch (e: any) {
              console.error('[Dashboard] Logout failed:', e);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [router]);

  const handleShareAsImage = useCallback(async (article: MyNewspaperArticle) => {
    const shareData: ShareableArticleData = {
      id: article.id,
      title: article.title,
      subTitle: article.subTitle,
      lead: article.lead,
      points: article.points,
      content: article.content,
      coverImageUrl: article.coverImageUrl,
      webArticleUrl: article.sportLink || article.webArticle?.url || article.webArticleUrl,
      reporter: {
        id: reporter?.id,
        fullName: reporter?.fullName || undefined,
        profilePhotoUrl: reporter?.profilePhotoUrl || undefined,
      },
    };
    setShareArticle(shareData);

    // Call captureAndShare directly - it will show style picker
    if (shareImageRef.current) {
      try {
        await shareImageRef.current.captureAndShare();
      } catch (e) {
        console.error('[Dashboard] Share failed:', e);
        Alert.alert('Error', 'షేర్ విఫలమైంది');
      }
    } else {
      console.error('[Dashboard] shareImageRef is null');
      Alert.alert('Error', 'దయచేసి మళ్ళీ ప్రయత్నించండి');
    }
  }, [reporter]);

  /* ─────────────────────  Navigation  ───────────────────── */

  const goToPostNews = useCallback(() => router.push('/post-news' as any), [router]);
  const goToIdCard = useCallback(() => router.push('/reporter/id-card' as any), [router]);
  const goToKyc = useCallback(() => router.push('/reporter/kyc' as any), [router]);
  const goToProfile = useCallback(() => router.push('/reporter/profile' as any), [router]);
  const goToArticle = useCallback((id: string) => router.push(`/reporter/article/${id}` as any), [router]);

  // Navigate to payment screen
  const goToPayment = useCallback(() => {
    if (!reporter || !paymentInfo) return;
    const outstanding = paymentInfo.outstanding?.[0];
    router.push({
      pathname: '/auth/payment',
      params: {
        reporterId: reporter.id,
        tenantId: reporter.tenantId,
        mobile: reporter.mobileNumber || '',
        razorpayData: paymentInfo.razorpay ? JSON.stringify(paymentInfo.razorpay) : '',
        breakdownData: outstanding ? JSON.stringify({
          total: { amount: outstanding.amount, displayAmount: `₹${outstanding.amount}` },
          type: outstanding.type,
        }) : '',
      },
    });
  }, [reporter, paymentInfo, router]);

  // Call publisher
  const callPublisher = useCallback(() => {
    const phone = publisherContact?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  }, [publisherContact]);

  // WhatsApp publisher
  const whatsappPublisher = useCallback(() => {
    const phone = publisherContact?.phone?.replace(/\D/g, '');
    if (phone) {
      const message = encodeURIComponent('నమస్కారం, నా లాగిన్ గడువు ముగిసింది. దయచేసి నా అకౌంట్ రెన్యూ చేయండి.');
      Linking.openURL(`https://wa.me/${phone}?text=${message}`);
    }
  }, [publisherContact]);

  /* ─────────────────────  Render  ───────────────────── */

  const renderArticle = useCallback(({ item }: { item: MyNewspaperArticle }) => (
    <ArticleCard
      article={item}
      onPress={() => goToArticle(item.id)}
      onShare={item.status === 'PUBLISHED' ? () => handleShareAsImage(item) : undefined}
    />
  ), [goToArticle, handleShareAsImage]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyBox}>
      <Ionicons name="newspaper-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>ఆర్టికల్స్ లేవు</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'ALL' ? 'మీ మొదటి న్యూస్ పోస్ట్ చేయండి' : `${activeTab} ఆర్టికల్స్ లేవు`}
      </Text>
      {activeTab === 'ALL' && (
        <Pressable style={styles.emptyBtn} onPress={goToPostNews}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.emptyBtnText}>న్యూస్ పోస్ట్</Text>
        </Pressable>
      )}
    </View>
  ), [activeTab, goToPostNews]);

  const ListFooter = useMemo(() => loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={primaryColor} />
    </View>
  ) : null, [loadingMore]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

      {/* Share Image Component - Always rendered for ref to be valid */}
      <ShareableArticleImage
        ref={shareImageRef}
        article={shareArticle || {
          id: '',
          title: '',
        }}
        tenantName={tenantName}
        tenantPrimaryColor={primaryColor}
        visible={!!shareArticle}
      />

      {/* Profile Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: c.card }]}>
            <View style={styles.modalIconBox}>
              <Ionicons name="camera" size={48} color={primaryColor} />
            </View>
            <Text style={[styles.modalTitle, { color: c.text }]}>ప్రొఫైల్ ఫోటో అవసరం</Text>
            <Text style={[styles.modalSubtitle, { color: c.muted }]}>
              ID కార్డ్ మరియు న్యూస్ షేరింగ్ కోసం మీ ఫోటో అప్‌లోడ్ చేయండి
            </Text>
            <Pressable style={styles.modalBtn} onPress={pickAndUploadPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#FFF" />
                  <Text style={styles.modalBtnText}>ఫోటో ఎంచుకోండి</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.modalSkip} onPress={() => setShowPhotoModal(false)}>
              <Text style={[styles.modalSkipText, { color: c.muted }]}>తర్వాత చేస్తాను</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          ACCESS CONTROL OVERLAYS - Payment Required / Login Expired
          ══════════════════════════════════════════════════════════════════════ */}
      
      {/* Payment Required Overlay */}
      {paymentRequired && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.accessOverlay}>
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              style={styles.accessCard}
            >
              {/* Icon */}
              <View style={styles.accessIconBox}>
                <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.accessIconGradient}>
                  <MaterialCommunityIcons name="credit-card-clock" size={40} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Content */}
              <Text style={styles.accessTitle}>💳 పేమెంట్ పెండింగ్</Text>
              <Text style={styles.accessSubtitle}>
                మీ అకౌంట్ యాక్టివేట్ చేయడానికి పేమెంట్ చేయాలి
              </Text>

              {/* Amount Box */}
              {paymentInfo?.outstanding?.[0] && (
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>
                    {paymentInfo.outstanding[0].type === 'ONBOARDING' ? 'ఆన్‌బోర్డింగ్ ఫీజు' : 'సబ్‌స్క్రిప్షన్'}
                  </Text>
                  <Text style={styles.amountValue}>₹{paymentInfo.outstanding[0].amount}</Text>
                </View>
              )}

              {/* Pay Button */}
              <TouchableOpacity style={styles.payBtn} onPress={goToPayment} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.payBtnGradient}
                >
                  <MaterialCommunityIcons name="credit-card-check" size={22} color="#FFF" />
                  <Text style={styles.payBtnText}>పేమెంట్ చేయండి</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Contact Publisher */}
              <TouchableOpacity style={styles.contactLink} onPress={whatsappPublisher}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={styles.contactLinkText}>పబ్లిషర్‌ని సంప్రదించండి</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      )}

      {/* Login Expired Overlay */}
      {accessExpired && !paymentRequired && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.accessOverlay}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.accessCard}
            >
              {/* Icon */}
              <View style={styles.accessIconBox}>
                <LinearGradient colors={['#dc2626', '#b91c1c']} style={styles.accessIconGradient}>
                  <MaterialCommunityIcons name="clock-alert" size={40} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Content */}
              <Text style={styles.accessTitle}>⏰ లాగిన్ గడువు ముగిసింది</Text>
              <Text style={styles.accessSubtitle}>
                {publisherContact?.message || 'మీ యాక్సెస్ గడువు ముగిసింది. దయచేసి పబ్లిషర్‌ని సంప్రదించండి.'}
              </Text>

              {/* Publisher Info */}
              {publisherContact && (
                <View style={styles.publisherBox}>
                  <View style={styles.publisherAvatar}>
                    <MaterialCommunityIcons name="domain" size={24} color={primaryColor} />
                  </View>
                  <View style={styles.publisherInfo}>
                    <Text style={styles.publisherName}>{publisherContact.name || tenantName || 'Publisher'}</Text>
                    <Text style={styles.publisherPhone}>{publisherContact.phone || ''}</Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.accessActions}>
                {/* Call Button */}
                <TouchableOpacity style={styles.callBtn} onPress={callPublisher} activeOpacity={0.8}>
                  <Ionicons name="call" size={20} color="#FFF" />
                  <Text style={styles.callBtnText}>కాల్ చేయండి</Text>
                </TouchableOpacity>

                {/* WhatsApp Button */}
                <TouchableOpacity style={styles.whatsappBtn} onPress={whatsappPublisher} activeOpacity={0.8}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                  <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>

              {/* Help Text */}
              <Text style={styles.helpText}>
                పబ్లిషర్ మీ అకౌంట్ రెన్యూ చేసిన తర్వాత యాప్ రీఫ్రెష్ చేయండి
              </Text>

              {/* Refresh Button */}
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color={primaryColor} />
                <Text style={styles.refreshBtnText}>రీఫ్రెష్</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      )}

      {/* Header */}
      <LinearGradient colors={[primaryColor, '#0891b2']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* Top row - back and logout */}
        <View style={styles.headerTopRow}>
          <Pressable style={styles.headerIconBtn} onPress={() => router.replace('/news')}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>రిపోర్టర్ డాష్‌బోర్డ్</Text>
          <Pressable 
            style={styles.headerIconBtn} 
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="log-out-outline" size={22} color="#FFF" />
            )}
          </Pressable>
        </View>

        {/* Profile row */}
        <View style={styles.profileRow}>
          <Pressable style={styles.profilePhotoBox} onPress={hasProfilePhoto ? goToProfile : pickAndUploadPhoto}>
            {reporter?.profilePhotoUrl ? (
              <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.profilePhoto} contentFit="cover" />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePlaceholder]}>
                <Ionicons name="camera" size={24} color="#FFF" />
              </View>
            )}
            {!hasProfilePhoto && (
              <View style={styles.addPhotoIndicator}>
                <Ionicons name="add" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {reporter?.fullName || 'Reporter'}
            </Text>
            {reporter?.mobileNumber && (
              <Text style={styles.profileMobile}>{reporter.mobileNumber}</Text>
            )}
            {reporter?.designation?.name && (
              <View style={styles.designationBadge}>
                <Text style={styles.designationText}>{reporter.designation.name}</Text>
              </View>
            )}
          </View>

          {/* KYC Status */}
          <Pressable
            style={[
              styles.kycBadge,
              { backgroundColor: isKycApproved ? '#D1FAE5' : '#FEF3C7' },
            ]}
            onPress={goToKyc}
          >
            <Ionicons
              name={isKycApproved ? 'shield-checkmark' : 'alert-circle'}
              size={16}
              color={isKycApproved ? '#059669' : '#D97706'}
            />
            <Text style={[styles.kycText, { color: isKycApproved ? '#059669' : '#D97706' }]}>
              {isKycApproved ? 'Verified' : 'KYC'}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={[styles.quickActions, { backgroundColor: c.card }]}>
        <Pressable style={styles.quickAction} onPress={goToPostNews}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
            <MaterialCommunityIcons name="pencil-plus" size={24} color="#4F46E5" />
          </View>
          <Text style={[styles.quickActionLabel, { color: c.text }]}>న్యూస్ పోస్ట్</Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={goToIdCard}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="card" size={24} color="#22C55E" />
          </View>
          <Text style={[styles.quickActionLabel, { color: c.text }]}>ID కార్డ్</Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={goToKyc}>
          <View style={[styles.quickActionIcon, { backgroundColor: isKycApproved ? '#D1FAE5' : '#FEF3C7' }]}>
            <Ionicons name="shield-checkmark" size={24} color={isKycApproved ? '#059669' : '#D97706'} />
          </View>
          <Text style={[styles.quickActionLabel, { color: c.text }]}>KYC</Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={goToProfile}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FDF4FF' }]}>
            <Ionicons name="person" size={24} color="#A855F7" />
          </View>
          <Text style={[styles.quickActionLabel, { color: c.text }]}>ప్రొఫైల్</Text>
        </Pressable>
      </View>

      {/* KYC Warning Banner */}
      {reporter && !isKycApproved && (
        <Pressable style={styles.kycBanner} onPress={goToKyc}>
          <Ionicons name="warning" size={20} color="#D97706" />
          <View style={styles.kycBannerText}>
            <Text style={styles.kycBannerTitle}>
              {kycStatus === 'REJECTED' ? 'KYC రిజెక్ట్ అయింది' : 'KYC వెరిఫికేషన్ పెండింగ్'}
            </Text>
            <Text style={styles.kycBannerSubtitle}>
              {kycStatus === 'REJECTED' ? 'దయచేసి మళ్ళీ సబ్మిట్ చేయండి' : 'ID కార్డ్ పొందడానికి KYC పూర్తి చేయండి'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#D97706" />
        </Pressable>
      )}

      {/* Status Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: c.card }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? primaryColor : c.muted}
            />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? primaryColor : c.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Articles List */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: c.muted }]}>లోడ్ అవుతుంది...</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderArticle}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primaryColor]} tintColor={primaryColor} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooter}
        />
      )}

      {/* Floating Post Button */}
      <Pressable style={styles.fab} onPress={goToPostNews}>
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },

  // Profile
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profilePhotoBox: { position: 'relative' },
  profilePhoto: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#FFF' },
  profilePlaceholder: { backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  addPhotoIndicator: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  profileInfo: { flex: 1, marginLeft: 12 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  profileMobile: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  designationBadge: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  designationText: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  kycText: { fontSize: 12, fontWeight: '600' },

  // Quick Actions
  quickActions: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  quickAction: { flex: 1, alignItems: 'center' },
  quickActionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickActionLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // KYC Banner
  kycBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  kycBannerText: { flex: 1 },
  kycBannerTitle: { fontSize: 14, fontWeight: '600', color: '#B45309' },
  kycBannerSubtitle: { fontSize: 12, color: '#D97706', marginTop: 2 },

  // Tabs
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // List
  listContent: { padding: 12, paddingBottom: 100 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, fontSize: 14 },
  footerLoader: { paddingVertical: 16 },

  // Article Card
  articleCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  articleImageBox: { width: 100, height: 100 },
  articleImage: { width: '100%', height: '100%' },
  noImage: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  articleContent: { flex: 1, padding: 10 },
  articleTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '600' },
  articleDate: { fontSize: 11, color: '#6B7280' },
  viewsBox: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewsText: { fontSize: 11, color: '#6B7280' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DEFAULT_PRIMARY, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, alignSelf: 'flex-start', marginTop: 8 },
  shareBtnText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DEFAULT_PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 20 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: DEFAULT_PRIMARY, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '85%', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DEFAULT_PRIMARY, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, marginTop: 24 },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  modalSkip: { marginTop: 16 },
  modalSkipText: { fontSize: 14 },

  // Sharing Overlay
  sharingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  sharingBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center' },
  sharingText: { marginTop: 12, fontSize: 14, color: '#374151' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL OVERLAY STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  accessOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  accessIconBox: {
    marginBottom: 20,
  },
  accessIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  accessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  accessSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },

  // Payment Amount Box
  amountBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  amountLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10b981',
  },

  // Pay Button
  payBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  payBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Contact Link
  contactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  contactLinkText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  // Publisher Box
  publisherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  publisherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherInfo: {
    flex: 1,
  },
  publisherName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  publisherPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Access Action Buttons
  accessActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DEFAULT_PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
  },
  callBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 14,
  },
  whatsappBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Help Text
  helpText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 16,
  },

  // Refresh Button
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: DEFAULT_PRIMARY,
  },
});
