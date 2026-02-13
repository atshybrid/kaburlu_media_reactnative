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
import { Image as ExpoImage } from 'expo-image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image as RNImage,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View
} from 'react-native';
import RNShare from 'react-native-share';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = Math.min(SCREEN_WIDTH - 32, 400); // Max width for shareable image
const PRIMARY_COLOR = '#e42223';

// Font constants (use platform-safe defaults)
const FONTS = {
  REGULAR: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  BOLD: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
};

// Design Templates
export type DesignTemplate = 'classic' | 'compact' | 'magazine' | 'modern' | 'elegant';

export const DESIGN_TEMPLATES: { id: DesignTemplate; label: string; icon: string; description: string }[] = [
  { id: 'classic', label: 'క్లాసిక్', icon: '📰', description: 'పూర్తి వెడల్పు సాంప్రదాయ వార్తాపత్రిక' },
  { id: 'compact', label: 'న్యూస్‌పేపర్', icon: '📰', description: 'సాంప్రదాయ వార్తాపత్రిక శైలి - కేంద్రీకృత లేఅవుట్' },
  { id: 'magazine', label: 'మ్యాగజైన్', icon: '📖', description: 'పెద్ద ఫోటోతో మ్యాగజైన్ స్టైల్' },
  { id: 'modern', label: 'మోడర్న్', icon: '✨', description: 'ఆధునిక కార్డ్ ఆధారిత డిజైన్' },
  { id: 'elegant', label: 'ఎలిగెంట్', icon: '🎨', description: 'సొగసైన కేంద్రీకృత లేఅవుట్' },
];

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
    quote?: string; // Reporter's comment/quote about the article
  };
}

export interface ShareableArticleImageRef {
  showStylePicker: () => void;
  captureAndShare: (template?: DesignTemplate) => Promise<void>;
  capture: (template?: DesignTemplate) => Promise<string | null>;
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
    const [imageAspectRatio, setImageAspectRatio] = useState(16 / 9);

    // Style picker state
    const [showStylePicker, setShowStylePicker] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<DesignTemplate>('classic');

    // Count total images to load
    useEffect(() => {
      let count = 0;
      if (article.coverImageUrl) count++;
      if (article.reporter?.profilePhotoUrl) count++;
      if (tenantLogoUrl || propTenantLogoUrl) count++;
      totalImages.current = count;
      setImagesLoaded(0);
    }, [article.coverImageUrl, article.reporter?.profilePhotoUrl, tenantLogoUrl, propTenantLogoUrl]);

    // Detect cover image aspect ratio
    useEffect(() => {
      if (article.coverImageUrl) {
        RNImage.getSize(
          article.coverImageUrl,
          (width, height) => {
            const ratio = width / height;
            setImageAspectRatio(ratio);
            console.log('[ShareableArticle] Image aspect ratio:', ratio.toFixed(2), width, 'x', height);
          },
          (error) => {
            console.log('[ShareableArticle] Image size fetch failed:', error);
            setImageAspectRatio(16 / 9);
          }
        );
      }
    }, [article.coverImageUrl]);

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
          const themeColor = colors?.primary || colors?.accent;
          const logo = ds?.data?.seo?.ogImageUrl || ds?.data?.branding?.logoUrl;
          const tn = session?.tenant?.name;

          if (!propTenantName && tn) setTenantName(tn);
          if (!propTenantLogoUrl && logo) setTenantLogoUrl(logo);
          if (themeColor && /^#[0-9A-Fa-f]{6}$/.test(themeColor)) setPrimaryColor(themeColor);
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
    const capture = useCallback(async (template: DesignTemplate = 'classic'): Promise<string | null> => {
      console.log('[ShareableArticle] capture() called with template:', template);
      
      // Update current template before capture
      setCurrentTemplate(template);
      
      // Small delay to allow template to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
    const captureAndShare = useCallback(async (template?: DesignTemplate): Promise<void> => {
      // If no template provided, show style picker modal
      if (!template) {
        setShowStylePicker(true);
        return;
      }
      
      console.log('[ShareableArticle] Starting captureAndShare with template:', template);
      
      // ViewShot is always rendered off-screen, so we just need to wait for images
      // Wait a bit for images to load (off-screen component is always mounted)
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('[ShareableArticle] Attempting capture...');
      
      const uri = await capture(template);
      
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
        if (Platform.OS === 'ios') {
          // iOS: Use React Native's built-in Share API which properly handles image + message together
          await Share.share({
            title: article.title,
            url: uri,
            message: shareMessage,
          }, {
            dialogTitle: 'Share article'
          });
        } else {
          // Android: Use react-native-share which supports image + text together
          await RNShare.open({
            title: article.title,
            message: shareMessage,
            url: `file://${uri}`,
            type: 'image/png',
            failOnCancel: false,
          });
        }
      } catch (e: any) {
        // User cancelled is not an error
        if (e?.message !== 'User did not share') {
          console.error('[ShareableArticle] Share failed:', e);
        }
      }
    }, [capture, article.title, article.webArticleUrl]);

    useImperativeHandle(ref, () => ({
      showStylePicker: () => setShowStylePicker(true),
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

    // Determine image layout based on aspect ratio
    const isSquareImage = imageAspectRatio >= 0.9 && imageAspectRatio <= 1.1;
    const isPortraitImage = imageAspectRatio < 0.9;
    const isLandscapeImage = imageAspectRatio > 1.1;

    // Smart image width based on aspect ratio
    const imageWidth = isLandscapeImage ? '100%' : isSquareImage ? '70%' : '60%';

    // Classic Template - Professional gradient newspaper with premium look
    const renderClassicTemplate = useCallback(() => {
      return (
        <View style={[styles.cardBg, { backgroundColor: '#FFFFFF' }]}>
          {/* Premium Header with White Background */}
          <View style={{ 
            backgroundColor: '#FFFFFF',
            paddingVertical: 12,
            paddingHorizontal: 20,
            alignItems: 'center'
          }}>
            {tenantLogoUrl ? (
              <ExpoImage 
                source={{ uri: tenantLogoUrl }} 
                style={{ width: 220, height: 120 }} 
                contentFit="contain" 
                onLoad={onImageLoad}
                onError={onImageLoad}
              />
            ) : null}
          </View>

          {/* Decorative Divider */}
          <View style={{ flexDirection: 'row', height: 6 }}>
            <View style={{ flex: 1, backgroundColor: primaryColor }} />
            <View style={{ flex: 1, backgroundColor: primaryColor + 'CC' }} />
            <View style={{ flex: 1, backgroundColor: primaryColor + '99' }} />
          </View>

          {/* Title with Side Border */}
          <View style={{ paddingTop: 10, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#FAFAFA' }}>
            <View style={{ 
              paddingLeft: 16, 
              borderLeftWidth: 5, 
              borderLeftColor: primaryColor,
              paddingVertical: 4
            }}>
              <Text style={[styles.titleText, { fontSize: 24, fontWeight: '700', color: '#2d2d2d', lineHeight: 32 }]} numberOfLines={3}>
                {article.title}
              </Text>
            </View>
            {article.subTitle ? (
              <View style={{ 
                marginTop: 12, 
                paddingHorizontal: 16, 
                paddingVertical: 10, 
                backgroundColor: primaryColor + '15',
                borderRadius: 8
              }}>
                <Text style={{ fontSize: 14, color: primaryColor, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>
                  {article.subTitle}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Cover Image with Shadow */}
          {article.coverImageUrl ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ 
                backgroundColor: '#fff',
                borderRadius: 12,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8
              }}>
                <ExpoImage
                  source={{ uri: article.coverImageUrl }}
                  style={{ width: '100%', aspectRatio: imageAspectRatio }}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
              </View>
            </View>
          ) : null}

          {/* Content Section */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            {article.lead ? (
              <View style={{ 
                backgroundColor: '#F5F5F5', 
                padding: 14, 
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#FFD700'
              }}>
                <Text style={{ fontSize: 14, lineHeight: 22, color: '#333', fontWeight: '500' }} numberOfLines={3}>
                  {truncateWords(article.lead, 40)}
                </Text>
              </View>
            ) : null}

            {article.points && article.points.length > 0 ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {article.points.slice(0, 4).map((point, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: 12, 
                      backgroundColor: primaryColor,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{idx + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 20 }} numberOfLines={2}>{point}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Reporter Card */}
          {hasReporter ? (
            <View style={{ 
              marginHorizontal: 16, 
              marginTop: 16,
              padding: 14, 
              backgroundColor: '#F9F9F9',
              borderRadius: 12,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E0E0E0'
            }}>
              {reporter?.profilePhotoUrl ? (
                <ExpoImage
                  source={{ uri: reporter.profilePhotoUrl }}
                  style={{ 
                    width: 55, 
                    height: 55, 
                    borderRadius: 28,
                    borderWidth: 3,
                    borderColor: primaryColor
                  }}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }} numberOfLines={1}>
                  {reporter?.fullName || 'Reporter'}
                </Text>
                {getLevelName(reporter?.level) ? (
                  <View style={{ 
                    alignSelf: 'flex-start',
                    paddingHorizontal: 8, 
                    paddingVertical: 3, 
                    backgroundColor: primaryColor,
                    borderRadius: 12,
                    marginTop: 4
                  }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>
                      {getLevelName(reporter?.level)}
                    </Text>
                  </View>
                ) : null}
                {locationStr ? (
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }} numberOfLines={1}>
                    📍 {locationStr}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Reporter Quote Section - Bottom 20% */}
          {hasReporter && reporter?.quote ? (
            <View style={{ 
              marginTop: 16,
              paddingVertical: 16,
              paddingHorizontal: 20,
              backgroundColor: primaryColor + '10',
              borderTopWidth: 3,
              borderTopColor: primaryColor,
              flexDirection: 'row',
              gap: 14,
              alignItems: 'center'
            }}>
              {reporter?.profilePhotoUrl ? (
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: primaryColor
                }}>
                  <ExpoImage
                    source={{ uri: reporter.profilePhotoUrl }}
                    style={{ width: 50, height: 50 }}
                    contentFit="cover"
                    onLoad={onImageLoad}
                    onError={onImageLoad}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <MaterialCommunityIcons name="format-quote-open" size={16} color={primaryColor} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: primaryColor, marginLeft: 4 }}>
                    {reporter?.fullName}'s Comment
                  </Text>
                </View>
                <Text style={{ 
                  fontSize: 13, 
                  fontStyle: 'italic', 
                  color: '#333',
                  lineHeight: 18
                }} numberOfLines={2}>
                  {reporter.quote}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Footer with Gradient */}
          <View style={{ 
            marginTop: 16,
            paddingVertical: 14,
            backgroundColor: primaryColor,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>
              📰 {article.webArticleUrl ? 'Read Full Article Online' : 'Exclusive News Report'}
            </Text>
          </View>
        </View>
      );
    }, [article, tenantLogoUrl, primaryColor, imageAspectRatio, hasReporter, reporter, locationStr, onImageLoad]);

    // Compact Template - Classic newspaper style with centered layout
    const renderCompactTemplate = useCallback(() => {
      return (
        <View style={[styles.cardBg, { backgroundColor: '#FFFFFF' }]}>
          {/* Newspaper Header with Logo and Red Top Bar */}
          <View style={{ backgroundColor: primaryColor, height: 8 }} />
          
          <View style={{ 
            backgroundColor: '#FFFFFF',
            paddingVertical: 16,
            paddingHorizontal: 20,
            alignItems: 'center',
            borderBottomWidth: 3,
            borderBottomColor: '#000000'
          }}>
            {tenantLogoUrl ? (
              <ExpoImage 
                source={{ uri: tenantLogoUrl }} 
                style={{ width: 200, height: 100 }} 
                contentFit="contain" 
                onLoad={onImageLoad}
                onError={onImageLoad}
              />
            ) : (
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#000' }}>
                {tenantName || 'NEWS'}
              </Text>
            )}
          </View>

          {/* Decorative Line Pattern */}
          <View style={{ flexDirection: 'row', height: 2 }}>
            <View style={{ flex: 1, backgroundColor: '#000' }} />
            <View style={{ flex: 1, backgroundColor: primaryColor }} />
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          </View>

          {/* Main Content */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            {/* Centered Headline - Traditional Newspaper Style */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ 
                fontSize: 24, 
                fontWeight: '900', 
                color: '#000000', 
                lineHeight: 32,
                textAlign: 'center',
                fontFamily: FONTS.BOLD
              }} numberOfLines={4}>
                {article.title}
              </Text>
              
              {article.subTitle ? (
                <View style={{ 
                  marginTop: 12,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: '#CCCCCC'
                }}>
                  <Text style={{ 
                    fontSize: 14, 
                    color: '#333333', 
                    lineHeight: 20,
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }} numberOfLines={2}>
                    {article.subTitle}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Cover Image - Newspaper Photo Style */}
            {article.coverImageUrl ? (
              <View style={{ 
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#DDDDDD',
                backgroundColor: '#F5F5F5',
                padding: 4
              }}>
                <ExpoImage
                  source={{ uri: article.coverImageUrl }}
                  style={{ 
                    width: '100%', 
                    aspectRatio: imageAspectRatio > 1.5 ? imageAspectRatio : 1.33,
                    maxHeight: 220
                  }}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
                {article.imageCaption ? (
                  <View style={{ 
                    backgroundColor: '#F9F9F9',
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    marginTop: 4
                  }}>
                    <Text style={{ 
                      fontSize: 10, 
                      color: '#666666',
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }} numberOfLines={1}>
                      {article.imageCaption}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Article Lead or Highlights - Centered */}
            {article.lead ? (
              <View style={{ 
                marginBottom: 14,
                paddingHorizontal: 12
              }}>
                <Text style={{ 
                  fontSize: 15, 
                  lineHeight: 24, 
                  color: '#1a1a1a',
                  textAlign: 'center',
                  fontWeight: '500',
                  letterSpacing: 0.3
                }} numberOfLines={4}>
                  {truncateWords(article.lead, 50)}
                </Text>
              </View>
            ) : null}

            {/* Highlight Points - Newspaper Style Bullets */}
            {article.points && article.points.length > 0 ? (
              <View style={{ 
                marginBottom: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: '#FAFAFA',
                borderLeftWidth: 3,
                borderLeftColor: primaryColor
              }}>
                <Text style={{ 
                  fontSize: 11, 
                  fontWeight: '700', 
                  color: primaryColor,
                  marginBottom: 8,
                  letterSpacing: 1
                }}>
                  కీలక విషయాలు
                </Text>
                {article.points.slice(0, 3).map((point, idx) => (
                  <View key={idx} style={{ 
                    flexDirection: 'row', 
                    marginBottom: idx < 2 ? 6 : 0,
                    alignItems: 'flex-start'
                  }}>
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#000',
                      fontWeight: '700',
                      marginRight: 8,
                      marginTop: 1
                    }}>
                      •
                    </Text>
                    <Text style={{ 
                      flex: 1, 
                      fontSize: 13, 
                      color: '#333', 
                      lineHeight: 20
                    }} numberOfLines={2}>
                      {point}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Reporter Byline - Traditional Newspaper Style */}
            {hasReporter && reporter?.fullName ? (
              <View style={{ 
                marginTop: 8,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#E0E0E0',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10
              }}>
                {reporter?.profilePhotoUrl ? (
                  <ExpoImage
                    source={{ uri: reporter.profilePhotoUrl }}
                    style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: '#CCCCCC'
                    }}
                    contentFit="cover"
                    onLoad={onImageLoad}
                    onError={onImageLoad}
                  />
                ) : null}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 12, 
                    fontWeight: '700', 
                    color: '#000',
                    textAlign: 'center'
                  }}>
                    {reporter.fullName}
                  </Text>
                  {(getLevelName(reporter?.level) || getDesignationName(reporter?.designation)) ? (
                    <Text style={{ 
                      fontSize: 10, 
                      color: '#666',
                      marginTop: 2,
                      textAlign: 'center'
                    }}>
                      {getLevelName(reporter?.level) || getDesignationName(reporter?.designation)}
                    </Text>
                  ) : null}
                  {locationStr ? (
                    <Text style={{ 
                      fontSize: 10, 
                      color: '#666',
                      marginTop: 1,
                      textAlign: 'center'
                    }}>
                      {locationStr}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Reporter Quote Section - Bottom 20% */}
          {hasReporter && reporter?.quote ? (
            <View style={{ 
              marginHorizontal: 16,
              marginTop: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: '#FFFBF0',
              borderLeftWidth: 4,
              borderLeftColor: primaryColor,
              borderRightWidth: 4,
              borderRightColor: primaryColor,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center'
            }}>
              {reporter?.profilePhotoUrl ? (
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: '#000'
                }}>
                  <ExpoImage
                    source={{ uri: reporter.profilePhotoUrl }}
                    style={{ width: 44, height: 44 }}
                    contentFit="cover"
                    onLoad={onImageLoad}
                    onError={onImageLoad}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 }}>
                    "{reporter.quote}"
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: '#666', fontWeight: '600' }}>
                  — {reporter?.fullName}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Bottom Footer - Newspaper Style */}
          <View style={{ 
            marginTop: 8,
            paddingVertical: 10,
            backgroundColor: '#F5F5F5',
            borderTopWidth: 2,
            borderTopColor: '#000000',
            alignItems: 'center'
          }}>
            <Text style={{ 
              fontSize: 10, 
              color: '#666', 
              fontWeight: '600',
              letterSpacing: 0.5
            }}>
              {article.webArticleUrl ? '— పూర్తి కథనం కోసం ఆన్‌లైన్‌లో చదవండి —' : '— విశేష వార్తా నివేదిక —'}
            </Text>
          </View>
        </View>
      );
    }, [article, tenantLogoUrl, tenantName, primaryColor, imageAspectRatio, hasReporter, reporter, locationStr, onImageLoad]);

    // Magazine Template - Bold hero image with colorful overlays
    const renderMagazineTemplate = useCallback(() => {
      return (
        <View style={[styles.cardBg, { backgroundColor: '#FFFFFF' }]}>
          {/* Hero Image with Gradient Overlay */}
          {article.coverImageUrl ? (
            <View style={{ position: 'relative', height: 240 }}>
              <ExpoImage
                source={{ uri: article.coverImageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                onLoad={onImageLoad}
                onError={onImageLoad}
              />
              {/* Gradient Overlay */}
              <View style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
                backgroundColor: 'rgba(0,0,0,0.4)'
              }} />
              
              {/* Logo on Image */}
              {tenantLogoUrl ? (
                <View style={{ 
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  backgroundColor: '#FFFFFF',
                  padding: 10,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4
                }}>
                  <ExpoImage 
                    source={{ uri: tenantLogoUrl }} 
                    style={{ width: 70, height: 53 }} 
                    contentFit="contain" 
                    onLoad={onImageLoad}
                    onError={onImageLoad}
                  />
                </View>
              ) : null}

              {/* Title Overlay */}
              <View style={{ 
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 20
              }}>
                <Text style={{ 
                  fontSize: 26, 
                  fontWeight: '900', 
                  color: '#FFFFFF', 
                  lineHeight: 34,
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4
                }} numberOfLines={3}>
                  {article.title}
                </Text>
              </View>
            </View>
          ) : (
            /* Fallback Header */
            <View style={{ 
              backgroundColor: primaryColor,
              padding: 20,
              alignItems: 'center'
            }}>
              {tenantLogoUrl ? (
                <ExpoImage 
                  source={{ uri: tenantLogoUrl }} 
                  style={{ width: 90, height: 68, marginBottom: 12 }} 
                  contentFit="contain" 
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
              ) : null}
              <Text style={{ 
                fontSize: 24, 
                fontWeight: '900', 
                color: '#FFFFFF', 
                textAlign: 'center',
                lineHeight: 32
              }} numberOfLines={3}>
                {article.title}
              </Text>
            </View>
          )}

          <View style={{ padding: 20 }}>
            {/* Subtitle with Accent */}
            {article.subTitle ? (
              <View style={{ 
                marginBottom: 16,
                paddingLeft: 16,
                borderLeftWidth: 5,
                borderLeftColor: primaryColor
              }}>
                <Text style={{ 
                  fontSize: 16, 
                  color: primaryColor, 
                  fontWeight: '700',
                  lineHeight: 24
                }} numberOfLines={2}>
                  {article.subTitle}
                </Text>
              </View>
            ) : null}

            {/* Lead Text with Dropcap Effect */}
            {article.lead ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ 
                  fontSize: 14, 
                  lineHeight: 24, 
                  color: '#333',
                  textAlign: 'justify'
                }} numberOfLines={4}>
                  {truncateWords(article.lead, 50)}
                </Text>
              </View>
            ) : null}

            {/* Points with Colorful Icons */}
            {article.points && article.points.length > 0 ? (
              <View style={{ gap: 10, marginBottom: 16 }}>
                {article.points.slice(0, 3).map((point, idx) => (
                  <View key={idx} style={{ 
                    flexDirection: 'row', 
                    gap: 12,
                    backgroundColor: '#F8F9FA',
                    padding: 12,
                    borderRadius: 10,
                    alignItems: 'flex-start'
                  }}>
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14,
                      backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFD93D'][idx] || primaryColor,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 20 }} numberOfLines={2}>
                      {point}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Reporter Section with Avatar */}
            {hasReporter ? (
              <View style={{ 
                backgroundColor: '#F8F9FA',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                gap: 14,
                alignItems: 'center',
                marginBottom: 16
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{ position: 'relative' }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 60, height: 60, borderRadius: 30 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                    <View style={{ 
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#4CAF50',
                      borderWidth: 2,
                      borderColor: '#fff'
                    }} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a1a' }}>
                    {reporter?.fullName}
                  </Text>
                  {getLevelName(reporter?.level) ? (
                    <Text style={{ fontSize: 12, color: primaryColor, marginTop: 2, fontWeight: '600' }}>
                      {getLevelName(reporter?.level)}
                    </Text>
                  ) : null}
                  {locationStr ? (
                    <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      📍 {locationStr}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Reporter Quote Section - Bottom 20% */}
            {hasReporter && reporter?.quote ?(
              <View style={{ 
                marginTop: 16,
                paddingVertical: 16,
                paddingHorizontal: 18,
                backgroundColor: 'linear-gradient(135deg, ' + primaryColor + '10 0%, ' + primaryColor + '05 100%)',
                backgroundColor: primaryColor + '08',
                borderRadius: 14,
                borderLeftWidth: 4,
                borderLeftColor: primaryColor,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                marginBottom: 16
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: primaryColor
                  }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 48, height: 48 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                    <MaterialCommunityIcons name="format-quote-open" size={14} color={primaryColor} style={{ marginTop: 2 }} />
                    <Text style={{ 
                      flex: 1,
                      fontSize: 13, 
                      fontStyle: 'italic', 
                      color: '#222',
                      lineHeight: 19,
                      marginLeft: 4
                    }} numberOfLines={2}>
                      {reporter.quote}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: primaryColor }}>
                    — {reporter?.fullName}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Call to Action */}
            <View style={{ 
              backgroundColor: primaryColor,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                READ FULL STORY ➜
              </Text>
            </View>
          </View>
        </View>
      );
    }, [article, tenantLogoUrl, primaryColor, hasReporter, reporter, locationStr, onImageLoad, getLevelName]);

    // Modern Template - Futuristic dark mode with neon accents
    const renderModernTemplate = useCallback(() => {
      const darkBg = '#1a1a2e';
      const cardBg = '#16213e';
      const accentColor = primaryColor;
      
      return (
        <View style={[styles.cardBg, { backgroundColor: darkBg }]}>
          {/* Futuristic Header */}
          <View style={{ 
            backgroundColor: cardBg,
            padding: 20,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Neon Lines Background */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: accentColor }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#FFD93D' }} />
            
            {tenantLogoUrl ? (
              <View style={{ 
                backgroundColor: '#FFFFFF',
                padding: 12,
                borderRadius: 12,
                alignSelf: 'center',
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10
              }}>
                <ExpoImage 
                  source={{ uri: tenantLogoUrl }} 
                  style={{ width: 80, height: 60 }} 
                  contentFit="contain" 
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
              </View>
            ) : null}

            <View style={{ 
              marginTop: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B6B' }} />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ECDC4' }} />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD93D' }} />
            </View>
          </View>

          {/* Title Card with Glow Effect */}
          <View style={{ padding: 16 }}>
            <View style={{ 
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 18,
              borderWidth: 2,
              borderColor: accentColor + '40',
              shadowColor: accentColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 15
            }}>
              <View style={{ 
                flexDirection: 'row',
                gap: 10,
                marginBottom: 12
              }}>
                <View style={{ 
                  width: 6, 
                  backgroundColor: accentColor,
                  borderRadius: 3
                }} />
                <Text style={{ 
                  flex: 1,
                  fontSize: 22, 
                  fontWeight: '900', 
                  color: '#FFFFFF', 
                  lineHeight: 30
                }} numberOfLines={3}>
                  {article.title}
                </Text>
              </View>
              
              {article.subTitle ? (
                <View style={{ 
                  backgroundColor: accentColor + '20',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: '#FFD93D'
                }}>
                  <Text style={{ fontSize: 13, color: '#E0E0E0', lineHeight: 19 }} numberOfLines={2}>
                    {article.subTitle}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Holographic Image Card */}
            {article.coverImageUrl ? (
              <View style={{ 
                marginTop: 16,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: accentColor + '60',
                position: 'relative'
              }}>
                <ExpoImage
                  source={{ uri: article.coverImageUrl }}
                  style={{ width: '100%', aspectRatio: 16/9 }}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
                {/* Corner Accents */}
                <View style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 40,
                  height: 40,
                  borderTopWidth: 4,
                  borderLeftWidth: 4,
                  borderColor: accentColor
                }} />
                <View style={{ 
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 40,
                  height: 40,
                  borderBottomWidth: 4,
                  borderRightWidth: 4,
                  borderColor: '#FFD93D'
                }} />
              </View>
            ) : null}

            {/* Content Panel */}
            {article.lead ? (
              <View style={{ 
                marginTop: 16,
                backgroundColor: cardBg,
                borderRadius: 12,
                padding: 14,
                borderLeftWidth: 4,
                borderLeftColor: '#4ECDC4'
              }}>
                <Text style={{ fontSize: 13, lineHeight: 21, color: '#B8B8B8' }} numberOfLines={4}>
                  {truncateWords(article.lead, 45)}
                </Text>
              </View>
            ) : null}

            {/* Tech Points */}
            {article.points && article.points.length > 0 ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                {article.points.slice(0, 3).map((point, idx) => (
                  <View key={idx} style={{ 
                    backgroundColor: cardBg,
                    borderRadius: 10,
                    padding: 12,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: ['#FF6B6B', '#4ECDC4', '#FFD93D'][idx] + '40'
                  }}>
                    <View style={{ 
                      width: 24, 
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFD93D'][idx],
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Text style={{ color: darkBg, fontSize: 11, fontWeight: '900' }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 12, color: '#D0D0D0', lineHeight: 18 }} numberOfLines={2}>
                      {point}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Cyber Reporter Card */}
            {hasReporter ? (
              <View style={{ 
                marginTop: 16,
                backgroundColor: cardBg,
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: accentColor + '30'
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{ position: 'relative' }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 50, height: 50, borderRadius: 25 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                    <View style={{ 
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: '#4ECDC4',
                      borderWidth: 2,
                      borderColor: cardBg
                    }} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
                    {reporter?.fullName}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                    {locationStr ? `📍 ${locationStr}` : 'Reporter'}
                  </Text>
                </View>
                <View style={{ 
                  backgroundColor: accentColor,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8
                }}>
                  <Text style={{ fontSize: 9, color: '#FFF', fontWeight: '700' }}>LIVE</Text>
                </View>
              </View>
            ) : null}

            {/* Reporter Quote Section - Bottom 20% with Cyber Style */}
            {hasReporter && reporter?.quote ? (
              <View style={{ 
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: accentColor + '15',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: accentColor + '40',
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center'
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: accentColor
                  }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 46, height: 46 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                    <MaterialCommunityIcons name="format-quote-open" size={14} color={accentColor} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor, marginLeft: 4 }}>
                      REPORTER'S NOTE
                    </Text>
                  </View>
                  <Text style={{ 
                    fontSize: 12, 
                    fontStyle: 'italic', 
                    color: '#E0E0E0',
                    lineHeight: 17
                  }} numberOfLines={2}>
                    {reporter.quote}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#888', marginTop: 3 }}>
                    — {reporter?.fullName}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Neon Footer */}
            <View style={{ 
              marginTop: 16,
              backgroundColor: accentColor,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: accentColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 10
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD93D' }} />
              <Text style={{ fontSize: 12, color: '#FFF', fontWeight: '800', letterSpacing: 1 }}>
                READ MORE
              </Text>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD93D' }} />
            </View>
          </View>
        </View>
      );
    }, [article, tenantLogoUrl, primaryColor, hasReporter, reporter, locationStr, onImageLoad]);

    // Elegant Template - Luxury minimal centered design with gold accents
    const renderElegantTemplate = useCallback(() => {
      const luxuryGold = '#D4AF37';
      const deepNavy = '#0a1929';
      const elegantGray = '#f8f9fa';
      
      return (
        <View style={[styles.cardBg, { backgroundColor: elegantGray }]}>
          {/* Decorative Top Border */}
          <View style={{ 
            height: 4,
            backgroundColor: luxuryGold,
            marginBottom: 24
          }} />

          {/* Centered Logo with Ornamental Frame */}
          <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            {tenantLogoUrl ? (
              <View style={{ position: 'relative' }}>
                {/* Decorative Corners */}
                <View style={{ 
                  position: 'absolute',
                  top: -8,
                  left: -8,
                  width: 24,
                  height: 24,
                  borderTopWidth: 2,
                  borderLeftWidth: 2,
                  borderColor: luxuryGold
                }} />
                <View style={{ 
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderTopWidth: 2,
                  borderRightWidth: 2,
                  borderColor: luxuryGold
                }} />
                <View style={{ 
                  position: 'absolute',
                  bottom: -8,
                  left: -8,
                  width: 24,
                  height: 24,
                  borderBottomWidth: 2,
                  borderLeftWidth: 2,
                  borderColor: luxuryGold
                }} />
                <View style={{ 
                  position: 'absolute',
                  bottom: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderBottomWidth: 2,
                  borderRightWidth: 2,
                  borderColor: luxuryGold
                }} />
                
                <View style={{ 
                  backgroundColor: '#FFFFFF',
                  padding: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12
                }}>
                  <ExpoImage 
                    source={{ uri: tenantLogoUrl }} 
                    style={{ width: 100, height: 75 }} 
                    contentFit="contain" 
                    onLoad={onImageLoad}
                    onError={onImageLoad}
                  />
                </View>
              </View>
            ) : null}

            {/* Decorative Line with Diamond */}
            <View style={{ 
              width: '70%',
              height: 1,
              backgroundColor: luxuryGold + '40',
              marginVertical: 20,
              position: 'relative',
              alignSelf: 'center'
            }}>
              <View style={{ 
                position: 'absolute',
                top: -4,
                left: '50%',
                marginLeft: -4,
                width: 8,
                height: 8,
                backgroundColor: luxuryGold,
                transform: [{ rotate: '45deg' }]
              }} />
            </View>

            {/* Elegant Title */}
            <View style={{ 
              paddingHorizontal: 20,
              marginBottom: 16
            }}>
              <Text style={{ 
                fontSize: 24, 
                fontWeight: '300', 
                color: deepNavy,
                textAlign: 'center',
                lineHeight: 34,
                letterSpacing: 0.5
              }} numberOfLines={3}>
                {article.title}
              </Text>
            </View>

            {article.subTitle ? (
              <View style={{ 
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: luxuryGold + '30',
                marginBottom: 20
              }}>
                <Text style={{ 
                  fontSize: 13, 
                  color: '#555',
                  textAlign: 'center',
                  lineHeight: 20,
                  fontStyle: 'italic'
                }} numberOfLines={2}>
                  {article.subTitle}
                </Text>
              </View>
            ) : null}

            {/* Premium Image with Frame */}
            {article.coverImageUrl ? (
              <View style={{ 
                width: '90%',
                marginVertical: 20,
                borderWidth: 8,
                borderColor: '#FFFFFF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 15,
                position: 'relative'
              }}>
                <ExpoImage
                  source={{ uri: article.coverImageUrl }}
                  style={{ width: '100%', aspectRatio: 4/3 }}
                  contentFit="cover"
                  onLoad={onImageLoad}
                  onError={onImageLoad}
                />
                {/* Inner Border */}
                <View style={{ 
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  right: 4,
                  bottom: 4,
                  borderWidth: 1,
                  borderColor: luxuryGold + '60'
                }} />
              </View>
            ) : null}

            {/* Lead Text in Elegant Box */}
            {article.lead ? (
              <View style={{ 
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 20,
                paddingVertical: 16,
                marginVertical: 16,
                width: '90%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8
              }}>
                <Text style={{ 
                  fontSize: 13, 
                  lineHeight: 22, 
                  color: '#444',
                  textAlign: 'center'
                }} numberOfLines={4}>
                  {truncateWords(article.lead, 40)}
                </Text>
              </View>
            ) : null}

            {/* Refined Points */}
            {article.points && article.points.length > 0 ? (
              <View style={{ 
                width: '90%',
                backgroundColor: '#FFFFFF',
                padding: 20,
                marginVertical: 16,
                gap: 14
              }}>
                {article.points.slice(0, 3).map((point, idx) => (
                  <View key={idx} style={{ 
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start'
                  }}>
                    <View style={{ 
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: luxuryGold,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: elegantGray
                    }}>
                      <Text style={{ 
                        fontSize: 12, 
                        color: deepNavy,
                        fontWeight: '600'
                      }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text style={{ 
                      flex: 1, 
                      fontSize: 12, 
                      color: '#555',
                      lineHeight: 20
                    }} numberOfLines={2}>
                      {point}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Sophisticated Reporter Section */}
            {hasReporter ? (
              <View style={{ 
                width: '90%',
                marginTop: 20,
                paddingTop: 20,
                borderTopWidth: 1,
                borderTopColor: luxuryGold + '30',
                alignItems: 'center'
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{ 
                    borderWidth: 2,
                    borderColor: luxuryGold,
                    borderRadius: 35,
                    padding: 3,
                    marginBottom: 10
                  }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 60, height: 60, borderRadius: 30 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                  </View>
                ) : null}
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: '500', 
                  color: deepNavy,
                  marginBottom: 4
                }} numberOfLines={1}>
                  {reporter?.fullName}
                </Text>
                {locationStr ? (
                  <Text style={{ 
                    fontSize: 11, 
                    color: '#777',
                    fontStyle: 'italic'
                  }}>
                    {locationStr}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Reporter Quote Section - Luxury Style */}
            {hasReporter && reporter?.quote ? (
              <View style={{ 
                width: '90%',
                marginTop: 20,
                paddingVertical: 18,
                paddingHorizontal: 20,
                backgroundColor: elegantGray,
                borderTopWidth: 2,
                borderBottomWidth: 2,
                borderColor: luxuryGold,
                flexDirection: 'row',
                gap: 14,
                alignItems: 'center'
              }}>
                {reporter?.profilePhotoUrl ? (
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: luxuryGold
                  }}>
                    <ExpoImage
                      source={{ uri: reporter.profilePhotoUrl }}
                      style={{ width: 50, height: 50 }}
                      contentFit="cover"
                      onLoad={onImageLoad}
                      onError={onImageLoad}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons name="format-quote-open" size={16} color={luxuryGold} />
                  </View>
                  <Text style={{ 
                    fontSize: 12, 
                    fontStyle: 'italic', 
                    color: deepNavy,
                    lineHeight: 18,
                    marginBottom: 6
                  }} numberOfLines={2}>
                    {reporter.quote}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#777', letterSpacing: 0.5 }}>
                    — {reporter?.fullName}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Elegant Footer */}
          <View style={{ 
            marginTop: 28,
            paddingVertical: 16,
            backgroundColor: deepNavy,
            alignItems: 'center'
          }}>
            <View style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12
            }}>
              <View style={{ width: 30, height: 1, backgroundColor: luxuryGold }} />
              <Text style={{ 
                fontSize: 11, 
                color: luxuryGold,
                fontWeight: '600',
                letterSpacing: 2
              }}>
                EXCLUSIVE STORY
              </Text>
              <View style={{ width: 30, height: 1, backgroundColor: luxuryGold }} />
            </View>
          </View>

          {/* Decorative Bottom Border */}
          <View style={{ 
            height: 4,
            backgroundColor: luxuryGold
          }} />
        </View>
      );
    }, [article, tenantLogoUrl, hasReporter, reporter, locationStr, onImageLoad]);

    // Template renderer - switches between different design templates
    const renderTemplate = useCallback(() => {
      switch (currentTemplate) {
        case 'compact':
          return renderCompactTemplate();
        case 'magazine':
          return renderMagazineTemplate();
        case 'modern':
          return renderModernTemplate();
        case 'elegant':
          return renderElegantTemplate();
        case 'classic':
        default:
          return renderClassicTemplate();
      }
    }, [currentTemplate, renderClassicTemplate, renderCompactTemplate, renderMagazineTemplate, renderModernTemplate, renderElegantTemplate]);

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
            {renderTemplate()}
          </ViewShot>
        </View>

        {/* Style Picker Modal */}
        <Modal visible={showStylePicker} transparent animationType="slide">
          <View style={styles.stylePickerOverlay}>
            <View style={[styles.stylePickerContent, { backgroundColor: '#fff' }]}>
              <View style={styles.stylePickerHeader}>
                <Text style={styles.stylePickerTitle}>స్టైల్ ఎంచుకోండి</Text>
                <Pressable onPress={() => setShowStylePicker(false)}>
                  <MaterialIcons name="close" size={24} color="#333" />
                </Pressable>
              </View>
              
              <ScrollView style={styles.stylePickerScroll} showsVerticalScrollIndicator={false}>
                {DESIGN_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[
                      styles.styleOption,
                      currentTemplate === template.id && styles.styleOptionSelected,
                      { borderColor: currentTemplate === template.id ? primaryColor : '#ddd' }
                    ]}
                    onPress={async () => {
                      setCurrentTemplate(template.id);
                      setShowStylePicker(false);
                      // Small delay for UI update
                      await new Promise(resolve => setTimeout(resolve, 100));
                      // Trigger share with selected template
                      await captureAndShare(template.id);
                    }}
                  >
                    <Text style={styles.styleIcon}>{template.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.styleLabel, currentTemplate === template.id && { color: primaryColor }]}>
                        {template.label}
                      </Text>
                      <Text style={styles.styleDescription}>{template.description}</Text>
                    </View>
                    {currentTemplate === template.id && (
                      <MaterialIcons name="check-circle" size={24} color={primaryColor} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Capturing indicator */}
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

  // Style Picker Modal
  stylePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  stylePickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '70%',
  },
  stylePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stylePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  stylePickerScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  styleOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  styleIcon: {
    fontSize: 32,
  },
  styleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  styleDescription: {
    fontSize: 12,
    color: '#666',
  },
});
