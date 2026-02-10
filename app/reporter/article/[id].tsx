/**
 * Reporter Article Detail Page
 * Beginner-friendly design with Telugu labels
 * View, Edit, Delete, and Share your own newspaper articles
 */
import ShareableArticleImage, {
    ShareableArticleData,
    ShareableArticleImageRef,
} from '@/components/ShareableArticleImage';
import { loadTokens } from '@/services/auth';
import {
    deleteNewspaperArticle,
    getNewspaperArticleById,
    getReporterMe,
    updateNewspaperArticle,
    type NewspaperArticleDetail,
    type ReporterMeResponse,
    type UpdateNewspaperArticlePayload,
} from '@/services/reporters';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Session type from login response
type SessionData = {
  user?: { name?: string };
  tenant?: { name?: string };
  reporter?: ReporterMeResponse;
};

const DEFAULT_PRIMARY = '#109edc';

// Validate hex color
function isValidHexColor(color: any): boolean {
  if (!color || typeof color !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ----- Skeleton Component -----
const SkeletonBox = ({ width, height, style, borderRadius = 8 }: { 
  width: number | string; 
  height: number; 
  style?: any;
  borderRadius?: number;
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E5E7EB',
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ----- Skeleton Loading Screen -----
const ArticleSkeleton = ({ insets }: { insets: { top: number; bottom: number } }) => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor={DEFAULT_PRIMARY} translucent={false} />
    
    {/* Header */}
    <LinearGradient
      colors={[DEFAULT_PRIMARY, '#0891b2']}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </View>
      <SkeletonBox width={150} height={20} style={{ marginLeft: 12 }} borderRadius={6} />
      <View style={{ flex: 1 }} />
    </LinearGradient>

    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Cover Image Skeleton */}
      <SkeletonBox width="100%" height={220} borderRadius={0} />

      {/* Status Row */}
      <View style={styles.statusRow}>
        <SkeletonBox width={100} height={24} borderRadius={8} />
        <SkeletonBox width={80} height={20} borderRadius={6} />
      </View>

      {/* Content Skeleton */}
      <View style={styles.articleContent}>
        {/* Title */}
        <SkeletonBox width="100%" height={28} style={{ marginBottom: 8 }} />
        <SkeletonBox width="85%" height={28} style={{ marginBottom: 16 }} />

        {/* Subtitle */}
        <SkeletonBox width="100%" height={18} style={{ marginBottom: 6 }} />
        <SkeletonBox width="70%" height={18} style={{ marginBottom: 16 }} />

        {/* Dateline */}
        <SkeletonBox width={200} height={14} style={{ marginBottom: 20 }} />

        {/* Points Container */}
        <View style={[styles.pointsContainer, { backgroundColor: '#F3F4F6' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <SkeletonBox width={8} height={8} borderRadius={4} style={{ marginRight: 10 }} />
            <SkeletonBox width="85%" height={16} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <SkeletonBox width={8} height={8} borderRadius={4} style={{ marginRight: 10 }} />
            <SkeletonBox width="75%" height={16} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <SkeletonBox width={8} height={8} borderRadius={4} style={{ marginRight: 10 }} />
            <SkeletonBox width="90%" height={16} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonBox width={8} height={8} borderRadius={4} style={{ marginRight: 10 }} />
            <SkeletonBox width="60%" height={16} />
          </View>
        </View>

        {/* Content paragraphs */}
        <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="95%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="80%" height={16} style={{ marginBottom: 16 }} />

        <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="90%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="70%" height={16} style={{ marginBottom: 20 }} />

        {/* Web Link Card Skeleton */}
        <View style={[styles.webLinkCard, { backgroundColor: '#F3F4F6' }]}>
          <SkeletonBox width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1 }}>
            <SkeletonBox width={100} height={14} style={{ marginBottom: 6 }} />
            <SkeletonBox width={180} height={12} />
          </View>
        </View>

        {/* Meta Card Skeleton */}
        <View style={styles.metaCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <SkeletonBox width={16} height={16} borderRadius={4} style={{ marginRight: 8 }} />
            <SkeletonBox width={60} height={14} style={{ marginRight: 8 }} />
            <SkeletonBox width={140} height={14} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <SkeletonBox width={16} height={16} borderRadius={4} style={{ marginRight: 8 }} />
            <SkeletonBox width={60} height={14} style={{ marginRight: 8 }} />
            <SkeletonBox width={140} height={14} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonBox width={16} height={16} borderRadius={4} style={{ marginRight: 8 }} />
            <SkeletonBox width={60} height={14} style={{ marginRight: 8 }} />
            <SkeletonBox width={100} height={14} />
          </View>
        </View>
      </View>
    </ScrollView>

    {/* Action Bar Skeleton */}
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
      <SkeletonBox width="25%" height={44} borderRadius={10} />
      <SkeletonBox width="30%" height={44} borderRadius={10} />
      <SkeletonBox width="30%" height={44} borderRadius={10} />
    </View>
  </View>
);

// Status colors with Telugu labels
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string; teluguLabel: string; icon: string }> = {
  DRAFT: { bg: '#E5E7EB', text: '#6B7280', label: 'Draft', teluguLabel: 'డ్రాఫ్ట్', icon: 'document-text-outline' },
  PENDING: { bg: '#FEF3C7', text: '#D97706', label: 'Pending Review', teluguLabel: 'సమీక్షలో ఉంది', icon: 'time-outline' },
  PUBLISHED: { bg: '#D1FAE5', text: '#059669', label: 'Published', teluguLabel: 'ప్రచురించబడింది', icon: 'checkmark-circle' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected', teluguLabel: 'తిరస్కరించబడింది', icon: 'close-circle' },
  ARCHIVED: { bg: '#E5E7EB', text: '#6B7280', label: 'Archived', teluguLabel: 'ఆర్కైవ్', icon: 'archive-outline' },
};

export default function ReporterArticleDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<NewspaperArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Session/reporter data for share as image
  const [session, setSession] = useState<SessionData | null>(null);
  const [reporter, setReporter] = useState<ReporterMeResponse | null>(null);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);

  // Share as image
  const shareImageRef = useRef<ShareableArticleImageRef>(null);
  const [shareArticle, setShareArticle] = useState<ShareableArticleData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  // Toast for copy feedback
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Load session data
  useEffect(() => {
    (async () => {
      try {
        const tokens = await loadTokens();
        if ((tokens as any)?.session) {
          setSession((tokens as any).session);
          
          // Extract tenant primary color from domainSettings
          const domainSettings = (tokens as any).session?.domainSettings;
          const colors = domainSettings?.data?.theme?.colors;
          if (colors) {
            const pColor = colors.primary || colors.accent;
            if (isValidHexColor(pColor)) setPrimaryColor(pColor);
          }
        }
        // Also load reporter from API for latest data
        const reporterData = await getReporterMe();
        setReporter(reporterData);
      } catch (e) {
        console.log('[ArticleDetail] Failed to load session/reporter:', e);
      }
    })();
  }, []);

  // Load article
  const loadArticle = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getNewspaperArticleById(id);
      setArticle(data);
      setEditTitle(data.title || '');
      setEditSubtitle(data.subTitle || '');
      setEditContent(data.content || '');
    } catch (e: any) {
      console.error('[ArticleDetail] Load failed:', e);
      setError(e?.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  // Share article - directly share as image for published, link for others
  const handleShare = async () => {
    const isPublished = article?.status === 'PUBLISHED';

    // For published articles, directly share as image
    if (isPublished) {
      handleShareAsImage();
      return;
    }

    // For non-published articles, share link if available
    const shareUrl = article?.sportLink || article?.webArticleUrl;
    if (!shareUrl) {
      Alert.alert('అందుబాటులో లేదు', 'ఈ ఆర్టికల్ ఇంకా ప్రచురించబడలేదు. ప్రచురించిన తర్వాత షేర్ చేయవచ్చు.');
      return;
    }

    try {
      await Share.share(
        Platform.OS === 'android'
          ? { message: `${article?.title}\n\n${shareUrl}` }
          : { message: `${article?.title}\n\n${shareUrl}`, url: shareUrl, title: article?.title || 'Article' }
      );
    } catch (error: any) {
      console.error('[ArticleDetail] Share error:', error);
    }
  };
  
  // Copy link to clipboard
  const handleCopyLink = async () => {
    const shareUrl = article?.sportLink || article?.webArticleUrl;
    if (!shareUrl) {
      Alert.alert('లింక్ లేదు', 'ఈ ఆర్టికల్ ఇంకా ప్రచురించబడలేదు.');
      return;
    }
    
    try {
      await Clipboard.setStringAsync(shareUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (e) {
      console.error('[ArticleDetail] Copy failed:', e);
    }
  };

  // Share as image
  const handleShareAsImage = async () => {
    if (!article) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Get cover image URL
    const coverImageUrl = article.baseArticle?.contentJson?.raw?.coverImageUrl || 
      (article.baseArticle?.contentJson?.raw?.images?.[0]);
    
    // Convert to ShareableArticleData
    const shareData: ShareableArticleData = {
      id: article.id,
      title: article.title || '',
      subTitle: article.subTitle,
      lead: article.lead,
      points: article.points,
      content: article.content,
      coverImageUrl,
      webArticleUrl: article.sportLink || article.webArticleUrl,
      reporter: {
        id: reporter?.id,
        fullName: reporter?.fullName || session?.user?.name,
        profilePhotoUrl: reporter?.profilePhotoUrl || undefined,
        designation: reporter?.designation ? { name: reporter.designation.name } : undefined,
        level: reporter?.level ? { name: reporter.level } : undefined,
        district: reporter?.district ? { name: reporter.district.name } : undefined,
        mandal: reporter?.mandal ? { name: reporter.mandal.name } : undefined,
      },
    };
    setShareArticle(shareData);
    
    // Call captureAndShare directly - it will show style picker
    if (shareImageRef.current) {
      try {
        console.log('[ArticleDetail] Starting image share...');
        await shareImageRef.current.captureAndShare();
        console.log('[ArticleDetail] Share completed');
      } catch (e) {
        console.error('[ArticleDetail] Share failed:', e);
        Alert.alert('షేర్ విఫలమైంది', 'షేర్ చేయడంలో సమస్య. మళ్ళీ ప్రయత్నించండి.');
      }
    } else {
      console.error('[ArticleDetail] shareImageRef is null');
      Alert.alert('షేర్ విఫలమైంది', 'దయచేసి మళ్ళీ ప్రయత్నించండి.');
    }
  };

  // Open web article
  const handleOpenWeb = () => {
    const url = article?.sportLink || article?.webArticleUrl;
    if (url) {
      Linking.openURL(url);
    }
  };

  // Start edit mode
  const handleStartEdit = () => {
    if (article?.status === 'PUBLISHED') {
      Alert.alert(
        'మార్పులు చేయలేరు',
        'ప్రచురించిన ఆర్టికల్స్ మార్చడానికి మీ ఎడిటర్‌ని సంప్రదించండి.',
        [{ text: 'సరే' }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditMode(true);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditTitle(article?.title || '');
    setEditSubtitle(article?.subTitle || '');
    setEditContent(article?.content || '');
    setEditMode(false);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!id || !editTitle.trim()) {
      Alert.alert('లోపం', 'టైటిల్ తప్పనిసరి');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload: UpdateNewspaperArticlePayload = {
        title: editTitle.trim(),
        subTitle: editSubtitle.trim() || undefined,
        content: editContent.trim() || undefined,
      };
      
      await updateNewspaperArticle(id, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('విజయం! ✅', 'ఆర్టికల్ అప్‌డేట్ అయింది');
      setEditMode(false);
      loadArticle(); // Reload to get updated data
    } catch (e: any) {
      console.error('[ArticleDetail] Update failed:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('లోపం', e?.message || 'అప్‌డేట్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.');
    } finally {
      setSaving(false);
    }
  };

  // Delete article
  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await deleteNewspaperArticle(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('తొలగించబడింది ✅', 'ఆర్టికల్ తొలగించబడింది', [
        { text: 'సరే', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error('[ArticleDetail] Delete failed:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('లోపం', e?.message || 'తొలగించడం విఫలమైంది');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Confirm delete
  const confirmDelete = () => {
    if (article?.status === 'PUBLISHED') {
      Alert.alert(
        'తొలగించలేరు',
        'ప్రచురించిన ఆర్టికల్స్ తొలగించడానికి మీ ఎడిటర్‌ని సంప్రదించండి.',
        [{ text: 'సరే' }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteModal(true);
  };

  const statusColors = STATUS_COLORS[article?.status || 'DRAFT'];

  // Loading state - show skeleton
  if (loading) {
    return <ArticleSkeleton insets={insets} />;
  }

  // Error state
  if (error || !article) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
        <View style={styles.errorIconBox}>
          <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
        </View>
        <Text style={styles.errorTitle}>ఆర్టికల్ లోడ్ కాలేదు</Text>
        <Text style={styles.errorText}>{error || 'ఆర్టికల్ కనుగొనబడలేదు'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadArticle}>
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={styles.retryBtnText}>మళ్ళీ ప్రయత్నించండి</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLinkBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={primaryColor} />
          <Text style={styles.backLinkText}>వెనక్కి వెళ్ళు</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get cover image URL
  const coverImageUrl = article.baseArticle?.contentJson?.raw?.coverImageUrl || 
    (article.baseArticle?.contentJson?.raw?.images?.[0]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} translucent={false} />

      {/* Share Image Component - Always rendered for ref to be valid */}
      <ShareableArticleImage
        ref={shareImageRef}
        article={shareArticle || {
          id: '',
          title: '',
        }}
        tenantName={session?.tenant?.name}
        tenantPrimaryColor={primaryColor}
        visible={!!shareArticle}
      />

      {/* Sharing overlay */}
      {isSharing && (
        <View style={styles.sharingOverlay}>
          <View style={styles.sharingBox}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.sharingText}>ఇమేజ్ తయారవుతోంది...</Text>
            <Text style={styles.sharingSubtext}>దయచేసి వేచి ఉండండి</Text>
          </View>
        </View>
      )}
      
      {/* Copied Toast */}
      {showCopiedToast && (
        <View style={styles.copiedToast}>
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.copiedToastText}>లింక్ కాపీ అయింది!</Text>
        </View>
      )}

      {/* Header */}
      <LinearGradient
        colors={[primaryColor, '#0891b2']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editMode ? 'ఆర్టికల్ ఎడిట్ చేయండి' : 'ఆర్టికల్ వివరాలు'}
        </Text>
        <View style={styles.headerActions}>
          {!editMode && article?.status === 'PUBLISHED' && (
            <TouchableOpacity onPress={handleShareAsImage} style={styles.headerShareBtn}>
              <Ionicons name="share-social" size={18} color="#FFF" />
              <Text style={styles.headerShareText}>షేర్</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover Image */}
          {coverImageUrl && !editMode && (
            <View style={styles.coverImageContainer}>
              <Image
                source={{ uri: coverImageUrl }}
                style={styles.coverImage}
                contentFit="cover"
              />
            </View>
          )}

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Ionicons name={statusColors.icon as any} size={14} color={statusColors.text} />
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {statusColors.teluguLabel}
              </Text>
            </View>
            {article.viewCount !== undefined && (
              <View style={styles.viewsRow}>
                <Ionicons name="eye-outline" size={16} color="#6B7280" />
                <Text style={styles.viewsText}>{article.viewCount} చూసారు</Text>
              </View>
            )}
          </View>

          {/* Content */}
          {editMode ? (
            // Edit Mode
            <View style={styles.editForm}>
              <View style={styles.editHeader}>
                <Ionicons name="create-outline" size={24} color={primaryColor} />
                <Text style={styles.editHeaderText}>ఆర్టికల్ ఎడిట్ చేయండి</Text>
              </View>
              
              <Text style={styles.inputLabel}>టైటిల్ *</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="వార్త టైటిల్ రాయండి"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.inputLabel}>సబ్‌టైటిల్</Text>
              <TextInput
                style={styles.input}
                value={editSubtitle}
                onChangeText={setEditSubtitle}
                placeholder="సబ్‌టైటిల్ రాయండి (ఐచ్ఛికం)"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.inputLabel}>వివరాలు</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="వార్త వివరాలు రాయండి"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />
              
              <View style={styles.editHelpBox}>
                <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
                <Text style={styles.editHelpText}>
                  మార్పులు చేసిన తర్వాత "సేవ్ చేయండి" నొక్కండి
                </Text>
              </View>
            </View>
          ) : (
            // View Mode
            <View style={styles.articleContent}>
              <Text style={styles.articleTitle}>{article.title}</Text>
              
              {article.subTitle && (
                <Text style={styles.articleSubtitle}>{article.subTitle}</Text>
              )}

              {article.dateline && (
                <Text style={styles.dateline}>{article.dateline}</Text>
              )}

              {/* Bullet Points */}
              {article.points && article.points.length > 0 && (
                <View style={styles.pointsContainer}>
                  {article.points.map((point, index) => (
                    <View key={index} style={styles.pointRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Content */}
              {article.content && (
                <Text style={styles.contentText}>{article.content}</Text>
              )}

              {/* Sport Link Card - Prominent for sharing */}
              {(article.sportLink || article.webArticleUrl) && (
                <View style={styles.sportLinkSection}>
                  <Text style={styles.sectionTitle}>
                    <Ionicons name="link" size={16} color={primaryColor} /> వెబ్ లింక్
                  </Text>
                  <View style={styles.sportLinkCard}>
                    <View style={styles.sportLinkHeader}>
                      <View style={styles.sportLinkIcon}>
                        <MaterialCommunityIcons name="web" size={24} color="#FFF" />
                      </View>
                      <View style={styles.sportLinkInfo}>
                        <Text style={styles.sportLinkDomain}>
                          {article.sportLinkDomain || 'kaburlumedia.com'}
                        </Text>
                        <Text style={styles.sportLinkUrl} numberOfLines={2}>
                          {article.sportLink || article.webArticleUrl}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.sportLinkActions}>
                      <TouchableOpacity 
                        style={styles.sportLinkBtn}
                        onPress={handleCopyLink}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={18} color={primaryColor} />
                        <Text style={styles.sportLinkBtnText}>కాపీ</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.sportLinkBtn}
                        onPress={handleOpenWeb}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="open-outline" size={18} color={primaryColor} />
                        <Text style={styles.sportLinkBtnText}>ఓపెన్</Text>
                      </TouchableOpacity>
                      
                      {article.status !== 'PENDING' && (
                        <TouchableOpacity 
                          style={[styles.sportLinkBtn, styles.sportLinkShareBtn]}
                          onPress={handleShare}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="share-social" size={18} color="#FFF" />
                          <Text style={[styles.sportLinkBtnText, { color: '#FFF' }]}>షేర్</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Metadata */}
              <View style={styles.metaCard}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="information-circle-outline" size={16} color="#6B7280" /> వివరాలు
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaLabel}>సృష్టించిన తేది:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(article.createdAt).toLocaleDateString('te-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {article.updatedAt && (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text style={styles.metaLabel}>అప్‌డేట్:</Text>
                    <Text style={styles.metaValue}>
                      {new Date(article.updatedAt).toLocaleDateString('te-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
                {article.placeName && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.metaLabel}>ప్రదేశం:</Text>
                    <Text style={styles.metaValue}>{article.placeName}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {editMode ? (
          // Edit mode actions
          <View style={styles.actionBtnRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
              <Text style={styles.cancelBtnText}>రద్దు</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.saveBtn]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={22} color="#FFF" />
                  <Text style={styles.saveBtnText}>సేవ్ చేయండి</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // View mode actions - Large, beginner-friendly buttons
          <View style={styles.actionBtnContainer}>
            {/* Row 1: Delete and Edit */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={confirmDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={styles.deleteBtnText}>తొలగించు</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={handleStartEdit}
              >
                <Feather name="edit-2" size={18} color="#FFF" />
                <Text style={styles.editBtnText}>ఎడిట్</Text>
              </TouchableOpacity>
            </View>
            
            {/* Row 2: Web view and Share (only for published) */}
            {article?.status === 'PUBLISHED' && (
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.webBtn]}
                  onPress={handleOpenWeb}
                >
                  <Ionicons name="globe-outline" size={20} color="#FFF" />
                  <Text style={styles.webBtnText}>వెబ్‌లో చూడండి</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionBtn, styles.shareActionBtn]}
                  onPress={handleShare}
                >
                  <Ionicons name="share-social" size={20} color="#FFF" />
                  <Text style={styles.shareBtnText}>ఇమేజ్ షేర్</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Share for REJECTED status (single button centered) */}
            {article?.status === 'REJECTED' && (
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.shareActionBtn]}
                  onPress={handleShare}
                >
                  <Ionicons name="share-social" size={20} color="#FFF" />
                  <Text style={styles.shareBtnText}>షేర్</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={40} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>ఆర్టికల్ తొలగించాలా?</Text>
            <Text style={styles.modalMessage}>
              ఈ చర్యను వెనక్కి తీసుకోలేరు. ఆర్టికల్ శాశ్వతంగా తొలగించబడుతుంది.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>వద్దు, ఉంచు</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalDeleteBtn]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#FFF" />
                    <Text style={styles.modalDeleteText}>తొలగించు</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 24,
  },
  errorIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DEFAULT_PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 15,
    color: DEFAULT_PRIMARY,
    fontWeight: '500',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerShareText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingBottom: 20,
  },

  // Cover Image
  coverImageContainer: {
    width: '100%',
    height: 220,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Article Content
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    lineHeight: 30,
    marginBottom: 8,
  },
  articleSubtitle: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 12,
  },
  dateline: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  pointsContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginTop: 7,
    marginRight: 10,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  contentText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
  },

  // Section Title
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },

  // Sport Link Section - Prominent
  sportLinkSection: {
    marginBottom: 16,
  },
  sportLinkCard: {
    backgroundColor: '#E0F7FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B2EBF2',
  },
  sportLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sportLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: DEFAULT_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportLinkInfo: {
    flex: 1,
  },
  sportLinkDomain: {
    fontSize: 15,
    fontWeight: '700',
    color: '#006064',
    marginBottom: 2,
  },
  sportLinkUrl: {
    fontSize: 12,
    color: '#00838F',
  },
  sportLinkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sportLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B2EBF2',
  },
  sportLinkBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DEFAULT_PRIMARY,
  },
  sportLinkShareBtn: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  // Legacy Web Link Card (fallback)
  webLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  webLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webLinkInfo: {
    flex: 1,
  },
  webLinkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DEFAULT_PRIMARY,
    marginBottom: 2,
  },
  webLinkUrl: {
    fontSize: 12,
    color: '#0891B2',
  },

  // Meta Card
  metaCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 100,
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    fontWeight: '500',
  },

  // Edit Form
  editForm: {
    padding: 16,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
    minHeight: 52,
  },
  contentInput: {
    minHeight: 180,
  },
  editHelpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  editHelpText: {
    flex: 1,
    fontSize: 13,
    color: '#0369A1',
  },

  // Action Bar
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtnContainer: {
    gap: 10,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
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
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  editBtn: {
    backgroundColor: '#8B5CF6',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  webBtn: {
    backgroundColor: DEFAULT_PRIMARY,
  },
  webBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  shareActionBtn: {
    backgroundColor: '#10B981',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: DEFAULT_PRIMARY,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalCancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalDeleteBtn: {
    backgroundColor: '#DC2626',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  
  // Sharing overlay
  sharingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  sharingBox: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    minWidth: 200,
  },
  sharingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sharingSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  // Copied Toast
  copiedToast: {
    position: 'absolute',
    bottom: 120,
    left: '50%',
    transform: [{ translateX: -75 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  copiedToastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
