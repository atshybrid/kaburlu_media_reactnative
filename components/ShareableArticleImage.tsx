/**
 * ShareableArticleImage - Generate newspaper-style shareable image
 * 
 * Creates a visually appealing image template for sharing articles on WhatsApp/social media:
 * - Tenant logo at top
 * - Title (1-2 lines with styling rules)
 * - Subtitle (if present, center aligned with background)
 * - Cover image with optional caption
 * - Lead text / Headline points / Content text (limited 60 words)
 * - Reporter section with photo, name, level, designation, location
 * - "Read more" link at bottom
 */
import { loadTokens } from '@/services/auth';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';
import RNShare from 'react-native-share';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = Math.min(SCREEN_WIDTH - 32, 400); // Max width for shareable image
const PRIMARY_COLOR = '#109edc';

// Font constants (use platform-safe defaults)
const FONTS = {
  REGULAR: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  BOLD: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
};

// Types
export interface ShareableArticleData {
  id: string;
  title: string;
  subTitle?: string;
  lead?: string;
  points?: string[];
  content?: string;
  coverImageUrl?: string;
  imageCaption?: string;
  webArticleUrl?: string;
  // Reporter info
  reporter?: {
    id?: string;
    fullName?: string;
    profilePhotoUrl?: string;
    designation?: { name?: string } | string;
    level?: { name?: string } | string;
    location?: string;
    district?: { name?: string } | string;
    mandal?: { name?: string } | string;
  };
}

export interface ShareableArticleImageRef {
  captureAndShare: () => Promise<void>;
  capture: () => Promise<string | null>;
}

interface Props {
  article: ShareableArticleData;
  tenantName?: string;
  tenantLogoUrl?: string;
  tenantPrimaryColor?: string;
  onCaptureStart?: () => void;
  onCaptureEnd?: () => void;
  visible?: boolean;
}

// Helper to truncate text to word limit
function truncateWords(text: string | undefined, limit: number): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return words.slice(0, limit).join(' ') + '...';
}

// Helper to get designation name
function getDesignationName(designation: { name?: string } | string | undefined): string {
  if (!designation) return '';
  if (typeof designation === 'string') return designation;
  return designation.name || '';
}

// Helper to get level name
function getLevelName(level: { name?: string } | string | undefined): string {
  if (!level) return '';
  if (typeof level === 'string') return level;
  return level.name || '';
}

// Helper to get location string
function getLocationString(reporter: ShareableArticleData['reporter']): string {
  if (!reporter) return '';
  const parts: string[] = [];
  if (reporter.location) parts.push(reporter.location);
  if (reporter.mandal && typeof reporter.mandal === 'object' && reporter.mandal.name) {
    parts.push(reporter.mandal.name);
  }
  if (reporter.district && typeof reporter.district === 'object' && reporter.district.name) {
    parts.push(reporter.district.name);
  }
  return parts.join(', ');
}

const ShareableArticleImage = forwardRef<ShareableArticleImageRef, Props>(
  ({ article, tenantName: propTenantName, tenantLogoUrl: propTenantLogoUrl, tenantPrimaryColor, onCaptureStart, onCaptureEnd, visible = true }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewShotRef = useRef<any>(null);
    const [tenantName, setTenantName] = useState(propTenantName || '');
    const [tenantLogoUrl, setTenantLogoUrl] = useState(propTenantLogoUrl || '');
    const [primaryColor, setPrimaryColor] = useState(tenantPrimaryColor || PRIMARY_COLOR);
    const [capturing, setCapturing] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const totalImages = useRef(0);

    // Count total images to load
    useEffect(() => {
      let count = 0;
      if (article.coverImageUrl) count++;
      if (article.reporter?.profilePhotoUrl) count++;
      if (tenantLogoUrl || propTenantLogoUrl) count++;
      totalImages.current = count;
      setImagesLoaded(0);
    }, [article.coverImageUrl, article.reporter?.profilePhotoUrl, tenantLogoUrl, propTenantLogoUrl]);

    const onImageLoad = useCallback(() => {
      setImagesLoaded(prev => prev + 1);
    }, []);

    // Load tenant info from session if not provided
    useEffect(() => {
      if (propTenantName && propTenantLogoUrl) return;
      (async () => {
        try {
          const t = await loadTokens();
          const session: any = (t as any)?.session;
          const ds = session?.domainSettings;
          const colors = ds?.data?.theme?.colors;
          const primary = colors?.primary || colors?.accent;
          const logo = ds?.data?.seo?.ogImageUrl || ds?.data?.branding?.logoUrl;
          const tn = session?.tenant?.name;

          if (!propTenantName && tn) setTenantName(tn);
          if (!propTenantLogoUrl && logo) setTenantLogoUrl(logo);
          if (primary && /^#[0-9A-Fa-f]{6}$/.test(primary)) setPrimaryColor(primary);
        } catch (e) {
          console.log('[ShareableArticle] Failed to load tenant info:', e);
        }
      })();
    }, [propTenantName, propTenantLogoUrl]);

    // Wait for images to load with timeout
    const waitForImages = useCallback(async (maxWaitMs = 3000): Promise<void> => {
      const startTime = Date.now();
      while (imagesLoaded < totalImages.current && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Extra buffer for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
    }, [imagesLoaded]);

    // Capture image using ViewShot component
    const capture = useCallback(async (): Promise<string | null> => {
      console.log('[ShareableArticle] capture() called, viewShotRef:', !!viewShotRef.current);
      if (!viewShotRef.current) {
        console.error('[ShareableArticle] viewShotRef is null - Modal may not be fully rendered');
        return null;
      }
      setCapturing(true);
      onCaptureStart?.();
      try {
        // Wait for images to load
        console.log('[ShareableArticle] Waiting for images...', { loaded: imagesLoaded, total: totalImages.current });
        await waitForImages();
        console.log('[ShareableArticle] Images loaded, capturing view...');
        
        // Use ViewShot component's capture method (like ArticlePage.tsx does)
        const uri = await viewShotRef.current.capture?.();
        if (!uri) {
          console.error('[ShareableArticle] ViewShot capture returned null');
          return null;
        }
        console.log('[ShareableArticle] Captured successfully:', uri);
        return uri;
      } catch (e) {
        console.error('[ShareableArticle] Capture failed:', e);
        return null;
      } finally {
        setCapturing(false);
        onCaptureEnd?.();
      }
    }, [onCaptureStart, onCaptureEnd, waitForImages, imagesLoaded]);

    // Capture and share - uses react-native-share to send image + URL together
    const captureAndShare = useCallback(async (): Promise<void> => {
      console.log('[ShareableArticle] Starting captureAndShare...');
      
      // ViewShot is always rendered off-screen, so we just need to wait for images
      // Wait a bit for images to load (off-screen component is always mounted)
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('[ShareableArticle] Attempting capture...');
      
      const uri = await capture();
      
      const shareUrl = article.webArticleUrl || '';
      const shareMessage = shareUrl 
        ? `${article.title}\n\n📰 Read full article: ${shareUrl}` 
        : article.title;
      
      // If capture failed, fall back to text-only share
      if (!uri) {
        console.warn('[ShareableArticle] Image capture failed, falling back to text share');
        try {
          await RNShare.open({
            title: article.title,
            message: shareMessage,
            failOnCancel: false,
          });
        } catch (e: any) {
          if (e?.message !== 'User did not share') {
            console.error('[ShareableArticle] Text share failed:', e);
          }
        }
        return;
      }
      
      try {
        // Use react-native-share which supports image + text together
        await RNShare.open({
          title: article.title,
          message: shareMessage,
          url: Platform.OS === 'android' ? `file://${uri}` : uri,
          type: 'image/png',
          failOnCancel: false,
        });
      } catch (e: any) {
        // User cancelled is not an error
        if (e?.message !== 'User did not share') {
          console.error('[ShareableArticle] Share failed:', e);
        }
      }
    }, [capture, article.title, article.webArticleUrl]);

    useImperativeHandle(ref, () => ({
      captureAndShare,
      capture,
    }), [captureAndShare, capture]);

    const reporter = article.reporter;
    const hasReporter = reporter && (reporter.fullName || reporter.profilePhotoUrl);
    const locationStr = getLocationString(reporter);

    // Smart title logic: split titles into 2 parts for newspaper style
    // First line = smaller font (kicker style), Second line = big headline
    const getTitleParts = useCallback(() => {
      const title = article.title || '';
      
      // Check if title has explicit newlines
      const lines = title.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        return {
          hasTwo: true,
          line1: lines[0].trim(),
          line2: lines.slice(1).join(' ').trim(),
        };
      }
      
      // Always try to split if title has more than 20 chars (for newspaper look)
      if (title.length > 20) {
        // Split at first space after 30% of title length
        const splitPoint = Math.max(8, Math.floor(title.length * 0.3));
        let spaceIdx = title.indexOf(' ', splitPoint);
        
        // If no space found after split point, try before
        if (spaceIdx === -1 || spaceIdx > title.length - 5) {
          spaceIdx = title.lastIndexOf(' ', splitPoint + 10);
        }
        
        if (spaceIdx > 3 && spaceIdx < title.length - 3) {
          return {
            hasTwo: true,
            line1: title.substring(0, spaceIdx).trim(),
            line2: title.substring(spaceIdx + 1).trim(),
          };
        }
      }
      
      return { hasTwo: false, line1: '', line2: title };
    }, [article.title]);

    const titleParts = getTitleParts();

    if (!visible) return null;

    // Render ViewShot OFF-SCREEN (always rendered, not inside Modal)
    // This ensures the ref is always valid for capture
    return (
      <>
        {/* Off-screen ViewShot - always rendered but hidden */}
        <View style={{ position: 'absolute', top: -99999, left: -99999 }} pointerEvents="none">
          <ViewShot 
            ref={viewShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={[styles.captureView, { width: IMAGE_WIDTH }]}
          >
        {/* Background */}
        <View style={[styles.cardBg, { backgroundColor: '#FFFBF5' }]}>
            {/* ── Header: Logo Only (Centered) ── */}
            <View style={styles.header}>
              {tenantLogoUrl ? (
                <Image 
                  source={{ uri: tenantLogoUrl }} 
                  style={styles.tenantLogo} 
                  contentFit="contain" 
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
              ) : tenantName ? (
                <View style={[styles.tenantLogoFallback, { backgroundColor: primaryColor }]}>
                  <Text style={styles.tenantLogoText}>{tenantName[0]}</Text>
                </View>
              ) : null}
            </View>

            {/* ── Colored Divider Line ── */}
            <View style={[styles.headerDivider, { backgroundColor: primaryColor }]} />

            {/* ── Title Section (Newspaper Block Style with Smart 2-line logic) ── */}
            <View style={styles.titleSection}>
              {/* Title with left border accent - Smart 2 line styling */}
              <View style={[styles.titleBlock, { borderLeftColor: primaryColor }]}>
                {titleParts.hasTwo ? (
                  <>
                    <Text style={styles.titleLineSmall} numberOfLines={1}>
                      {titleParts.line1}
                    </Text>
                    <Text style={styles.titleLineBig} numberOfLines={2}>
                      {titleParts.line2}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.titleText} numberOfLines={3}>
                    {titleParts.line2}
                  </Text>
                )}
              </View>

              {/* Subtitle */}
              {article.subTitle ? (
                <View style={[styles.subtitleWrap, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.subtitle, { color: primaryColor }]} numberOfLines={2}>
                    {article.subTitle}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── Cover Image ── */}
            {article.coverImageUrl ? (
              <View style={styles.coverSection}>
                <Image
                  source={{ uri: article.coverImageUrl }}
                  style={styles.coverImage}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
                {/* Image Caption */}
                {article.imageCaption ? (
                  <View style={styles.captionWrap}>
                    <MaterialIcons name="photo-camera" size={12} color="#666" />
                    <Text style={styles.captionText} numberOfLines={2}>
                      {article.imageCaption}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── Lead Text (if available) ── */}
            {article.lead ? (
              <View style={styles.leadSection}>
                <Text style={styles.leadText} numberOfLines={3}>
                  {truncateWords(article.lead, 40)}
                </Text>
              </View>
            ) : null}

            {/* ── Headline Points / Bullet Points ── */}
            {article.points && article.points.length > 0 ? (
              <View style={styles.pointsSection}>
                {article.points.slice(0, 4).map((point, idx) => (
                  <View key={idx} style={styles.pointRow}>
                    <View style={[styles.pointBullet, { backgroundColor: primaryColor }]} />
                    <Text style={styles.pointText} numberOfLines={2}>{point}</Text>
                  </View>
                ))}
                {/* Brief content after bullet points - 20 words */}
                {article.content ? (
                  <Text style={[styles.contentText, { marginTop: 8 }]}>
                    {truncateWords(article.content, 20)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* ── Brief Content (60 words if no bullet points) ── */}
            {article.content && !article.lead && !(article.points && article.points.length > 0) ? (
              <View style={styles.contentSection}>
                <Text style={styles.contentText}>{truncateWords(article.content, 60)}</Text>
              </View>
            ) : null}

            {/* ── Reporter Section ── */}
            {hasReporter ? (
              <View style={[styles.reporterSection, { borderTopColor: primaryColor + '30' }]}>
                {/* Reporter Photo */}
                <View style={[styles.reporterPhotoWrap, { borderColor: primaryColor }]}>
                  {reporter?.profilePhotoUrl ? (
                    <Image
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={styles.reporterPhoto}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                  ) : (
                    <View style={[styles.reporterPhotoPlaceholder, { backgroundColor: primaryColor + '20' }]}>
                      <MaterialCommunityIcons name="account" size={24} color={primaryColor} />
                    </View>
                  )}
                </View>

                {/* Reporter Info */}
                <View style={styles.reporterInfo}>
                  <Text style={styles.reporterName} numberOfLines={1}>
                    {reporter?.fullName || 'Reporter'}
                  </Text>
                  <View style={styles.reporterDetails}>
                    {getLevelName(reporter?.level) ? (
                      <View style={[styles.reporterBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.reporterBadgeText}>
                          {getLevelName(reporter?.level)}
                        </Text>
                      </View>
                    ) : null}
                    {getDesignationName(reporter?.designation) ? (
                      <Text style={styles.reporterDesignation} numberOfLines={1}>
                        {getDesignationName(reporter?.designation)}
                      </Text>
                    ) : null}
                  </View>
                  {locationStr ? (
                    <View style={styles.reporterLocation}>
                      <MaterialIcons name="location-on" size={12} color="#888" />
                      <Text style={styles.reporterLocationText} numberOfLines={1}>
                        {locationStr}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* ── Footer: Article URL ── */}
            <View style={[styles.footer, { backgroundColor: primaryColor }]}>
              {article.webArticleUrl ? (
                <>
                  <MaterialIcons name="link" size={14} color="#fff" />
                  <Text style={styles.footerText} numberOfLines={1}>
                    {article.webArticleUrl.replace(/^https?:\/\//, '').substring(0, 50)}
                  </Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="touch-app" size={14} color="#fff" />
                  <Text style={styles.footerText}>Read full article</Text>
                </>
              )}
            </View>
          </View>
        </ViewShot>
        </View>

        {/* Optional: Show capturing indicator overlay on the whole screen */}
        {capturing && (
          <View style={styles.capturingOverlayFullScreen}>
            <View style={styles.capturingBox}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={styles.capturingText}>Preparing image...</Text>
            </View>
          </View>
        )}
      </>
    );
  }
);

ShareableArticleImage.displayName = 'ShareableArticleImage';

export default ShareableArticleImage;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureView: {
    backgroundColor: '#FFFBF5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardBg: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingOverlayFullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  capturingBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  capturingText: {
    fontSize: 14,
    color: '#333',
    fontFamily: FONTS.REGULAR,
  },

  // Header (centered logo, no background)
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFBF5',
  },
  tenantLogo: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  tenantLogoFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantLogoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  headerDivider: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
  },

  // Title (Newspaper Block Style)
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  titleBlock: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 4,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 28,
    textAlign: 'left',
  },
  // Smart 2-line title styles
  titleLineSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    lineHeight: 18,
    marginBottom: 2,
  },
  titleLineBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a1a1a',
    lineHeight: 28,
  },
  subtitleWrap: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Lead Text Section
  leadSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
  },
  leadText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    lineHeight: 19,
    fontStyle: 'italic',
  },

  // Points/Bullet Section
  pointsSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  pointBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    lineHeight: 17,
  },

  // Cover Image
  coverSection: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  captionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
  },
  captionText: {
    flex: 1,
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },

  // Content
  contentSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  contentText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    textAlign: 'justify',
  },

  // Reporter Section
  reporterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  reporterPhotoWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    overflow: 'hidden',
  },
  reporterPhoto: {
    width: '100%',
    height: '100%',
  },
  reporterPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reporterInfo: {
    flex: 1,
  },
  reporterName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  reporterDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  reporterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reporterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  reporterDesignation: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  reporterLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  reporterLocationText: {
    fontSize: 11,
    color: '#888',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
