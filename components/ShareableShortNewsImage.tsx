/**
 * ShareableShortNewsImage - Generate shareable image for short news
 * 
 * Features:
 * - Short news title and content
 * - Cover image
 * - Bottom 20% reserved for citizen reporter caption/comment
 * - Profile photo, name, and comment text in caption section
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Share,
    StyleSheet,
    Text,
    View
} from 'react-native';
import RNShare from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import { Image as ExpoImage } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = Math.min(SCREEN_WIDTH - 32, 400);
const PRIMARY_COLOR = '#e42223';

// Font constants
const FONTS = {
  REGULAR: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  BOLD: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
};

// Types
export interface ShareableShortNewsData {
  id: string;
  title: string;
  content: string;
  coverImageUrl?: string;
  caption?: string; // 40-char write option
  reporter?: {
    id?: string;
    fullName?: string;
    profilePhotoUrl?: string;
    location?: string;
  };
  options?: {
    positive: number;
    negative: number;
    total: number;
    topOptions?: {
      userName: string;
      content: string;
      type: 'POSITIVE' | 'NEGATIVE';
    }[];
  };
}

export interface ShareableShortNewsImageRef {
  captureAndShare: () => Promise<void>;
  capture: () => Promise<string | null>;
}

interface Props {
  shortNews: ShareableShortNewsData;
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

const ShareableShortNewsImage = forwardRef<ShareableShortNewsImageRef, Props>(
  (
    { 
      shortNews, 
      tenantName = 'Kaburlu Media', 
      tenantLogoUrl, 
      tenantPrimaryColor = PRIMARY_COLOR,
      onCaptureStart,
      onCaptureEnd,
      visible = false 
    },
    ref
  ) => {
    const viewShotRef = useRef<ViewShot>(null);
    const [capturing, setCapturing] = useState(false);
    const [logoError, setLogoError] = useState(false);
    const [profileError, setProfileError] = useState(false);

    // Capture and share
    const captureAndShare = useCallback(async () => {
      if (capturing) return;
      setCapturing(true);
      onCaptureStart?.();
      
      try {
        const uri = await viewShotRef.current?.capture?.();
        if (!uri) throw new Error('Failed to capture image');
        
        if (Platform.OS === 'ios') {
          // iOS: Use React Native's built-in Share API which properly handles image + message together
          await Share.share({
            url: uri,
            message: shortNews.title,
            title: 'Share Short News',
          }, {
            dialogTitle: 'Share Short News'
          });
        } else {
          // Android: Use react-native-share which supports image + text together
          await RNShare.open({
            url: `file://${uri}`,
            type: 'image/png',
            title: 'Share Short News',
            message: shortNews.title,
          });
        }
      } catch (error: any) {
        if (error?.message !== 'User did not share') {
          console.error('[ShareableShortNews] Share failed:', error);
        }
      } finally {
        setCapturing(false);
        onCaptureEnd?.();
      }
    }, [capturing, shortNews.title, onCaptureStart, onCaptureEnd]);

    // Capture only (returns URI)
    const capture = useCallback(async () => {
      if (capturing) return null;
      setCapturing(true);
      onCaptureStart?.();
      
      try {
        const uri = await viewShotRef.current?.capture?.();
        return uri || null;
      } catch (error) {
        console.error('[ShareableShortNews] Capture failed:', error);
        return null;
      } finally {
        setCapturing(false);
        onCaptureEnd?.();
      }
    }, [capturing, onCaptureStart, onCaptureEnd]);

    useImperativeHandle(ref, () => ({
      captureAndShare,
      capture,
    }));

    // Calculate caption height (20% of total image)
    const TOTAL_HEIGHT = 600;
    const CAPTION_HEIGHT = TOTAL_HEIGHT * 0.2; // 120px
    const CONTENT_HEIGHT = TOTAL_HEIGHT - CAPTION_HEIGHT; // 480px

    // If we have options, we'll show them instead of just caption
    const hasOptions = shortNews.options && shortNews.options.total > 0;
    const showCaption = shortNews.caption && !hasOptions;

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 0.9 }}
            style={[styles.viewShotWrapper, { width: IMAGE_WIDTH }]}
          >
            {/* Main Content Area (80%) */}
            <View style={[styles.contentArea, { height: CONTENT_HEIGHT, backgroundColor: '#ffffff' }]}>
              {/* Header with Logo */}
              <View style={styles.header}>
                {tenantLogoUrl && !logoError ? (
                  <ExpoImage
                    source={{ uri: tenantLogoUrl }}
                    style={styles.logo}
                    contentFit="contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <Text style={[styles.tenantName, { color: tenantPrimaryColor }]}>
                    {tenantName}
                  </Text>
                )}
              </View>

              {/* Cover Image */}
              {shortNews.coverImageUrl && (
                <View style={styles.coverContainer}>
                  <ExpoImage
                    source={{ uri: shortNews.coverImageUrl }}
                    style={styles.coverImage}
                    contentFit="cover"
                  />
                </View>
              )}

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={2}>
                  {shortNews.title}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.contentContainer}>
                <Text style={styles.content} numberOfLines={4}>
                  {truncateWords(shortNews.content, 60)}
                </Text>
              </View>
            </View>

            {/* Caption Area (20%) - Reporter Comment or Options */}
            {(showCaption || hasOptions) && (
              <View style={[styles.captionArea, { height: CAPTION_HEIGHT, backgroundColor: '#f8f9fa' }]}>
                {hasOptions ? (
                  /* Show Options */
                  <View style={styles.optionsSection}>
                    <View style={styles.optionsHeader}>
                      <View style={styles.optionsStat}>
                        <Text style={styles.optionsStatNumber}>{shortNews.options!.positive}</Text>
                        <Text style={styles.optionsStatLabel}>👍 Agree</Text>
                      </View>
                      <View style={styles.optionsStatDivider} />
                      <View style={styles.optionsStat}>
                        <Text style={styles.optionsStatNumber}>{shortNews.options!.negative}</Text>
                        <Text style={styles.optionsStatLabel}>👎 Disagree</Text>
                      </View>
                      <View style={styles.optionsStatDivider} />
                      <View style={styles.optionsStat}>
                        <Text style={styles.optionsStatNumber}>{shortNews.options!.total}</Text>
                        <Text style={styles.optionsStatLabel}>💬 Total</Text>
                      </View>
                    </View>
                    
                    {shortNews.options!.topOptions && shortNews.options!.topOptions.length > 0 && (
                      <View style={styles.topOptionsContainer}>
                        {shortNews.options!.topOptions.slice(0, 2).map((option, idx) => (
                          <View key={idx} style={styles.topOption}>
                            <Text style={styles.topOptionIcon}>
                              {option.type === 'POSITIVE' ? '👍' : '👎'}
                            </Text>
                            <Text style={styles.topOptionText} numberOfLines={1}>
                              {option.userName}: {option.content}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Show Reporter Caption */
                  <View style={styles.captionContent}>
                    {/* Profile Photo */}
                    {shortNews.reporter?.profilePhotoUrl && !profileError ? (
                      <ExpoImage
                        source={{ uri: shortNews.reporter.profilePhotoUrl }}
                        style={styles.profilePhoto}
                        contentFit="cover"
                        onError={() => setProfileError(true)}
                      />
                    ) : (
                      <View style={[styles.profilePhoto, styles.profilePlaceholder]}>
                        <Text style={styles.profileInitial}>
                          {shortNews.reporter?.fullName?.charAt(0) || 'R'}
                        </Text>
                      </View>
                    )}

                    {/* Caption Text and Name */}
                    <View style={styles.captionTextContainer}>
                      <Text style={styles.captionText} numberOfLines={2}>
                        &ldquo;{shortNews.caption}&rdquo;
                      </Text>
                      <Text style={styles.reporterName} numberOfLines={1}>
                        - {shortNews.reporter?.fullName || 'Citizen Reporter'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ViewShot>

          {capturing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={tenantPrimaryColor} />
              <Text style={styles.loadingText}>Generating image...</Text>
            </View>
          )}
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewShotWrapper: {
    backgroundColor: '#ffffff',
  },
  contentArea: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 120,
    height: 40,
  },
  tenantName: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: FONTS.BOLD,
  },
  coverContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FONTS.BOLD,
    color: '#1a1a1a',
    lineHeight: 24,
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#4a4a4a',
    lineHeight: 20,
  },
  captionArea: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
    justifyContent: 'center',
  },
  captionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  profilePlaceholder: {
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: FONTS.BOLD,
  },
  captionTextContainer: {
    flex: 1,
  },
  captionText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#2a2a2a',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  reporterName: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    color: '#666666',
  },
  optionsSection: {
    flex: 1,
    padding: 10,
    gap: 8,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  optionsStat: {
    alignItems: 'center',
    gap: 2,
  },
  optionsStatNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: FONTS.BOLD,
    color: '#1a1a1a',
  },
  optionsStatLabel: {
    fontSize: 9,
    color: '#666666',
  },
  optionsStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
  },
  topOptionsContainer: {
    gap: 4,
  },
  topOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 6,
  },
  topOptionIcon: {
    fontSize: 12,
  },
  topOptionText: {
    flex: 1,
    fontSize: 10,
    color: '#4a4a4a',
    fontFamily: FONTS.REGULAR,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 14,
  },
});

ShareableShortNewsImage.displayName = 'ShareableShortNewsImage';

export default ShareableShortNewsImage;
