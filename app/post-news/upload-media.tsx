import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadMedia } from '@/services/api';
import { loadTokens } from '@/services/auth';
import type { AIRewriteUnifiedResponse, MediaPhoto } from '@/services/aiRewriteUnified';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import { submitUnifiedArticle } from '@/services/unifiedArticle';
import { clearPostNewsAsyncStorage } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UploadedPhoto = {
  photoId: string;
  uri: string;
  url: string;
  caption: string;
  alt: string;
  mandatory: boolean;
  isExtra?: boolean;
};

type UploadedVideo = {
  uri: string;
  url: string;
};

const MAX_TOTAL_MEDIA = 5;

// Helper to extract Telugu text from multilingual fields
const getTeluguText = (field: string | Record<string, string> | undefined): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.te || field.en || Object.values(field)[0] || '';
};

export default function PostNewsUploadMediaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const newsIconAnim = useMemo(() => require('../../assets/lotti/News icon.json'), []);
  const congratsAnim = useMemo(() => require('../../assets/lotti/congratulation.json'), []);

  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<AIRewriteUnifiedResponse | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [noImagesAvailable, setNoImagesAvailable] = useState(false);

  // Location selection
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<CombinedLocationItem[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<CombinedLocationItem | null>(null);
  const [tenantId, setTenantId] = useState('');

  const totalMediaCount = uploadedPhotos.length + (uploadedVideo ? 1 : 0);
  const canAddMoreMedia = totalMediaCount < MAX_TOTAL_MEDIA;

  const loadData = useCallback(async () => {
    try {
      const storedResponse = await AsyncStorage.getItem('AI_REWRITE_RESPONSE');

      if (!storedResponse) {
        Alert.alert('Error', 'No article data found');
        router.back();
        return;
      }

      const parsed: AIRewriteUnifiedResponse = JSON.parse(storedResponse);
      setResponse(parsed);

      // Check if photos belong to THIS article by matching photo IDs
      const storedPhotos = await AsyncStorage.getItem('UPLOADED_PHOTOS');
      if (storedPhotos) {
        try {
          const parsedPhotos = JSON.parse(storedPhotos);
          if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
            // Get current article's photo IDs
            const currentPhotoIds = new Set(
              [...(parsed.media_requirements?.must_photos || []), ...(parsed.media_requirements?.support_photos || [])].map((p: MediaPhoto) => p.id)
            );
            
            // Only keep uploaded photos that match current article's photo requirements
            const validPhotos = parsedPhotos.filter(
              (p: UploadedPhoto) => 
                p && 
                typeof p.uri === 'string' && 
                p.uri.trim().length > 0 && 
                typeof p.url === 'string' && 
                p.url.trim().length > 0 &&
                (p.isExtra || currentPhotoIds.has(p.photoId)) // Keep extra photos or matched required photos
            );
            
            // If no valid photos match this article, clear storage
            if (validPhotos.length === 0) {
              await AsyncStorage.removeItem('UPLOADED_PHOTOS');
              setUploadedPhotos([]);
            } else {
              setUploadedPhotos(validPhotos);
              // Update storage with only valid photos
              if (validPhotos.length !== parsedPhotos.length) {
                await AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(validPhotos));
              }
            }
          }
        } catch {
          // Invalid data, clear it
          await AsyncStorage.removeItem('UPLOADED_PHOTOS');
          setUploadedPhotos([]);
        }
      }

      // Load previously uploaded video if any
      const storedVideo = await AsyncStorage.getItem('UPLOADED_VIDEO');
      if (storedVideo) {
        try {
          const parsedVideo = JSON.parse(storedVideo);
          if (parsedVideo?.url) {
            setUploadedVideo(parsedVideo);
          }
        } catch {}
      }

      // Load selected location
      const storedLocation = await AsyncStorage.getItem('SELECTED_LOCATION');
      if (storedLocation) {
        try {
          const parsedLocation = JSON.parse(storedLocation);
          if (parsedLocation?.match?.id) {
            setSelectedLocation(parsedLocation);
          }
        } catch {}
      }

      // Load tenant ID
      const storedTenantId = await AsyncStorage.getItem('AI_REWRITE_TENANT_ID');
      if (storedTenantId) {
        setTenantId(storedTenantId);
      }
    } catch {
      Alert.alert('Error', 'Failed to load article data');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-save is now handled in individual update functions
  // Removed duplicate useEffect to prevent race conditions

  // Auto-save uploaded video when it changes
  useEffect(() => {
    if (!loading) {
      if (uploadedVideo) {
        AsyncStorage.setItem('UPLOADED_VIDEO', JSON.stringify(uploadedVideo)).catch(() => {});
      } else {
        AsyncStorage.removeItem('UPLOADED_VIDEO').catch(() => {});
      }
    }
  }, [uploadedVideo, loading]);

  const pickImage = useCallback(async (photo: MediaPhoto) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant photo library permission to upload images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    setUploading(true);
    setUploadProgress('Uploading image...');
    try {
      const uploaded = await uploadMedia({
        uri: result.assets[0].uri,
        type: 'image',
        folder: 'posts',
      });

      // Extract Telugu text from multilingual fields
      const getTeluguText = (field: string | Record<string, string> | undefined): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        return field.te || field.en || Object.values(field)[0] || '';
      };
      
      const caption = getTeluguText(photo.caption_suggestion) || getTeluguText(photo.scene) || '';
      const alt = getTeluguText(photo.alt_suggestion) || getTeluguText(photo.scene) || '';

      const newPhoto: UploadedPhoto = {
        photoId: photo.id,
        uri: result.assets[0].uri,
        url: uploaded.url,
        caption,
        alt,
        mandatory: photo.mandatory,
      };

      setUploadedPhotos((prev) => {
        const filtered = prev.filter((p) => p.photoId !== photo.id);
        const updated = [...filtered, newPhoto];
        // Save immediately to prevent duplicate state
        AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, []);

  const pickExtraImage = useCallback(async () => {
    if (!canAddMoreMedia) {
      Alert.alert('Limit Reached', `Maximum ${MAX_TOTAL_MEDIA} media files allowed`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant photo library permission');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    setUploading(true);
    setUploadProgress('Uploading extra image...');
    try {
      const uploaded = await uploadMedia({
        uri: result.assets[0].uri,
        type: 'image',
        folder: 'posts',
      });

      const extraId = `extra_${Date.now()}`;
      const newPhoto: UploadedPhoto = {
        photoId: extraId,
        uri: result.assets[0].uri,
        url: uploaded.url,
        caption: '',
        alt: '',
        mandatory: false,
        isExtra: true,
      };

      setUploadedPhotos((prev) => {
        const updated = [...prev, newPhoto];
        // Save immediately to prevent duplicate state
        AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, [canAddMoreMedia]);

  const pickVideo = useCallback(async () => {
    if (!canAddMoreMedia) {
      Alert.alert('Limit Reached', `Maximum ${MAX_TOTAL_MEDIA} media files allowed`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant photo library permission');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled) return;

    setUploading(true);
    setUploadProgress('Uploading video...');
    try {
      const uploaded = await uploadMedia({
        uri: result.assets[0].uri,
        type: 'video',
        folder: 'posts',
      });

      setUploadedVideo({
        uri: result.assets[0].uri,
        url: uploaded.url,
      });
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Failed to upload video');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, [canAddMoreMedia]);

  const removePhoto = (photoId: string) => {
    setUploadedPhotos((prev) => {
      const updated = prev.filter((p) => p.photoId !== photoId);
      // Save immediately to prevent duplicate state
      if (updated.length === 0) {
        AsyncStorage.removeItem('UPLOADED_PHOTOS').catch(() => {});
      } else {
        AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(updated)).catch(() => {});
      }
      return updated;
    });
  };

  const removeVideo = () => {
    setUploadedVideo(null);
  };

  const updateCaption = (photoId: string, caption: string) => {
    setUploadedPhotos((prev) => {
      const updated = prev.map((p) => (p.photoId === photoId ? { ...p, caption } : p));
      // Save immediately
      AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const updateAlt = (photoId: string, alt: string) => {
    setUploadedPhotos((prev) => {
      const updated = prev.map((p) => (p.photoId === photoId ? { ...p, alt } : p));
      // Save immediately
      AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // Location search function
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim() || !tenantId) return;

    setLocationSearching(true);
    try {
      const result = await searchCombinedLocations(query.trim(), 20, tenantId);
      setLocationResults(result.items || []);
    } catch (error) {
      console.error('Location search failed:', error);
      setLocationResults([]);
    } finally {
      setLocationSearching(false);
    }
  }, [tenantId]);

  // Location selection handler
  const onLocationSelect = async (item: CombinedLocationItem) => {
    setSelectedLocation(item);
    await AsyncStorage.setItem('SELECTED_LOCATION', JSON.stringify(item));
    setLocationModalVisible(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  const onSubmit = async () => {
    if (!response) return;

    // Check if location is selected (required for submission)
    const hasLocation = !!(
      selectedLocation?.state?.id ||
      selectedLocation?.district?.id ||
      selectedLocation?.mandal?.id ||
      selectedLocation?.village?.id
    );

    if (!hasLocation) {
      // Open location selection modal
      setLocationModalVisible(true);
      return;
    }

    // Check if at least 1 image is uploaded OR noImagesAvailable toggle is ON
    const hasAtLeastOneImage = uploadedPhotos.length > 0;
    
    if (!hasAtLeastOneImage && !noImagesAvailable) {
      Alert.alert(
        'No Images',
        'Please upload at least 1 image or enable "No Images Available" option to proceed.',
        [{ text: 'OK' }]
      );
      return;
    }

    // If images are available, validate mandatory photos
    if (!noImagesAvailable) {
      const mustPhotos = response.media_requirements.must_photos || [];
      const mandatoryPhotoIds = mustPhotos.filter((p) => p.mandatory).map((p) => p.id);
      const uploadedMandatoryIds = uploadedPhotos.filter((p) => p.mandatory).map((p) => p.photoId);

      const missingMandatory = mandatoryPhotoIds.filter((id) => !uploadedMandatoryIds.includes(id));
      if (missingMandatory.length > 0) {
        Alert.alert('Required Photos Missing', 'Please upload all mandatory photos before submitting');
        return;
      }
    }

    await AsyncStorage.setItem('UPLOADED_PHOTOS', JSON.stringify(uploadedPhotos));
    if (uploadedVideo) {
      await AsyncStorage.setItem('UPLOADED_VIDEO', JSON.stringify(uploadedVideo));
    }

    setSubmitting(true);
    try {
      const result = await submitUnifiedArticle();

      if (result.success) {
        // Clear all post-news related AsyncStorage keys using centralized function
        await clearPostNewsAsyncStorage();

        setShowSuccess(true);
        
        // Load user role from tokens before timeout
        const tokens = await loadTokens();
        const userRole = tokens?.user?.role;
        
        // Determine dashboard route based on user role
        let dashboardRoute: string;
        if (userRole === 'TENANT_REPORTER' || userRole === 'REPORTER') {
          dashboardRoute = '/reporter/dashboard';
        } else if (userRole === 'TENANT_ADMIN') {
          dashboardRoute = '/tenant/dashboard';
        } else {
          dashboardRoute = '/(tabs)';
        }
        
        // Auto-navigate to appropriate dashboard after 2 seconds
        setTimeout(() => {
          setShowSuccess(false);
          router.replace(dashboardRoute as any);
        }, 2000);
      } else {
        Alert.alert('Submission Failed', result.message || 'Failed to create article');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit article');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !response) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={{ marginTop: 12, color: c.muted }}>లోడ్ అవుతోంది...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const mustPhotos = response.media_requirements.must_photos || [];
  const supportPhotos = response.media_requirements.support_photos || [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: c.card, borderColor: c.border },
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 17 }}>
          ఫోటోలు అప్‌లోడ్ చేయండి
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Required Photos */}
        {mustPhotos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="photo-camera" size={22} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                తప్పనిసరి ఫోటోలు
              </ThemedText>
            </View>

            {mustPhotos.map((photo, index) => {
              const uploaded = uploadedPhotos.find((p) => p.photoId === photo.id);

              return (
                <View key={`must_${photo.id}_${index}`} style={[styles.photoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.photoHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ThemedText style={{ color: c.text, fontWeight: '600' }}>
                          ఫోటో {index + 1}: {photo.photo_type}
                        </ThemedText>
                        {photo.mandatory && (
                          <View style={[styles.mandatoryBadge, { backgroundColor: '#EF4444' }]}>
                            <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                              తప్పనిసరి
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
                        {getTeluguText(photo.scene)}
                      </ThemedText>
                    </View>
                  </View>

                  {uploaded ? (
                    <View style={styles.uploadedSection}>
                      <Image
                        source={{ uri: uploaded.uri }}
                        style={styles.uploadedImage}
                        contentFit="cover"
                      />

                      <TextInput
                        value={uploaded.caption}
                        onChangeText={(text) => updateCaption(photo.id, text)}
                        placeholder={getTeluguText(photo.caption_suggestion) || photo.scene || 'Caption'}
                        placeholderTextColor={c.muted}
                        style={[styles.captionInput, { borderColor: c.border, color: c.text }]}
                        multiline
                      />

                      <TextInput
                        value={uploaded.alt}
                        onChangeText={(text) => updateAlt(photo.id, text)}
                        placeholder="Alt text (English)"
                        placeholderTextColor={c.muted}
                        style={[styles.altInput, { borderColor: c.border, color: c.text }]}
                      />

                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          { backgroundColor: '#EF4444' },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <MaterialIcons name="delete" size={16} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontSize: 13 }}>తీసివేయి</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => pickImage(photo)}
                      disabled={uploading}
                      style={({ pressed }) => [
                        styles.uploadBtn,
                        { borderColor: c.tint, backgroundColor: c.background },
                        pressed && { opacity: 0.7 },
                        uploading && { opacity: 0.5 },
                      ]}
                    >
                      <MaterialIcons name="add-photo-alternate" size={24} color={c.tint} />
                      <ThemedText style={{ color: c.tint, fontWeight: '600' }}>
                        {uploading ? 'Uploading...' : 'Upload Photo'}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Support Photos (Optional) */}
        {supportPhotos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="photo-library" size={22} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
                సహాయక ఫోటోలు (ఐచ్ఛికం)
              </ThemedText>
            </View>

            {supportPhotos.map((photo, index) => {
              const uploaded = uploadedPhotos.find((p) => p.photoId === photo.id);

              return (
                <View key={`support_${photo.id}_${index}`} style={[styles.photoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.photoHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ color: c.text, fontWeight: '600' }}>
                        సహాయక ఫోటో {index + 1}: {photo.photo_type}
                      </ThemedText>
                      <ThemedText style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
                        {getTeluguText(photo.scene)}
                      </ThemedText>
                    </View>
                  </View>

                  {uploaded ? (
                    <View style={styles.uploadedSection}>
                      <Image
                        source={{ uri: uploaded.uri }}
                        style={styles.uploadedImage}
                        contentFit="cover"
                      />

                      <TextInput
                        value={uploaded.caption}
                        onChangeText={(text) => updateCaption(photo.id, text)}
                        placeholder={getTeluguText(photo.caption_suggestion) || photo.scene || 'Caption'}
                        placeholderTextColor={c.muted}
                        style={[styles.captionInput, { borderColor: c.border, color: c.text }]}
                        multiline
                      />

                      <TextInput
                        value={uploaded.alt}
                        onChangeText={(text) => updateAlt(photo.id, text)}
                        placeholder="Alt text (English)"
                        placeholderTextColor={c.muted}
                        style={[styles.altInput, { borderColor: c.border, color: c.text }]}
                      />

                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          { backgroundColor: '#EF4444' },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <MaterialIcons name="delete" size={16} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontSize: 13 }}>తీసివేయి</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => pickImage(photo)}
                      disabled={uploading}
                      style={({ pressed }) => [
                        styles.uploadBtn,
                        { borderColor: c.border, backgroundColor: c.background },
                        pressed && { opacity: 0.7 },
                        uploading && { opacity: 0.5 },
                      ]}
                    >
                      <MaterialIcons name="add-photo-alternate" size={24} color={c.muted} />
                      <ThemedText style={{ color: c.muted, fontWeight: '600' }}>
                        {uploading ? 'అప్‌లోడ్ అవుతోంది...' : 'ఫోటో అప్‌లోడ్ చేయండి (ఐచ్ఛికం)'}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Extra Images Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="add-photo-alternate" size={22} color={c.tint} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
              అదనపు ఫోటోలు
            </ThemedText>
            <View style={[styles.countBadge, { backgroundColor: c.tint + '20' }]}>
              <ThemedText style={{ color: c.tint, fontSize: 11, fontWeight: '600' }}>
                {totalMediaCount}/{MAX_TOTAL_MEDIA}
              </ThemedText>
            </View>
          </View>

          {/* Show extra uploaded images */}
          {uploadedPhotos.filter(p => p.isExtra).map((photo) => (
            <View key={photo.photoId} style={[styles.extraPhotoCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Image source={{ uri: photo.uri }} style={styles.extraImage} contentFit="cover" />
              <View style={styles.extraPhotoInfo}>
                <TextInput
                  value={photo.caption}
                  onChangeText={(text) => updateCaption(photo.photoId, text)}
                  placeholder="శీర్షిక జోడించండి..."
                  placeholderTextColor={c.muted}
                  style={[styles.extraCaptionInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                />
                <Pressable onPress={() => removePhoto(photo.photoId)} style={styles.extraRemoveBtn}>
                  <MaterialIcons name="close" size={20} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}

          {canAddMoreMedia && (
            <Pressable
              onPress={pickExtraImage}
              disabled={uploading}
              style={({ pressed }) => [
                styles.addExtraBtn,
                { borderColor: c.tint, backgroundColor: c.card },
                pressed && { opacity: 0.7 },
                uploading && { opacity: 0.5 },
              ]}
            >
              <MaterialIcons name="add" size={24} color={c.tint} />
              <ThemedText style={{ color: c.tint, fontWeight: '600' }}>
                అదనపు ఫోటో జోడించండి
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* No Images Available Toggle */}
        {uploadedPhotos.length === 0 && (
          <View style={[styles.noImagesSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <MaterialIcons name="info-outline" size={20} color={c.tint} />
                <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>
                  చిత్రాలు అందుబాటులో లేవా?
                </ThemedText>
              </View>
              <ThemedText style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
                ఈ వార్తకు చిత్రాలు అందుబాటులో లేకపోతే దీన్ని ఆన్ చేయండి. మీరు ఫోటోలు లేకుండా కూడా పోస్ట్ చేయవచ్చు.
              </ThemedText>
            </View>
            <Switch
              value={noImagesAvailable}
              onValueChange={(value) => {
                setNoImagesAvailable(value);
                if (value) {
                  Alert.alert(
                    'No Images Mode',
                    'You can proceed without uploading images. The article will be posted without photos.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              trackColor={{ false: c.border, true: c.tint + '80' }}
              thumbColor={noImagesAvailable ? c.tint : c.muted}
            />
          </View>
        )}

        {/* Video Upload Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="videocam" size={22} color={c.text} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 16 }}>
              వీడియో (ఐచ్ఛికం)
            </ThemedText>
          </View>

          {uploadedVideo ? (
            <View style={[styles.videoCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.videoPreview}>
                <MaterialIcons name="videocam" size={40} color={c.tint} />
                <ThemedText style={{ color: c.text, marginTop: 8 }}>వీడియో అప్‌లోడ్ అయింది</ThemedText>
              </View>
              <Pressable
                onPress={removeVideo}
                style={({ pressed }) => [
                  styles.removeBtn,
                  { backgroundColor: '#EF4444' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialIcons name="delete" size={16} color="#fff" />
                <ThemedText style={{ color: '#fff', fontSize: 13 }}>వీడియో తీసివేయి</ThemedText>
              </Pressable>
            </View>
          ) : canAddMoreMedia ? (
            <Pressable
              onPress={pickVideo}
              disabled={uploading}
              style={({ pressed }) => [
                styles.uploadBtn,
                { borderColor: c.border, backgroundColor: c.card },
                pressed && { opacity: 0.7 },
                uploading && { opacity: 0.5 },
              ]}
            >
              <MaterialIcons name="videocam" size={24} color={c.muted} />
              <ThemedText style={{ color: c.muted, fontWeight: '600' }}>
                వీడియో అప్‌లోడ్ చేయండి (ఐచ్ఛికం)
              </ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.limitReached, { backgroundColor: c.card, borderColor: c.border }]}>
              <ThemedText style={{ color: c.muted, textAlign: 'center' }}>
                మీడియా పరిమితి చేరుకుంది (గరిష్టం {MAX_TOTAL_MEDIA})
              </ThemedText>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
        {noImagesAvailable && uploadedPhotos.length === 0 && (
          <View style={[styles.noImagesWarning, { backgroundColor: '#FEF3C7' }]}>
            <MaterialIcons name="warning" size={18} color="#F59E0B" />
            <ThemedText style={{ color: '#92400E', fontSize: 13, flex: 1, lineHeight: 18 }}>
              వార్త చిత్రాలు లేకుండా పోస్ట్ చేయబడుతుంది
            </ThemedText>
          </View>
        )}
        <Pressable
          onPress={onSubmit}
          disabled={submitting || uploading}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: c.tint },
            pressed && { opacity: 0.85 },
            (submitting || uploading) && { opacity: 0.5 },
          ]}
        >
          {submitting ? (
            <>
              <ActivityIndicator color="#fff" />
              <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                ప్రచురిస్తోంది...
              </ThemedText>
            </>
          ) : (
            <>
              <MaterialIcons name="publish" size={20} color="#fff" />
              <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                {noImagesAvailable && uploadedPhotos.length === 0 ? 'చిత్రాలు లేకుండా ప్రచురించు' : 'వార్త సమర్పించండి'}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* Upload Progress Modal */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.uploadModal}>
          <View style={[styles.uploadModalContent, { backgroundColor: c.card }]}>
            <LottieView source={newsIconAnim} autoPlay loop style={{ width: 100, height: 100 }} />
            <ThemedText style={{ color: c.text, marginTop: 8, fontWeight: '600' }}>
              {uploadProgress || 'Uploading...'}
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 12 }} color={c.tint} />
          </View>
        </View>
      </Modal>

      {/* Publishing Modal */}
      <Modal visible={submitting} transparent animationType="fade">
        <View style={styles.publishModal}>
          <View style={[styles.publishModalContent, { backgroundColor: c.background }]}>
            <LottieView source={newsIconAnim} autoPlay loop style={{ width: 180, height: 180 }} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 20, marginTop: 16 }}>
              మీ వార్తను ప్రచురిస్తోంది...
            </ThemedText>
            <ThemedText style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>
              మీ వార్తను ప్రచురిస్తే వరకు దయచేసి వేచి ఉండండి
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color={c.tint} />
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="none">
        <View style={styles.successModal}>
          <View style={[styles.successModalContent, { backgroundColor: c.background }]}>
            <LottieView source={congratsAnim} autoPlay loop={false} style={{ width: 220, height: 220 }} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 22, marginTop: 16 }}>
              అభినందనలు! 🎉
            </ThemedText>
            <ThemedText style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>
              మీ ఆర్టికల్ విజయవంతంగా సబ్మిట్ చేయబడింది
            </ThemedText>
          </View>
        </View>
      </Modal>

      {/* Location Search Modal */}
      <Modal visible={locationModalVisible} animationType="slide" transparent>
        <View style={styles.locationModalOverlay}>
          <View style={[styles.locationModalContent, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.locationModalHeader, { borderBottomColor: c.border }]}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 17 }}>
                  లొకేషన్ ఎంచుకోండి
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                  ప్రచురణకు లొకేషన్ తప్పనిసరి
                </ThemedText>
              </View>
              <Pressable onPress={() => setLocationModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <View style={styles.locationSearchContainer}>
              <MaterialIcons name="search" size={20} color={c.muted} />
              <TextInput
                value={locationQuery}
                onChangeText={setLocationQuery}
                onSubmitEditing={() => searchLocation(locationQuery)}
                placeholder="ప్రదేశం పేరు వేతకండి..."
                placeholderTextColor={c.muted}
                style={[styles.locationSearchInput, { color: c.text }]}
                autoFocus
              />
              {locationSearching && <ActivityIndicator size="small" />}
            </View>

            <Pressable
              onPress={() => searchLocation(locationQuery)}
              style={({ pressed }) => [
                styles.locationSearchBtn,
                { backgroundColor: c.tint },
                pressed && { opacity: 0.85 },
              ]}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '600' }}>వేతకండి</ThemedText>
            </Pressable>

            <ScrollView style={styles.locationResultsContainer}>
              {locationResults.length === 0 && locationQuery.trim() && !locationSearching && (
                <View style={styles.locationEmptyResults}>
                  <MaterialIcons name="search-off" size={40} color={c.muted} />
                  <ThemedText style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>
                    లోకేషన్లు కనపడలేదు
                  </ThemedText>
                </View>
              )}
              {locationResults.map((item) => (
                <Pressable
                  key={`${item.type}_${item.match.id}`}
                  onPress={() => onLocationSelect(item)}
                  style={({ pressed }) => [
                    styles.locationResultItem,
                    { borderBottomColor: c.border },
                    pressed && { backgroundColor: c.background },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ color: c.text, fontWeight: '600' }}>
                      {item.match.name}
                    </ThemedText>
                    <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                      {item.type}
                    </ThemedText>
                    {item.district && (
                      <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                        District: {item.district.name}
                      </ThemedText>
                    )}
                    {item.state && (
                      <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                        State: {item.state.name}
                      </ThemedText>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={c.muted} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  photoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mandatoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  uploadBtn: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadedSection: {
    gap: 12,
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
  },
  altInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Extra photos styles
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  extraPhotoCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 12,
  },
  extraImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  extraPhotoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extraCaptionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
  },
  extraRemoveBtn: {
    padding: 4,
  },
  addExtraBtn: {
    height: 56,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Video styles
  videoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  videoPreview: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitReached: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  // Modal styles
  uploadModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  publishModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    width: '85%',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successActions: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  successPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  successPrimaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  successSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  successSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  locationModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
  },
  locationModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  locationSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  locationSearchBtn: {
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  locationResultsContainer: {
    flex: 1,
    marginBottom: 20,
  },
  locationResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  locationEmptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noImagesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  noImagesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
});
