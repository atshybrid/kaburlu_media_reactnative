/**
 * Reporter Article Detail Page
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

import { Feather, Ionicons } from '@expo/vector-icons';
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

const PRIMARY_COLOR = '#109edc';

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
    <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} translucent={false} />
    
    {/* Header */}
    <LinearGradient
      colors={[PRIMARY_COLOR, '#0891b2']}
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

// Status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: '#E5E7EB', text: '#6B7280', label: 'Draft' },
  PENDING: { bg: '#FEF3C7', text: '#D97706', label: 'Pending Review' },
  PUBLISHED: { bg: '#D1FAE5', text: '#059669', label: 'Published' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
  ARCHIVED: { bg: '#E5E7EB', text: '#6B7280', label: 'Archived' },
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

  // Share as image
  const shareImageRef = useRef<ShareableArticleImageRef>(null);
  const [shareArticle, setShareArticle] = useState<ShareableArticleData | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Load session data
  useEffect(() => {
    (async () => {
      try {
        const tokens = await loadTokens();
        if ((tokens as any)?.session) {
          setSession((tokens as any).session);
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
      Alert.alert('Not Available', 'Share link is not available for this article.');
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

  // Share as image
  const handleShareAsImage = async () => {
    if (!article) return;
    
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
    
    // Wait for component to render and images to load, then capture
    setTimeout(async () => {
      if (shareImageRef.current) {
        setIsSharing(true);
        try {
          console.log('[ArticleDetail] Starting image capture...');
          await shareImageRef.current.captureAndShare();
          console.log('[ArticleDetail] Image capture completed');
        } catch (e) {
          console.error('[ArticleDetail] Share image failed:', e);
          Alert.alert('Share Failed', 'Unable to generate share image');
        } finally {
          setIsSharing(false);
          setShareArticle(null);
        }
      } else {
        console.error('[ArticleDetail] shareImageRef is null');
        setIsSharing(false);
        setShareArticle(null);
      }
    }, 800);
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
        'Cannot Edit',
        'Published articles cannot be edited. Contact your editor for changes.',
      );
      return;
    }
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
      Alert.alert('Error', 'Title is required');
      return;
    }

    setSaving(true);
    try {
      const payload: UpdateNewspaperArticlePayload = {
        title: editTitle.trim(),
        subTitle: editSubtitle.trim() || undefined,
        content: editContent.trim() || undefined,
      };
      
      await updateNewspaperArticle(id, payload);
      Alert.alert('Success', 'Article updated successfully');
      setEditMode(false);
      loadArticle(); // Reload to get updated data
    } catch (e: any) {
      console.error('[ArticleDetail] Update failed:', e);
      Alert.alert('Error', e?.message || 'Failed to update article');
    } finally {
      setSaving(false);
    }
  };

  // Delete article
  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await deleteNewspaperArticle(id);
      Alert.alert('Deleted', 'Article has been deleted', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error('[ArticleDetail] Delete failed:', e);
      Alert.alert('Error', e?.message || 'Failed to delete article');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Confirm delete
  const confirmDelete = () => {
    if (article?.status === 'PUBLISHED') {
      Alert.alert(
        'Cannot Delete',
        'Published articles cannot be deleted. Contact your editor.',
      );
      return;
    }
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
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
        <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
        <Text style={styles.errorText}>{error || 'Article not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadArticle}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLinkBtn} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get cover image URL
  const coverImageUrl = article.baseArticle?.contentJson?.raw?.coverImageUrl || 
    (article.baseArticle?.contentJson?.raw?.images?.[0]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} translucent={false} />

      {/* Share Image Component (Modal-based) */}
      {shareArticle && (
        <ShareableArticleImage
          ref={shareImageRef}
          article={shareArticle}
          tenantName={session?.tenant?.name}
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

      {/* Header */}
      <LinearGradient
        colors={[PRIMARY_COLOR, '#0891b2']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editMode ? 'Edit Article' : 'Article Detail'}
        </Text>
        <View style={styles.headerActions}>
          {!editMode && (
            <>
              <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                <Ionicons name="share-social-outline" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {}} style={styles.headerMenuBtn}>
                <Feather name="more-vertical" size={20} color="#FFF" />
              </TouchableOpacity>
            </>
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
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {statusColors.label}
              </Text>
            </View>
            {article.viewCount !== undefined && (
              <View style={styles.viewsRow}>
                <Ionicons name="eye-outline" size={16} color="#6B7280" />
                <Text style={styles.viewsText}>{article.viewCount} views</Text>
              </View>
            )}
          </View>

          {/* Content */}
          {editMode ? (
            // Edit Mode
            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Enter title"
                multiline
              />

              <Text style={styles.inputLabel}>Subtitle</Text>
              <TextInput
                style={styles.input}
                value={editSubtitle}
                onChangeText={setEditSubtitle}
                placeholder="Enter subtitle"
                multiline
              />

              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Enter content"
                multiline
                textAlignVertical="top"
              />
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

              {/* Web Article Link */}
              {(article.sportLink || article.webArticleUrl) && (
                <TouchableOpacity
                  style={styles.webLinkCard}
                  onPress={handleOpenWeb}
                  activeOpacity={0.8}
                >
                  <View style={styles.webLinkIcon}>
                    <Ionicons name="globe-outline" size={24} color={PRIMARY_COLOR} />
                  </View>
                  <View style={styles.webLinkInfo}>
                    <Text style={styles.webLinkTitle}>View on Web</Text>
                    <Text style={styles.webLinkUrl} numberOfLines={1}>
                      {article.sportLinkDomain || article.sportLink || article.webArticleUrl}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* Metadata */}
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaLabel}>Created:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(article.createdAt).toLocaleDateString('en-IN', {
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
                    <Text style={styles.metaLabel}>Updated:</Text>
                    <Text style={styles.metaValue}>
                      {new Date(article.updatedAt).toLocaleDateString('en-IN', {
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
                    <Text style={styles.metaLabel}>Location:</Text>
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
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          // View mode actions
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={confirmDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={handleStartEdit}
            >
              <Feather name="edit-2" size={18} color="#FFF" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareActionBtn]}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color="#FFF" />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </>
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
            <Text style={styles.modalTitle}>Delete Article?</Text>
            <Text style={styles.modalMessage}>
              This action cannot be undone. The article will be permanently deleted.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalDeleteBtn]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  backLinkBtn: {
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
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

  // Web Link Card
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
    color: PRIMARY_COLOR,
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
    width: 70,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111',
    marginBottom: 16,
    minHeight: 48,
  },
  contentInput: {
    minHeight: 200,
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  deleteBtn: {
    flex: 0.8,
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
    backgroundColor: PRIMARY_COLOR,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  sharingBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  sharingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});
