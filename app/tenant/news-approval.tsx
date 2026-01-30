/**
 * News Approval Screen - Tenant Admin/Editor
 * Review queue for pending newspaper articles with approve/reject actions
 */
import ShareableArticleImage, { type ShareableArticleData, type ShareableArticleImageRef } from '@/components/ShareableArticleImage';
import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import {
    approveNewspaperArticle,
    getNewspaperArticle,
    getNewspaperArticles,
    rejectNewspaperArticle,
    type NewspaperArticle,
    type NewspaperArticleStatus,
} from '@/services/tenantAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─────────────────────────────  Constants  ───────────────────────────── */

type TabType = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ALL';
const TABS: { key: TabType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'PENDING', label: 'Pending', icon: 'pending-actions' },
  { key: 'PUBLISHED', label: 'Approved', icon: 'check-circle' },
  { key: 'REJECTED', label: 'Rejected', icon: 'cancel' },
  { key: 'ALL', label: 'All', icon: 'list' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
  PUBLISHED: { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
  DRAFT: { bg: '#E5E7EB', text: '#6B7280', border: '#D1D5DB' },
  ARCHIVED: { bg: '#E5E7EB', text: '#6B7280', border: '#D1D5DB' },
};

const PAGE_SIZE = 20;

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

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function truncate(str: string | undefined, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function NewsApprovalScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string }>();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articles, setArticles] = useState<NewspaperArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const p = params.status?.toUpperCase();
    if (p === 'PENDING' || p === 'PUBLISHED' || p === 'REJECTED' || p === 'ALL') return p as TabType;
    return 'PENDING';
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewArticle, setPreviewArticle] = useState<NewspaperArticle | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Share state
  const [shareArticle, setShareArticle] = useState<ShareableArticleData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareImageRef = useRef<ShareableArticleImageRef>(null);

  // Branding
  const [primary, setPrimary] = useState(c.tint);

  // Load branding from session
  const loadBranding = useCallback(async () => {
    try {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      if (isValidHexColor(pColor)) setPrimary(String(pColor));
    } catch {}
  }, []);

  // Load articles
  const loadArticles = useCallback(async (cursor?: string | null, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setNextCursor(null);
    } else if (!cursor) {
      setLoading(true);
      setNextCursor(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const status = activeTab === 'ALL' ? undefined : (activeTab as NewspaperArticleStatus);
      const res = await getNewspaperArticles({
        status,
        limit: PAGE_SIZE,
        cursor: cursor || undefined,
      });

      if (!cursor || isRefresh) {
        setArticles(res.items || []);
      } else {
        setArticles((prev) => [...prev, ...(res.items || [])]);
      }
      setTotal(res.total || 0);
      const nc = (res as any).nextCursor ?? null;
      setNextCursor(nc);
      setHasMore(!!nc);
    } catch (e: any) {
      console.error('[NewsApproval] Load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      void loadBranding();
      void loadArticles(null);
    }, [loadBranding, loadArticles])
  );

  // Tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setArticles([]);
    setHasMore(true);
    setNextCursor(null);
  }, []);

  // Refresh and load when tab changes
  React.useEffect(() => {
    void loadArticles(null);
  }, [activeTab, loadArticles]);

  // Refresh
  const onRefresh = useCallback(() => {
    void loadArticles(null, true);
  }, [loadArticles]);

  // Load more
  const onLoadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && hasMore && nextCursor) {
      void loadArticles(nextCursor);
    }
  }, [loading, refreshing, loadingMore, hasMore, nextCursor, loadArticles]);

  // Approve article
  const handleApprove = useCallback(async (article: NewspaperArticle) => {
    Alert.alert(
      'Approve Article',
      `Are you sure you want to publish "${truncate(article.title, 50)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setActionLoading(article.id);
            try {
              await approveNewspaperArticle(article.id);
              // Update local state - If on PENDING tab, remove the article; otherwise update status
              if (activeTab === 'PENDING') {
                setArticles((prev) => prev.filter((a) => a.id !== article.id));
                setTotal((t) => Math.max(0, t - 1));
              } else {
                setArticles((prev) =>
                  prev.map((a) => (a.id === article.id ? { ...a, status: 'PUBLISHED' as NewspaperArticleStatus } : a))
                );
              }
              setPreviewArticle(null);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to approve article');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [activeTab]);

  // Reject article
  const handleReject = useCallback(async (article: NewspaperArticle) => {
    Alert.alert(
      'Reject Article',
      `Are you sure you want to reject "${truncate(article.title, 50)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(article.id);
            try {
              await rejectNewspaperArticle(article.id);
              // Update local state
              setArticles((prev) =>
                prev.map((a) => (a.id === article.id ? { ...a, status: 'REJECTED' as NewspaperArticleStatus } : a))
              );
              // If we're on PENDING tab, remove the article
              if (activeTab === 'PENDING') {
                setArticles((prev) => prev.filter((a) => a.id !== article.id));
                setTotal((t) => Math.max(0, t - 1));
              }
              setPreviewArticle(null);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reject article');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [activeTab]);

  // Open preview with full article details
  const openPreview = useCallback(async (article: NewspaperArticle) => {
    console.log('[NewsApproval] Opening preview for article:', article.id);
    setPreviewLoading(true);
    setPreviewArticle(article); // Show modal immediately with basic info
    try {
      const fullArticle = await getNewspaperArticle(article.id);
      console.log('[NewsApproval] Full article loaded:', {
        id: fullArticle.id,
        hasContent: Boolean(fullArticle.content),
        hasLead: Boolean(fullArticle.lead),
        hasHeading: Boolean(fullArticle.heading),
        hasPoints: Boolean(fullArticle.points?.length),
        contentPreview: fullArticle.content?.substring(0, 100),
      });
      setPreviewArticle(fullArticle);
    } catch (e: any) {
      console.error('[NewsApproval] Failed to load full article:', e?.message, e);
      // Keep showing the basic article info
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Share article as image
  const handleShareAsImage = useCallback(async (article: NewspaperArticle) => {
    console.log('[NewsApproval] Preparing share for:', article.id);
    
    // Prepare share data
    const shareData: ShareableArticleData = {
      id: article.id,
      title: article.title,
      subTitle: article.subTitle,
      lead: article.lead,
      points: article.points,
      content: article.content,
      coverImageUrl: article.coverImageUrl,
      webArticleUrl: article.webArticleUrl,
      reporter: article.author?.profile ? {
        id: article.author.id,
        fullName: article.author.profile.fullName,
        profilePhotoUrl: article.author.profile.profilePhotoUrl,
      } : undefined,
    };
    setShareArticle(shareData);
    
    // Wait for component to render then capture
    setTimeout(async () => {
      if (shareImageRef.current) {
        setIsSharing(true);
        try {
          console.log('[NewsApproval] Starting image capture...');
          await shareImageRef.current.captureAndShare();
          console.log('[NewsApproval] Image capture completed');
        } catch (e) {
          console.error('[NewsApproval] Share image failed:', e);
        } finally {
          setIsSharing(false);
          setShareArticle(null);
        }
      } else {
        console.error('[NewsApproval] shareImageRef is null');
        setIsSharing(false);
        setShareArticle(null);
      }
    }, 800);
  }, []);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  const renderArticle = useCallback(({ item }: { item: NewspaperArticle }) => (
    <ArticleCard
      article={item}
      primary={primary}
      c={c}
      isLoading={actionLoading === item.id}
      onPreview={() => openPreview(item)}
      onApprove={() => handleApprove(item)}
      onReject={() => handleReject(item)}
    />
  ), [primary, c, actionLoading, handleApprove, handleReject, openPreview]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: alphaBg(primary, 0.1, c.background) }]}>
        <MaterialIcons
          name={activeTab === 'PENDING' ? 'inbox' : activeTab === 'PUBLISHED' ? 'check-circle' : activeTab === 'REJECTED' ? 'cancel' : 'article'}
          size={48}
          color={primary}
        />
      </View>
      <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 16, fontSize: 16 }}>
        {activeTab === 'PENDING' ? 'No Pending Articles' :
         activeTab === 'PUBLISHED' ? 'No Approved Articles' :
         activeTab === 'REJECTED' ? 'No Rejected Articles' : 'No Articles Found'}
      </ThemedText>
      <ThemedText style={{ color: c.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>
        {activeTab === 'PENDING'
          ? 'All caught up! No articles waiting for review.'
          : `Articles will appear here when ${activeTab === 'PUBLISHED' ? 'approved' : activeTab === 'REJECTED' ? 'rejected' : 'submitted'}.`}
      </ThemedText>
    </View>
  ), [activeTab, primary, c]);

  const ListFooterComponent = useMemo(() => (
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={primary} />
      </View>
    ) : null
  ), [loadingMore, primary]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      {/* Header */}
      <LinearGradient
        colors={[primary, alphaBg(primary, 0.8, primary)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>News Approval</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {total} {activeTab === 'ALL' ? 'total' : activeTab.toLowerCase()} article{total !== 1 ? 's' : ''}
            </ThemedText>
          </View>
          <Pressable onPress={onRefresh} hitSlop={12}>
            <MaterialIcons name="refresh" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
          style={styles.tabsScroll}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabChange(tab.key)}
                style={[
                  styles.tabBtn,
                  isActive ? styles.tabBtnActive : { backgroundColor: 'rgba(255,255,255,0.15)' },
                ]}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={16}
                  color={isActive ? primary : '#fff'}
                  style={{ marginRight: 6 }}
                />
                <ThemedText style={[styles.tabText, isActive && { color: primary }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Content */}
      {loading && articles.length === 0 ? (
        <SkeletonList c={c} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderArticle}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
          contentContainerStyle={[styles.listContent, articles.length === 0 && { flex: 1 }]}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary]} />
          }
        />
      )}

      {/* Share Image Component (hidden, for capture) */}
      {shareArticle && (
        <ShareableArticleImage
          ref={shareImageRef}
          article={shareArticle}
          visible={true}
        />
      )}

      {/* Sharing overlay */}
      {isSharing && (
        <View style={styles.sharingOverlay}>
          <View style={styles.sharingBox}>
            <ActivityIndicator size="large" color={primary} />
            <ThemedText style={{ color: c.text, marginTop: 12, fontSize: 14 }}>Generating image...</ThemedText>
          </View>
        </View>
      )}

      {/* Preview Modal */}
      {previewArticle && (
        <ArticlePreviewModal
          article={previewArticle}
          primary={primary}
          c={c}
          isLoading={actionLoading === previewArticle.id}
          isContentLoading={previewLoading}
          onClose={() => setPreviewArticle(null)}
          onApprove={() => handleApprove(previewArticle)}
          onReject={() => handleReject(previewArticle)}
          onShare={() => handleShareAsImage(previewArticle)}
        />
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Article Card  ───────────────────────────── */

function ArticleCard({
  article,
  primary,
  c,
  isLoading,
  onPreview,
  onApprove,
  onReject,
}: {
  article: NewspaperArticle;
  primary: string;
  c: typeof Colors.light;
  isLoading: boolean;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusColors = STATUS_COLORS[article.status] || STATUS_COLORS.DRAFT;
  const isPending = article.status === 'PENDING';

  // Get cover image with fallback from baseArticle.contentJson
  const coverImage = article.coverImageUrl 
    || (article.baseArticle?.contentJson as any)?.raw?.coverImageUrl
    || (article.baseArticle?.contentJson as any)?.raw?.images?.[0]
    || null;

  return (
    <Pressable
      onPress={onPreview}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { opacity: 0.95 },
      ]}
    >
      {/* Image + Status badge */}
      <View style={styles.cardImageWrap}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardNoImage, { backgroundColor: alphaBg(c.muted, 0.1, c.background) }]}>
            <MaterialIcons name="article" size={32} color={c.muted} />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
          <ThemedText style={[styles.statusText, { color: statusColors.text }]}>{article.status}</ThemedText>
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Title */}
        <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
          {article.title}
        </ThemedText>

        {/* Subtitle */}
        {article.subTitle && (
          <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {article.subTitle}
          </ThemedText>
        )}

        {/* Meta row */}
        <View style={styles.cardMeta}>
          {/* Author */}
          {article.author?.profile?.fullName && (
            <View style={styles.metaItem}>
              <MaterialIcons name="person" size={12} color={c.muted} />
              <ThemedText style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
                {article.author.profile.fullName}
              </ThemedText>
            </View>
          )}
          {/* Place */}
          {article.placeName && (
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={12} color={c.muted} />
              <ThemedText style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
                {article.placeName}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Time */}
        <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
          {timeAgo(article.createdAt)}
        </ThemedText>

        {/* Action button - Read & Review for pending, View for others */}
        <View style={styles.cardActions}>
          <Pressable
            onPress={onPreview}
            style={[
              styles.actionBtn, 
              isPending 
                ? [styles.reviewBtn, { backgroundColor: primary }]
                : { backgroundColor: alphaBg(primary, 0.1, c.background), borderColor: alphaBg(primary, 0.2, c.border) }
            ]}
          >
            <MaterialIcons name={isPending ? 'rate-review' : 'visibility'} size={16} color={isPending ? '#fff' : primary} />
            <ThemedText style={[styles.actionText, { color: isPending ? '#fff' : primary, fontWeight: isPending ? '600' : '400' }]}>
              {isPending ? 'Read & Review' : 'View'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────  Preview Modal  ───────────────────────────── */

function ArticlePreviewModal({
  article,
  primary,
  c,
  isLoading,
  isContentLoading,
  onClose,
  onApprove,
  onReject,
  onShare,
}: {
  article: NewspaperArticle;
  primary: string;
  c: typeof Colors.light;
  isLoading: boolean;
  isContentLoading?: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onShare?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const statusColors = STATUS_COLORS[article.status] || STATUS_COLORS.DRAFT;
  const isPending = article.status === 'PENDING';
  const isPublished = article.status === 'PUBLISHED';

  const handleOpenWebUrl = () => {
    if (article.webArticleUrl) {
      Linking.openURL(article.webArticleUrl);
    }
  };

  // Debug logging
  console.log('[ArticlePreviewModal] Rendering with:', {
    id: article.id,
    title: article.title?.substring(0, 50),
    hasContent: Boolean(article.content),
    hasLead: Boolean(article.lead),
    hasHeading: Boolean(article.heading),
    hasPoints: Boolean(article.points?.length),
    hasCoverImageUrl: Boolean(article.coverImageUrl),
    hasBaseArticle: Boolean(article.baseArticle),
    isContentLoading,
  });

  // Check if we have full article content
  const hasFullContent = Boolean(article.content || article.lead || article.heading || (article.points && article.points.length > 0));

  // Try to get cover image from various sources
  const coverImage = article.coverImageUrl 
    || (article.baseArticle?.contentJson as any)?.raw?.coverImageUrl
    || (article.baseArticle?.contentJson as any)?.raw?.images?.[0]
    || null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: c.background, paddingBottom: insets.bottom + 16 }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
              Article Preview
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Cover Image */}
            {coverImage && (
              <Image source={{ uri: coverImage }} style={styles.previewImage} contentFit="cover" />
            )}

            {/* Status + Category */}
            <View style={styles.previewMeta}>
              <View style={[styles.statusBadgeLarge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <ThemedText style={[styles.statusTextLarge, { color: statusColors.text }]}>{article.status}</ThemedText>
              </View>
              {article.category?.name && (
                <View style={[styles.categoryBadge, { backgroundColor: alphaBg(primary, 0.1, c.background) }]}>
                  <ThemedText style={{ color: primary, fontSize: 12 }}>{article.category.name}</ThemedText>
                </View>
              )}
            </View>

            {/* Title */}
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 20, lineHeight: 28, marginTop: 12 }}>
              {article.title}
            </ThemedText>

            {/* Subtitle */}
            {article.subTitle && (
              <ThemedText style={{ color: c.muted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
                {article.subTitle}
              </ThemedText>
            )}

            {/* Author + Date + Place */}
            <View style={[styles.previewAuthorRow, { borderTopColor: c.border, borderBottomColor: c.border }]}>
              {article.author?.profile?.fullName && (
                <View style={styles.previewAuthorItem}>
                  <MaterialIcons name="person" size={16} color={c.muted} />
                  <ThemedText style={{ color: c.text, fontSize: 13, marginLeft: 6 }}>
                    {article.author.profile.fullName}
                  </ThemedText>
                </View>
              )}
              {article.placeName && (
                <View style={styles.previewAuthorItem}>
                  <MaterialIcons name="location-on" size={16} color={c.muted} />
                  <ThemedText style={{ color: c.text, fontSize: 13, marginLeft: 6 }}>
                    {article.placeName}
                  </ThemedText>
                </View>
              )}
              <View style={styles.previewAuthorItem}>
                <MaterialIcons name="schedule" size={16} color={c.muted} />
                <ThemedText style={{ color: c.muted, fontSize: 12, marginLeft: 6 }}>
                  {formatDate(article.createdAt)}
                </ThemedText>
              </View>
            </View>

            {/* Loading indicator for content */}
            {isContentLoading && !hasFullContent && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator size="large" color={primary} />
                <ThemedText style={{ color: c.muted, marginTop: 12, fontSize: 13 }}>
                  Loading article content...
                </ThemedText>
              </View>
            )}

            {/* Lead / Heading */}
            {article.heading && (
              <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16, marginTop: 16 }}>
                {article.heading}
              </ThemedText>
            )}

            {article.lead && (
              <ThemedText style={{ color: c.text, fontSize: 14, lineHeight: 22, marginTop: 8 }}>
                {article.lead}
              </ThemedText>
            )}

            {/* Content */}
            {article.content && (
              <ThemedText style={{ color: c.text, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
                {article.content}
              </ThemedText>
            )}

            {/* Points */}
            {article.points && article.points.length > 0 && (
              <View style={{ marginTop: 12 }}>
                {article.points.map((point, i) => (
                  <View key={i} style={styles.pointRow}>
                    <MaterialIcons name="fiber-manual-record" size={8} color={primary} style={{ marginTop: 6 }} />
                    <ThemedText style={{ color: c.text, fontSize: 14, lineHeight: 22, flex: 1, marginLeft: 8 }}>
                      {point}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {/* No content message */}
            {!isContentLoading && !hasFullContent && (
              <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: alphaBg(c.muted, 0.05, c.background), borderRadius: 12, marginTop: 16 }}>
                <MaterialIcons name="info-outline" size={24} color={c.muted} />
                <ThemedText style={{ color: c.muted, marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                  No additional content available for this article
                </ThemedText>
              </View>
            )}

            {/* Web URL */}
            {article.webArticleUrl && (
              <Pressable onPress={handleOpenWebUrl} style={[styles.webUrlBox, { backgroundColor: alphaBg(primary, 0.1, c.background), borderColor: alphaBg(primary, 0.2, c.border) }]}>
                <MaterialIcons name="link" size={18} color={primary} />
                <ThemedText style={{ color: primary, fontSize: 13, flex: 1, marginLeft: 8 }} numberOfLines={1}>
                  {article.webArticleUrl}
                </ThemedText>
                <MaterialIcons name="open-in-new" size={16} color={primary} />
              </Pressable>
            )}
          </ScrollView>


          {/* Action Buttons - for pending: approve/reject, for published: share */}
          {isPending && (
            <View style={[styles.modalActions, { borderTopColor: c.border }]}>
              <Pressable
                onPress={onReject}
                disabled={isLoading}
                style={[styles.modalActionBtn, styles.modalRejectBtn, { borderColor: '#DC2626' }]}
              >
                <MaterialIcons name="close" size={20} color="#DC2626" />
                <ThemedText style={{ color: '#DC2626', fontWeight: '600', marginLeft: 8 }}>Reject</ThemedText>
              </Pressable>
              <Pressable
                onPress={onApprove}
                disabled={isLoading}
                style={[styles.modalActionBtn, styles.modalApproveBtn]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Approve</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Share button for published articles */}
          {isPublished && onShare && (
            <View style={[styles.modalActions, { borderTopColor: c.border }]}>
              <Pressable
                onPress={onShare}
                style={[styles.modalActionBtn, { backgroundColor: primary, flex: 1 }]}
              >
                <MaterialIcons name="share" size={20} color="#fff" />
                <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Share as Image</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────  Skeleton  ───────────────────────────── */

function SkeletonList({ c }: { c: typeof Colors.light }) {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: 12 }]}>
          <Skeleton width={100} height={100} borderRadius={8} />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Skeleton width="90%" height={16} borderRadius={4} />
            <Skeleton width="70%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
            <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  tabsScroll: { marginTop: 12 },
  tabsContainer: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  // Card
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: 100, height: 100, borderRadius: 8 },
  cardNoImage: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: { position: 'absolute', top: 4, left: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '700' },
  cardContent: { flex: 1, paddingLeft: 12 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, gap: 4 },
  actionText: { fontSize: 12, fontWeight: '600' },
  reviewBtn: { borderWidth: 0, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtn: { backgroundColor: '#059669', borderColor: '#059669' },
  approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectBtn: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  rejectBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  previewImage: { width: '100%', height: 200, borderRadius: 12 },
  previewMeta: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBadgeLarge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusTextLarge: { fontSize: 11, fontWeight: '700' },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  previewAuthorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  previewAuthorItem: { flexDirection: 'row', alignItems: 'center' },
  pointRow: { flexDirection: 'row', marginTop: 6 },
  webUrlBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 16 },
  modalActions: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10 },
  modalRejectBtn: { backgroundColor: '#FEE2E2', borderWidth: 1 },
  modalApproveBtn: { backgroundColor: '#059669' },

  // Sharing overlay
  sharingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  sharingBox: { backgroundColor: '#fff', padding: 32, borderRadius: 16, alignItems: 'center', minWidth: 180 },
});
