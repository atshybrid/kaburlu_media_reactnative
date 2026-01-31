/**
 * Reporter Dashboard - Redesigned
 * Uses primary color from domainSettings, shows reporter level/designation/work area
 * Focuses on article list with status tabs (Pending, Published, Rejected)
 */
import ShareableArticleImage, { type ShareableArticleData, type ShareableArticleImageRef } from '@/components/ShareableArticleImage';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import {
    getMyNewspaperArticles,
    getReporterMe,
    type MyNewspaperArticle,
    type NewspaperArticleStatus,
    type ReporterMeResponse,
} from '@/services/reporters';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

// Primary color from domainSettings
const PRIMARY_COLOR = '#109edc';

// Status tabs
type TabType = 'ALL' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'DRAFT';
const TABS: { key: TabType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'REJECTED', label: 'Rejected' },
];

// Badge colors for status
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#D97706' },
  PUBLISHED: { bg: '#D1FAE5', text: '#059669' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  DRAFT: { bg: '#E5E7EB', text: '#6B7280' },
  ARCHIVED: { bg: '#E5E7EB', text: '#6B7280' },
};

// Helper to format date
function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 30) {
      return date.toLocaleDateString();
    } else if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHrs > 0) {
      return `${diffHrs}h ago`;
    } else if (diffMin > 0) {
      return `${diffMin}m ago`;
    } else {
      return 'Just now';
    }
  } catch {
    return '';
  }
}

// Session type from login response
type SessionData = {
  reporter?: {
    id?: string;
    tenantId?: string;
    userId?: string;
    level?: string;
    designation?: { id?: string; code?: string; name?: string; level?: string } | string;
    profilePhoto?: string;
    contact?: { email?: string; phone?: string };
    user?: { id?: string; name?: string; email?: string; mobileNumber?: string };
    state?: { id?: string; name?: string };
    district?: { id?: string; name?: string };
    mandal?: { id?: string; name?: string };
  };
  tenant?: { id?: string; name?: string };
  domainSettings?: {
    data?: {
      theme?: { colors?: { primary?: string; secondary?: string } };
    };
  };
  user?: {
    id?: string;
    name?: string;
    mobileNumber?: string;
    role?: string;
  };
};

// KYC Status colors
const KYC_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  APPROVED: { label: 'Verified', color: '#059669', bg: '#D1FAE5', icon: 'shield-checkmark' },
  SUBMITTED: { label: 'Under Review', color: '#D97706', bg: '#FEF3C7', icon: 'time' },
  PENDING: { label: 'Pending', color: '#8B5CF6', bg: '#EDE9FE', icon: 'alert-circle' },
  REJECTED: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle' },
};

// ----- Article Card Component -----
interface ArticleCardProps {
  article: MyNewspaperArticle;
  onPress: () => void;
  onShareAsImage?: (article: MyNewspaperArticle) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onPress, onShareAsImage }) => {
  const statusColors = STATUS_COLORS[article.status] || STATUS_COLORS.DRAFT;

  // Get cover image with multiple fallbacks
  const coverImage = article.coverImageUrl 
    || article.imageUrl
    || article.coverImage
    || article.thumbnailUrl
    || article.baseArticle?.contentJson?.raw?.coverImageUrl
    || article.baseArticle?.contentJson?.raw?.images?.[0]
    || null;
  
  // Debug log if no image found (remove after debugging)
  if (!coverImage && __DEV__) {
    console.log('[ArticleCard] No cover image found for article:', {
      id: article.id,
      title: article.title?.substring(0, 30),
      coverImageUrl: article.coverImageUrl,
      hasBaseArticle: !!article.baseArticle,
    });
  }

  const handleWebUrlPress = () => {
    if (article.webArticle?.url) {
      Linking.openURL(article.webArticle.url);
    }
  };

  // Direct share - image for published, link for others
  const handleShare = async () => {
    // For published articles with share handler, directly share as image
    if (onShareAsImage) {
      onShareAsImage(article);
      return;
    }

    // Fallback to link share
    const shareUrl = article.sportLink || article.webArticle?.url || article.webArticleUrl;
    if (!shareUrl) {
      Alert.alert('Not Available', 'Share link is not available for this article.');
      return;
    }

    try {
      await Share.share(
        Platform.OS === 'android'
          ? { message: `${article.title}\n\n${shareUrl}` }
          : { message: `${article.title}\n\n${shareUrl}`, url: shareUrl, title: article.title }
      );
    } catch (error: any) {
      console.error('[Dashboard] Share error:', error);
    }
  };

  const formattedDate = useMemo(() => formatTimeAgo(article.createdAt), [article.createdAt]);

  // Check if share is available
  const shareUrl = article.sportLink || article.webArticle?.url || article.webArticleUrl;
  const canShare = (!!shareUrl || !!onShareAsImage) && article.status === 'PUBLISHED';

  return (
    <TouchableOpacity style={styles.articleCard} onPress={onPress} activeOpacity={0.7}>
      {/* Left Image */}
      <View style={styles.articleImageContainer}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={styles.articleImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.articleImage, styles.noImage]}>
            <Ionicons name="newspaper-outline" size={32} color="#9CA3AF" />
          </View>
        )}
        
        {/* Share button overlay on image */}
        {canShare && (
          <TouchableOpacity
            style={styles.shareOverlay}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social" size={16} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Right Content */}
      <View style={styles.articleContent}>
        {/* Title */}
        <Text style={styles.articleTitle} numberOfLines={2}>
          {article.title}
        </Text>

        {/* Subtitle */}
        <Text style={styles.articleSubtitle} numberOfLines={1}>
          {article.subTitle || 'No description available'}
        </Text>

        {/* Status, Date, Views row */}
        <View style={styles.articleMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {article.status}
            </Text>
          </View>
          <Text style={styles.articleDate}>{formattedDate}</Text>
          {article.viewCount !== undefined && (
            <View style={styles.viewsContainer}>
              <Ionicons name="eye-outline" size={12} color="#6B7280" />
              <Text style={styles.viewsText}>{article.viewCount}</Text>
            </View>
          )}
        </View>

        {/* Sport Link / Web URL with share */}
        {shareUrl && (
          <View style={styles.sportLinkRow}>
            <TouchableOpacity
              style={styles.sportLinkBtn}
              onPress={handleWebUrlPress}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={14} color={PRIMARY_COLOR} />
              <Text style={styles.sportLinkText} numberOfLines={1}>
                {article.sportLinkDomain || 'View on web'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={16} color="#FFF" />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ----- Main Dashboard Component -----
export default function ReporterDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [articles, setArticles] = useState<MyNewspaperArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    published: 0,
    rejected: 0,
  });

  // Session data loaded from tokens
  const [session, setSession] = useState<SessionData | null>(null);
  
  // Reporter data from /reporters/me API
  const [reporter, setReporter] = useState<ReporterMeResponse | null>(null);

  // Share as image state
  const shareImageRef = useRef<ShareableArticleImageRef>(null);
  const [shareArticle, setShareArticle] = useState<ShareableArticleData | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Get session reporter for fallback
  const sessionReporter = session?.reporter;
  const tenant = session?.tenant;

  // KYC Status check - only show warning AFTER reporter data is loaded to prevent flicker
  const kycStatus = reporter?.kycStatus;
  const isKycApproved = kycStatus === 'APPROVED';
  // Only show KYC banner if reporter is loaded AND KYC is not approved
  const showKycBanner = reporter !== null && !isKycApproved;
  const kycMeta = KYC_STATUS_META[kycStatus || 'PENDING'] || KYC_STATUS_META.PENDING;

  // Get designation name
  const designationName = reporter?.designation?.name || 
    (typeof sessionReporter?.designation === 'string' 
      ? sessionReporter.designation 
      : sessionReporter?.designation?.name);
  
  const reporterLevel = reporter?.level || sessionReporter?.level;

  // Build work area string based on level
  const workArea = useMemo(() => {
    // Based on level, show appropriate location
    const level = reporter?.level || sessionReporter?.level;
    
    if (level === 'STATE' && reporter?.state?.name) {
      return reporter.state.name;
    }
    if (level === 'DISTRICT') {
      const parts: string[] = [];
      if (reporter?.district?.name) parts.push(reporter.district.name);
      if (reporter?.state?.name) parts.push(reporter.state.name);
      return parts.join(', ') || 'Not assigned';
    }
    if (level === 'MANDAL') {
      const parts: string[] = [];
      if (reporter?.mandal?.name) parts.push(reporter.mandal.name);
      if (reporter?.district?.name) parts.push(reporter.district.name);
      return parts.join(', ') || 'Not assigned';
    }
    if (level === 'ASSEMBLY') {
      const parts: string[] = [];
      if (reporter?.assemblyConstituency?.name) parts.push(reporter.assemblyConstituency.name);
      if (reporter?.state?.name) parts.push(reporter.state.name);
      return parts.join(', ') || 'Not assigned';
    }
    
    // Fallback - show all available
    const parts: string[] = [];
    if (reporter?.mandal?.name) parts.push(reporter.mandal.name);
    if (reporter?.district?.name) parts.push(reporter.district.name);
    if (reporter?.state?.name) parts.push(reporter.state.name);
    // Fallback to session data
    if (parts.length === 0 && sessionReporter) {
      if (sessionReporter.mandal?.name) parts.push(sessionReporter.mandal.name);
      if (sessionReporter.district?.name) parts.push(sessionReporter.district.name);
      if (sessionReporter.state?.name) parts.push(sessionReporter.state.name);
    }
    return parts.join(', ') || 'Not assigned';
  }, [reporter, sessionReporter]);

  // Load session from tokens
  const loadSession = useCallback(async () => {
    try {
      const tokens = await loadTokens();
      const sess = (tokens as any)?.session as SessionData | undefined;
      if (sess) {
        setSession(sess);
      }
    } catch (e) {
      console.error('[Dashboard] Failed to load session:', e);
    }
  }, []);

  // Load reporter profile from /reporters/me API
  const loadReporter = useCallback(async () => {
    try {
      const data = await getReporterMe();
      setReporter(data);
      // Also update stats from reporter response if available
      if (data.stats?.newspaperArticles) {
        const total = data.stats.newspaperArticles.total;
        setStats({
          total: (total?.submitted || 0) + (total?.published || 0) + (total?.rejected || 0),
          pending: total?.submitted || 0,
          published: total?.published || 0,
          rejected: total?.rejected || 0,
        });
      }
    } catch (e) {
      console.error('[Dashboard] Failed to load reporter:', e);
    }
  }, []);

  // Load articles
  const loadArticles = useCallback(
    async (cursor?: string | null, refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
          setPage(1);
          setNextCursor(null);
        } else if (!cursor) {
          setLoading(true);
          setPage(1);
          setNextCursor(null);
        } else {
          setLoadingMore(true);
        }

        const status: NewspaperArticleStatus | undefined =
          activeTab === 'ALL' ? undefined : (activeTab as NewspaperArticleStatus);

        const response = await getMyNewspaperArticles({
          limit: 10,
          cursor: cursor || undefined,
          status,
        });

        if (response.data) {
          if (!cursor || refresh) {
            setArticles(response.data);
          } else {
            setArticles((prev) => [...prev, ...response.data]);
          }

          const nc = response.nextCursor ?? null;
          setNextCursor(nc);
          setHasMore(!!nc);
          if (cursor && !refresh) setPage((p) => p + 1);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to load articles:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  // Initial load and on tab change
  useFocusEffect(
    useCallback(() => {
      loadSession();
      loadReporter();
      loadArticles(null, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, loadArticles, loadReporter, loadSession])
  );

  // Refresh handler
  const onRefresh = useCallback(() => {
    setPage(1);
    setNextCursor(null);
    loadReporter();
    loadArticles(null, true);
  }, [loadArticles, loadReporter]);

  // Load more handler
  const onLoadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && hasMore && nextCursor) {
      loadArticles(nextCursor);
    }
  }, [loading, refreshing, loadingMore, hasMore, nextCursor, loadArticles]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setArticles([]);
    setNextCursor(null);
    setHasMore(true);
  };

  // Navigation handlers
  const goToPostArticle = useCallback(() => router.push('/post-news' as any), [router]);
  const goToKyc = useCallback(() => router.push('/reporter/kyc'), [router]);
  const goToIdCard = useCallback(() => router.push('/reporter/id-card' as any), [router]);
  const goToProfile = useCallback(() => router.push('/reporter/profile'), [router]);
  const goToArticleDetail = useCallback((id: string) => router.push(`/reporter/article/${id}` as any), [router]);
  const goToSettings = useCallback(() => router.push('/settings' as any), [router]);

  // Handle share as image
  const handleShareAsImage = useCallback(async (article: MyNewspaperArticle) => {
    // Convert to ShareableArticleData
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
        fullName: reporter?.fullName || session?.user?.name,
        profilePhotoUrl: reporter?.profilePhotoUrl || undefined,
        designation: reporter?.designation ? { name: reporter.designation.name } : undefined,
        level: reporter?.level ? { name: reporter.level } : undefined,
        district: reporter?.district ? { name: reporter.district.name } : undefined,
        mandal: reporter?.mandal ? { name: reporter.mandal.name } : undefined,
      },
    };
    setShareArticle(shareData);
    
    // Wait for component to render and images to load, then capture
    // The ShareableArticleImage component handles waiting for images internally
    setTimeout(async () => {
      if (shareImageRef.current) {
        setIsSharing(true);
        try {
          console.log('[Dashboard] Starting image capture...');
          await shareImageRef.current.captureAndShare();
          console.log('[Dashboard] Image capture completed');
        } catch (e) {
          console.error('[Dashboard] Share image failed:', e);
          Alert.alert('Share Failed', 'Unable to generate share image');
        } finally {
          setIsSharing(false);
          setShareArticle(null);
        }
      } else {
        console.error('[Dashboard] shareImageRef is null');
        setIsSharing(false);
        setShareArticle(null);
      }
    }, 800); // Increased timeout for component mount
  }, [reporter, session]);

  // Render article item
  const renderArticle = useCallback(
    ({ item }: { item: MyNewspaperArticle }) => (
      <ArticleCard 
        article={item} 
        onPress={() => goToArticleDetail(item.id)} 
        onShareAsImage={item.status === 'PUBLISHED' ? handleShareAsImage : undefined}
      />
    ),
    [goToArticleDetail, handleShareAsImage]
  );

  const keyExtractor = useCallback((item: MyNewspaperArticle) => item.id, []);

  // Empty list component
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={64} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>No articles found</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'ALL'
            ? 'Start by posting your first article'
            : `No ${activeTab.toLowerCase()} articles`}
        </Text>
        {activeTab === 'ALL' && (
          <TouchableOpacity style={styles.emptyButton} onPress={goToPostArticle}>
            <Text style={styles.emptyButtonText}>Post Article</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [activeTab, goToPostArticle]
  );

  // Footer loader
  const ListFooterComponent = useMemo(
    () =>
      loadingMore ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={PRIMARY_COLOR} />
        </View>
      ) : null,
    [loadingMore]
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111' : '#F3F4F6' }]}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} translucent={false} />
      
      {/* Share Image Component (hidden, used for capture) */}
      {shareArticle && (
        <ShareableArticleImage
          ref={shareImageRef}
          article={shareArticle}
          tenantName={tenant?.name}
          visible={true}
        />
      )}

      {/* Sharing overlay */}
      {isSharing && (
        <View style={styles.sharingOverlay}>
          <View style={styles.sharingBox}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.sharingText}>Generating image...</Text>
          </View>
        </View>
      )}
      
      {/* KYC Warning Banner - only show AFTER reporter data is loaded and KYC is not approved */}
      {showKycBanner && (
        <TouchableOpacity 
          style={[styles.kycBanner, { paddingTop: insets.top + 8 }]} 
          onPress={goToKyc}
          activeOpacity={0.8}
        >
          <View style={styles.kycBannerContent}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <View style={styles.kycBannerText}>
              <Text style={styles.kycBannerTitle}>
                {kycStatus === 'REJECTED' ? 'KYC Rejected' : 'KYC Verification Required'}
              </Text>
              <Text style={styles.kycBannerSubtitle}>
                {kycStatus === 'REJECTED' 
                  ? 'Your KYC was rejected. Please resubmit.'
                  : 'Complete your KYC to access all features'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#DC2626" />
          </View>
        </TouchableOpacity>
      )}

      {/* Header with gradient */}
      <LinearGradient
        colors={[PRIMARY_COLOR, '#0891b2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Profile row */}
        <View style={styles.headerTop}>
          {/* Profile photo */}
          <TouchableOpacity onPress={goToProfile} style={styles.profileImageContainer}>
            {reporter?.profilePhotoUrl ? (
              <Image
                source={{ uri: reporter.profilePhotoUrl }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.profileImage, styles.profilePlaceholder]}>
                <Ionicons name="person" size={28} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Name, mobile, role info */}
          <View style={styles.headerInfo}>
            <Text style={styles.reporterName} numberOfLines={1}>
              {reporter?.fullName || session?.user?.name || 'Reporter'}
            </Text>
            {/* Mobile number */}
            {(reporter?.mobileNumber || session?.user?.mobileNumber) && (
              <View style={styles.mobileRow}>
                <Ionicons name="call-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.mobileText}>
                  {reporter?.mobileNumber || session?.user?.mobileNumber}
                </Text>
              </View>
            )}
            {/* Role badge */}
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {session?.user?.role || 'REPORTER'}
              </Text>
            </View>
          </View>

          {/* Home and Settings buttons */}
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerBtn} onPress={goToSettings}>
              <Ionicons name="settings-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Designation and Level row */}
        <View style={styles.designationLevelRow}>
          {designationName && (
            <View style={styles.designationBadge}>
              <Ionicons name="briefcase-outline" size={12} color="#FFF" />
              <Text style={styles.designationText}>{designationName}</Text>
            </View>
          )}
          {reporterLevel && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{reporterLevel}</Text>
            </View>
          )}
        </View>

        {/* State/Location row */}
        <View style={styles.workAreaRow}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.workAreaText}>{workArea}</Text>
        </View>

        {/* Auto Publish & KYC Status row */}
        <View style={styles.statusInfoRow}>
          {/* Auto Publish Status */}
          <View style={styles.autoPublishBadge}>
            <Ionicons 
              name={reporter?.autoPublish ? 'flash' : 'flash-off'} 
              size={12} 
              color={reporter?.autoPublish ? '#10B981' : '#F59E0B'} 
            />
            <Text style={[
              styles.autoPublishText,
              { color: reporter?.autoPublish ? '#10B981' : '#F59E0B' }
            ]}>
              Auto Publish: {reporter?.autoPublish ? 'ON' : 'OFF'}
            </Text>
          </View>
          
          {/* KYC Status */}
          <View style={[styles.kycStatusBadge, { backgroundColor: kycMeta.bg }]}>
            <Ionicons 
              name={kycMeta.icon as any} 
              size={12} 
              color={kycMeta.color} 
            />
            <Text style={[styles.kycStatusText, { color: kycMeta.color }]}>
              KYC: {kycMeta.label}
            </Text>
          </View>
        </View>

        {/* Tenant name */}
        {tenant?.name && (
          <Text style={styles.tenantName}>{tenant.name}</Text>
        )}
      </LinearGradient>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.published}</Text>
          <Text style={styles.statLabel}>Published</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={goToPostArticle}>
          <View style={[styles.actionIcon, { backgroundColor: PRIMARY_COLOR }]}>
            <Ionicons name="add" size={24} color="#FFF" />
          </View>
          <Text style={styles.actionLabel}>Post News</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={goToKyc}>
          <View style={[styles.actionIcon, { backgroundColor: '#8B5CF6' }]}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color="#FFF" />
          </View>
          <Text style={styles.actionLabel}>KYC</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={goToIdCard}>
          <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="card-outline" size={22} color="#FFF" />
          </View>
          <Text style={styles.actionLabel}>ID Card</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={goToProfile}>
          <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
            <Feather name="user" size={22} color="#FFF" />
          </View>
          <Text style={styles.actionLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => handleTabChange(tab.key)}
            >
              <Text
                style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Articles list */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading articles...</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderArticle}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
              tintColor={PRIMARY_COLOR}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  profilePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  reporterName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  mobileText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  designationLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  designationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  designationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  settingsBtn: {
    padding: 8,
  },
  workAreaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  workAreaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  autoPublishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  autoPublishText: {
    fontSize: 10,
    fontWeight: '600',
  },
  kycStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kycStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tenantName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },

  // KYC Banner
  kycBanner: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kycBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycBannerText: {
    flex: 1,
  },
  kycBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  kycBannerSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
  },

  // Tabs
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: 'relative',
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: PRIMARY_COLOR,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Article card
  articleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  articleImageContainer: {
    marginRight: 12,
  },
  articleImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  noImage: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleContent: {
    flex: 1,
    justifyContent: 'center',
  },
  articleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
    lineHeight: 20,
  },
  articleSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  articleDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewsText: {
    fontSize: 11,
    color: '#6B7280',
  },
  webUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  webUrlText: {
    flex: 1,
    fontSize: 11,
    color: PRIMARY_COLOR,
  },
  webViewCount: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  shareOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sportLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sportLinkText: {
    flex: 1,
    fontSize: 11,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  shareBtnText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // Sharing overlay
  sharingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sharingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  sharingText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});

