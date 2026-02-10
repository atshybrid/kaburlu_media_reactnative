import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { formatMonthDayFromLexicon, getDateLineLanguage } from '@/constants/dateLineLexicon';
import { useColorScheme } from '@/hooks/useColorScheme';
import { searchCombinedLocations, requestAddLocation, smartAddLocation, searchDistricts, type CombinedLocationItem, type SmartAddLocationRequest } from '@/services/locations';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AIRewriteUnifiedResponse } from '@/services/aiRewriteUnified';
import { Audio } from 'expo-av';

// Format dateline: "కూకట్‌పల్లి (కబుర్లు టుడే) జనవరి 28"
function formatDateline(
  placeName: string,
  newspaperName: string,
  langCode: string,
  date = new Date()
): string {
  const monthDay = formatMonthDayFromLexicon(langCode, date);
  return `${placeName} (${newspaperName}) ${monthDay}`;
}

export default function PostNewsReviewScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<AIRewriteUnifiedResponse | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [languageCode, setLanguageCode] = useState('te');
  const [newspaperName, setNewspaperName] = useState('');

  // Editable fields
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [bodyParagraphs, setBodyParagraphs] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Location data
  const [placeName, setPlaceName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<CombinedLocationItem | null>(null);
  const [datelineText, setDatelineText] = useState('');
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationAutoSearchDone, setLocationAutoSearchDone] = useState(false);

  // Location search modal
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<CombinedLocationItem[]>([]);

  // Location not found popup
  const [locationNotFoundVisible, setLocationNotFoundVisible] = useState(false);
  const [notFoundPlaceName, setNotFoundPlaceName] = useState('');
  const [requestingAdd, setRequestingAdd] = useState(false);
  
  // Smart location creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<CombinedLocationItem | null>(null);
  const [selectedState, setSelectedState] = useState<CombinedLocationItem | null>(null);
  const [districtQuery, setDistrictQuery] = useState('');
  const [districtResults, setDistrictResults] = useState<CombinedLocationItem[]>([]);
  const [districtSearching, setDistrictSearching] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);

  // Audio for location popup
  const soundRef = useRef<Audio.Sound | null>(null);

  const loadData = useCallback(async () => {
    try {
      const storedResponse = await AsyncStorage.getItem('AI_REWRITE_RESPONSE');
      const storedTenantId = await AsyncStorage.getItem('AI_REWRITE_TENANT_ID');
      const storedLanguage = await AsyncStorage.getItem('AI_REWRITE_LANGUAGE');

      if (!storedResponse) {
        Alert.alert('Error', 'No article data found');
        router.back();
        return;
      }

      const parsed: AIRewriteUnifiedResponse = JSON.parse(storedResponse);
      setResponse(parsed);
      setTenantId(storedTenantId || '');
      setLanguageCode(storedLanguage || 'te');

      // Set editable fields
      setHeadline(parsed.print_article.headline);
      setSubtitle(parsed.print_article.subtitle || '');
      setBodyParagraphs(parsed.print_article.body || []);
      setPlaceName(parsed.print_article.dateline.place);
      setNewspaperName(parsed.print_article.dateline.newspaper || '');

      // Load previously selected location (for back navigation)
      const storedLocation = await AsyncStorage.getItem('SELECTED_LOCATION');
      if (storedLocation) {
        try {
          const parsedLocation = JSON.parse(storedLocation);
          if (parsedLocation?.id) {
            setSelectedLocation(parsedLocation);
            setLocationAutoSearchDone(true); // Don't re-search if already selected
          }
        } catch {}
      }

      // Load previously formatted dateline
      const storedDateline = await AsyncStorage.getItem('FORMATTED_DATELINE');
      if (storedDateline) {
        setDatelineText(storedDateline);
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

  // Play audio when location not found popup opens (Telugu only)
  useEffect(() => {
    const playLocationAudio = async () => {
      if (locationNotFoundVisible && languageCode === 'te') {
        try {
          // Unload previous sound if exists
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }

          // Load and play new sound
          const { sound } = await Audio.Sound.createAsync(
            require('@/assets/audio/AI Location add.mp3'),
            { shouldPlay: true, isLooping: true, volume: 0.7 }
          );
          soundRef.current = sound;
        } catch (error) {
          console.error('Failed to play location audio:', error);
        }
      } else {
        // Stop audio when popup closes
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          } catch (error) {
            console.error('Failed to stop audio:', error);
          }
        }
      }
    };

    playLocationAudio();
  }, [locationNotFoundVisible, languageCode]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Auto-search location when placeName is set (from AI response)
  useEffect(() => {
    if (locationAutoSearchDone || !placeName.trim() || !tenantId || loading) return;
    
    const autoSearchLocation = async () => {
      setLocationSearching(true);
      let items: CombinedLocationItem[] = [];
      let result: any;
      
      try {
        // First attempt: exact search
        result = await searchCombinedLocations(placeName.trim(), 20, tenantId);
        items = result.items || [];
        
        // Update newspaper name from API response if available
        if (result.tenant?.nativeName) {
          setNewspaperName(result.tenant.nativeName);
        } else if (result.tenant?.name) {
          setNewspaperName(result.tenant.name);
        }

        if (items.length > 0) {
          // Auto-select best match
          const lang = getDateLineLanguage(languageCode);
          let bestMatch = items[0];
          const searchLower = placeName.trim().toLowerCase();
          
          for (const item of items) {
            const names = item.match?.names || {};
            const matchName = String((names as any)?.[lang] || item.match?.name || '').toLowerCase();
            if (matchName === searchLower) {
              bestMatch = item;
              break;
            }
          }
          
          // Set selected location and update dateline
          setSelectedLocation(bestMatch);
          const localizedName = (bestMatch.match?.names as any)?.[lang] || bestMatch.match?.name || placeName;
          setPlaceName(localizedName);
          
          // Format dateline
          const effectiveNewspaper = result.tenant?.nativeName || result.tenant?.name || newspaperName;
          const formatted = formatDateline(localizedName, effectiveNewspaper, languageCode);
          setDatelineText(formatted);
        } else {
          // Second attempt: try with simplified query (remove special chars, extra spaces)
          try {
            const simplifiedQuery = placeName.trim().replace(/[,\-\s]+/g, ' ').trim();
            if (simplifiedQuery !== placeName.trim()) {
              console.log('Retry with simplified query:', simplifiedQuery);
              result = await searchCombinedLocations(simplifiedQuery, 20, tenantId);
              items = result.items || [];
              
              if (items.length > 0) {
                const lang = getDateLineLanguage(languageCode);
                const bestMatch = items[0];
                setSelectedLocation(bestMatch);
                const localizedName = (bestMatch.match?.names as any)?.[lang] || bestMatch.match?.name || placeName;
                setPlaceName(localizedName);
                const formatted = formatDateline(localizedName, newspaperName, languageCode);
                setDatelineText(formatted);
              } else {
                // Still no results - show not found popup
                setNotFoundPlaceName(placeName);
                setLocationNotFoundVisible(true);
                const formatted = formatDateline(placeName, newspaperName, languageCode);
                setDatelineText(formatted);
              }
            } else {
              // No variation possible - show not found popup
              setNotFoundPlaceName(placeName);
              setLocationNotFoundVisible(true);
              const formatted = formatDateline(placeName, newspaperName, languageCode);
              setDatelineText(formatted);
            }
          } catch (retryError) {
            console.error('Second search attempt failed:', retryError);
            setNotFoundPlaceName(placeName);
            setLocationNotFoundVisible(true);
            const formatted = formatDateline(placeName, newspaperName, languageCode);
            setDatelineText(formatted);
          }
        }
      } catch (error: any) {
        console.error('Auto location search failed:', error);
        // Try second attempt with simplified query
        try {
          const simplifiedQuery = placeName.trim().replace(/[,\-\s]+/g, ' ').trim();
          if (simplifiedQuery && simplifiedQuery !== placeName.trim()) {
            console.log('Retry after error with simplified query:', simplifiedQuery);
            result = await searchCombinedLocations(simplifiedQuery, 20, tenantId);
            items = result.items || [];
            
            if (items.length > 0) {
              const lang = getDateLineLanguage(languageCode);
              const bestMatch = items[0];
              setSelectedLocation(bestMatch);
              const localizedName = (bestMatch.match?.names as any)?.[lang] || bestMatch.match?.name || placeName;
              setPlaceName(localizedName);
              const formatted = formatDateline(localizedName, newspaperName, languageCode);
              setDatelineText(formatted);
            } else {
              throw new Error('No results after retry');
            }
          } else {
            throw error;
          }
        } catch (finalError: any) {
          console.error('All search attempts failed:', finalError);
          setNotFoundPlaceName(placeName);
          setLocationNotFoundVisible(true);
          const formatted = formatDateline(placeName, newspaperName, languageCode);
          setDatelineText(formatted);
        }
      } finally {
        setLocationSearching(false);
        setLocationAutoSearchDone(true);
      }
    };
    
    autoSearchLocation();
  }, [placeName, tenantId, loading, locationAutoSearchDone, languageCode, newspaperName]);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim() || !tenantId) return;

    setLocationSearching(true);
    try {
      const result = await searchCombinedLocations(query.trim(), 20, tenantId);
      const items = result.items || [];
      setLocationResults(items);
      
      // Update newspaper name if available
      if (result.tenant?.nativeName) {
        setNewspaperName(result.tenant.nativeName);
      }
    } catch (error: any) {
      console.error('Location search failed:', error);
      setLocationResults([]);
      // Don't show popup for auto-search, only manual search
      // Show location not found popup for 404 errors
      if (error?.status === 404 || error?.message?.includes('404')) {
        setNotFoundPlaceName(query.trim());
        setLocationModalVisible(false);
        setLocationNotFoundVisible(true);
      }
    } finally {
      setLocationSearching(false);
    }
  }, [tenantId]);

  // Auto-search when user types in location modal
  useEffect(() => {
    // Only auto-search when modal is visible and query has at least 2 characters
    if (!locationModalVisible || locationQuery.trim().length < 2) {
      setLocationResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchLocation(locationQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [locationQuery, locationModalVisible, searchLocation]);

  const onLocationSelect = (item: CombinedLocationItem) => {
    setSelectedLocation(item);
    const lang = getDateLineLanguage(languageCode);
    const localizedName = (item.match?.names as any)?.[lang] || item.match?.name || '';
    setPlaceName(localizedName);
    
    // Update dateline with new location
    const formatted = formatDateline(localizedName, newspaperName, languageCode);
    setDatelineText(formatted);
    
    setLocationModalVisible(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  const handleRequestAddLocation = async () => {
    if (!notFoundPlaceName.trim() || !tenantId) return;
    
    setRequestingAdd(true);
    try {
      await requestAddLocation(notFoundPlaceName.trim(), tenantId, languageCode);
      Alert.alert(
        'Request Sent',
        `Location "${notFoundPlaceName}" has been requested. Our team will add it soon.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to request location:', error);
      Alert.alert('Error', 'Failed to send request. Please try again later.');
    } finally {
      setRequestingAdd(false);
      setLocationNotFoundVisible(false);
    }
  };
  
  // Search districts when user types
  const handleDistrictSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setDistrictResults([]);
      return;
    }
    
    setDistrictSearching(true);
    try {
      const result = await searchDistricts(query.trim(), selectedState?.match?.id, 20);
      setDistrictResults(result.items || []);
    } catch (error) {
      console.error('District search failed:', error);
      setDistrictResults([]);
    } finally {
      setDistrictSearching(false);
    }
  }, [selectedState]);
  
  // Handle create location with smart-add API
  const handleCreateAndUseLocation = async () => {
    if (!notFoundPlaceName.trim()) {
      Alert.alert('లోపం', 'లొకేషన్ పేరు తప్పనిసరి');
      return;
    }
    
    if (!selectedDistrict) {
      Alert.alert('లోపం', 'దయచేసి జిల్లా ఎంచుకోండి');
      return;
    }
    
    setCreatingLocation(true);
    try {
      const params: SmartAddLocationRequest = {
        areaName: notFoundPlaceName.trim(),
        stateName: selectedState?.match?.name || selectedDistrict?.state?.name || 'Telangana',
        languageCode: languageCode,
        forceType: 'mandal',
        parentDistrictName: selectedDistrict.match.name,
        parentDistrictId: selectedDistrict.match.id,
      };
      
      console.log('Creating location with params:', params);
      const result = await smartAddLocation(params);
      
      if (result.success && result.location) {
        // Convert to CombinedLocationItem format
        const newLocation: CombinedLocationItem = {
          type: result.type.toUpperCase() as any,
          match: {
            id: result.location.id,
            name: result.location.name,
            names: result.location.translations.reduce((acc, t) => {
              acc[t.language] = t.name;
              return acc;
            }, {} as Record<string, string>),
          },
          state: selectedState?.match || selectedDistrict?.state || null,
          district: selectedDistrict?.match || null,
          mandal: result.type === 'mandal' ? {
            id: result.location.id,
            name: result.location.name,
          } : null,
          village: result.type === 'village' ? {
            id: result.location.id,
            name: result.location.name,
          } : null,
        };
        
        // Set as selected location
        setSelectedLocation(newLocation);
        
        // Get localized name from translation
        const localizedName = result.translation?.name || result.location.name;
        setPlaceName(localizedName);
        
        // Update dateline
        const formatted = formatDateline(localizedName, newspaperName, languageCode);
        setDatelineText(formatted);
        
        // Close modals
        setLocationNotFoundVisible(false);
        setShowCreateForm(false);
        
        Alert.alert(
          'Success',
          `Location "${localizedName}" created successfully and ready to use!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Failed to create location:', error);
      Alert.alert(
        'Error',
        error?.error || error?.message || 'Failed to create location. Please try again.'
      );
    } finally {
      setCreatingLocation(false);
    }
  };

  const onNext = async () => {
    if (!headline.trim()) {
      Alert.alert('Error', 'Headline is required');
      return;
    }

    if (!placeName.trim()) {
      Alert.alert('Error', 'Place name is required');
      return;
    }

    // Location ID is required - if not selected, open search modal
    if (!selectedLocation?.match?.id) {
      setLocationQuery(placeName);
      setLocationModalVisible(true);
      return;
    }

    // Update response with edited values and resolved location
    const updatedResponse: AIRewriteUnifiedResponse = {
      ...response!,
      print_article: {
        ...response!.print_article,
        headline: headline.trim(),
        subtitle: subtitle.trim() || null,
        body: bodyParagraphs.filter(p => p.trim()), // Remove empty paragraphs
        dateline: {
          ...response!.print_article.dateline,
          place: placeName.trim(),
        },
      },
    };

    // Store updated response and selected location
    await AsyncStorage.setItem('AI_REWRITE_RESPONSE', JSON.stringify(updatedResponse));
    if (selectedLocation) {
      await AsyncStorage.setItem('SELECTED_LOCATION', JSON.stringify(selectedLocation));
    }
    // Store dateline text separately for easy access
    await AsyncStorage.setItem('FORMATTED_DATELINE', datelineText);

    // Navigate to media upload
    router.push('/post-news/upload-media' as any);
  };

  if (loading || !response) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={{ marginTop: 12, color: c.muted }}>Loading...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const printArticle = response.print_article;

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
          Review Article
        </ThemedText>
        <Pressable
          onPress={() => setIsEditMode(!isEditMode)}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: isEditMode ? c.tint : c.card, borderColor: c.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <MaterialIcons name={isEditMode ? 'check' : 'edit'} size={20} color={isEditMode ? '#fff' : c.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Article Preview Style - Headline at top */}
        <View style={[styles.articlePreview, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Headline */}
          <View style={styles.previewSection}>
            {isEditMode ? (
              <TextInput
                value={headline}
                onChangeText={setHeadline}
                placeholder="Enter headline"
                placeholderTextColor={c.muted}
                style={[styles.headlineInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                multiline
              />
            ) : (
              <ThemedText style={[styles.previewHeadline, { color: c.text }]}>{headline}</ThemedText>
            )}
          </View>

          {/* Subtitle (only show if has value or in edit mode) */}
          {(subtitle.trim() || isEditMode) && (
            <View style={styles.previewSection}>
              {isEditMode ? (
                <TextInput
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder="Enter subtitle (optional)"
                  placeholderTextColor={c.muted}
                  style={[styles.subtitleInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                  multiline
                />
              ) : (
                <ThemedText style={[styles.previewSubtitle, { color: c.muted }]}>{subtitle}</ThemedText>
              )}
            </View>
          )}

          {/* Article Body */}
          <View style={[styles.previewSection, styles.bodySection]}>
            {isEditMode ? (
              <View style={{ gap: 12 }}>
                {bodyParagraphs.map((paragraph, index) => (
                  <View key={index}>
                    <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 4, fontWeight: '600' }}>
                      Paragraph {index + 1}
                    </ThemedText>
                    <TextInput
                      value={paragraph}
                      onChangeText={(text) => {
                        const updated = [...bodyParagraphs];
                        updated[index] = text;
                        setBodyParagraphs(updated);
                      }}
                      placeholder={`Enter paragraph ${index + 1} content`}
                      placeholderTextColor={c.muted}
                      style={[
                        styles.bodyInput,
                        { borderColor: c.border, color: c.text, backgroundColor: c.background }
                      ]}
                      multiline
                    />
                  </View>
                ))}
                <Pressable
                  onPress={() => setBodyParagraphs([...bodyParagraphs, ''])}
                  style={({ pressed }) => [
                    styles.addParagraphBtn,
                    { borderColor: c.tint },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialIcons name="add" size={18} color={c.tint} />
                  <ThemedText style={{ color: c.tint, fontWeight: '600', marginLeft: 4 }}>
                    Add Paragraph
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              bodyParagraphs.map((paragraph, index) => (
                <ThemedText key={index} style={[styles.previewParagraph, { color: c.text }]}>
                  {paragraph}
                </ThemedText>
              ))
            )}
          </View>

          {/* Dateline at bottom of article */}
          <Pressable
            onPress={() => {
              setLocationQuery(placeName);
              setLocationModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.datelineSection,
              { borderTopColor: c.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={styles.datelineContent}>
              <MaterialIcons name="location-on" size={16} color={c.tint} />
              <ThemedText style={[styles.datelinePreview, { color: c.text }]}>
                {datelineText || `${placeName} (${newspaperName}) ...`}
              </ThemedText>
              {locationSearching ? (
                <ActivityIndicator size="small" />
              ) : (
                <MaterialIcons name="edit" size={16} color={c.muted} />
              )}
            </View>
          </Pressable>
        </View>

        {/* Highlights */}
        {printArticle.highlights && printArticle.highlights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="star" size={20} color={c.tint} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Highlights</ThemedText>
            </View>
            <View style={[styles.highlightsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {printArticle.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightRow}>
                  <MaterialIcons name="check-circle" size={16} color={c.tint} />
                  <ThemedText style={[styles.highlightText, { color: c.text }]}>{highlight}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* News Type */}
        {printArticle.news_type && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="newspaper" size={20} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>News Type</ThemedText>
            </View>
            <View style={[styles.tagCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <ThemedText style={{ color: c.text, fontWeight: '500' }}>{printArticle.news_type}</ThemedText>
            </View>
          </View>
        )}

        {/* Category - Auto filled */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="category" size={20} color={c.tint} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Category</ThemedText>
            <View style={[styles.autoTag, { backgroundColor: c.tint + '20' }]}>
              <ThemedText style={{ color: c.tint, fontSize: 10, fontWeight: '600' }}>AUTO</ThemedText>
            </View>
          </View>
          <View style={[styles.tagCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <ThemedText style={{ color: c.text, fontWeight: '600' }}>
              {response.detected_category || printArticle.news_type || 'General'}
            </ThemedText>
          </View>
        </View>

        {/* Fact Box */}
        {printArticle.fact_box && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info" size={20} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Fact Box</ThemedText>
            </View>
            <View style={[styles.factBoxCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <ThemedText style={{ color: c.text }}>{printArticle.fact_box}</ThemedText>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Next Button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={onNext}
          disabled={!selectedLocation || locationSearching}
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: c.tint },
            pressed && { opacity: 0.85 },
            (!selectedLocation || locationSearching) && { opacity: 0.5, backgroundColor: c.muted },
          ]}
        >
          {locationSearching ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                Searching Location...
              </ThemedText>
            </>
          ) : !selectedLocation ? (
            <>
              <MaterialIcons name="location-off" size={20} color="#fff" />
              <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                Select Location First
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Next: Add Photos</ThemedText>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

      {/* Location Search Modal */}
      <Modal visible={locationModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 17 }}>
                  Search Location
                </ThemedText>
                <Pressable onPress={() => setLocationModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={c.text} />
                </Pressable>
              </View>

              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={20} color={c.muted} />
                <TextInput
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  placeholder="Type to search places... (auto-search)"
                  placeholderTextColor={c.muted}
                  style={[styles.searchInput, { color: c.text }]}
                  autoFocus
                />
                {locationSearching && <ActivityIndicator size="small" />}
              </View>

            <ScrollView style={styles.resultsContainer}>
              {locationResults.length === 0 && locationQuery.trim() && !locationSearching && (
                <View style={styles.emptyResults}>
                  <MaterialIcons name="search-off" size={40} color={c.muted} />
                  <ThemedText style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>
                    No locations found for &ldquo;{locationQuery}&rdquo;
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setNotFoundPlaceName(locationQuery.trim());
                      setLocationModalVisible(false);
                      setLocationNotFoundVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.notFoundBtn,
                      { borderColor: c.tint },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <MaterialIcons name="report" size={16} color={c.tint} />
                    <ThemedText style={{ color: c.tint, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>
                      Location Not Listed?
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              {locationResults.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={() => onLocationSelect(item)}
                  style={({ pressed }) => [
                    styles.resultItem,
                    { borderBottomColor: c.border },
                    pressed && { backgroundColor: c.background },
                  ]}
                >
                  <View>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Not Found Popup */}
      <Modal visible={locationNotFoundVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.popupOverlay}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.popupContent, { backgroundColor: c.card, borderColor: c.border, maxWidth: showCreateForm ? 440 : 360 }]}>
                {!showCreateForm ? (
                  <>
                    {/* Initial Not Found Message */}
                    <View style={[styles.popupIcon, { backgroundColor: '#e74c3c15' }]}>
                      <MaterialIcons name="location-off" size={44} color="#e74c3c" />
                    </View>
                    <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 19, textAlign: 'center' }}>
                      లొకేషన్ అందుబాటులో లేదు
                    </ThemedText>
                    <ThemedText style={{ color: c.muted, textAlign: 'center', marginTop: 10, lineHeight: 22, fontSize: 14, paddingHorizontal: 4 }}>
                      &ldquo;{notFoundPlaceName}&rdquo; మా డేటాబేస్‌లో ఇంకా లేదు.
                    </ThemedText>
                    
                    <View style={styles.popupButtons}>
                      {/* Create Now - Primary Action */}
                      <Pressable
                        onPress={() => {
                          setShowCreateForm(true);
                          setDistrictQuery('');
                          setSelectedDistrict(null);
                        }}
                        style={({ pressed }) => [
                          styles.popupBtn,
                          styles.popupBtnPrimary,
                          { backgroundColor: c.tint },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <MaterialIcons name="add-location" size={22} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 }}>
                          ఇప్పుడే క్రియేట్ చేయండి
                        </ThemedText>
                      </Pressable>
                      
                      {/* Search Different */}
                      <Pressable
                        onPress={() => {
                          setLocationNotFoundVisible(false);
                          setLocationQuery('');
                          setLocationModalVisible(true);
                        }}
                        style={({ pressed }) => [
                          styles.popupBtn,
                          { borderWidth: 1.5, borderColor: c.tint, backgroundColor: c.background },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <MaterialIcons name="search" size={20} color={c.tint} />
                        <ThemedText style={{ color: c.tint, fontWeight: '600', marginLeft: 8, fontSize: 15 }}>
                          వేరే పేరుతో వెతకండి
                        </ThemedText>
                      </Pressable>
                      
                      {/* Request Later */}
                      <Pressable
                        onPress={handleRequestAddLocation}
                        disabled={requestingAdd}
                        style={({ pressed }) => [
                          styles.popupBtn,
                          { 
                            borderWidth: 1.5, 
                            borderColor: c.border,
                            backgroundColor: c.background,
                          },
                          pressed && { opacity: 0.7 },
                          requestingAdd && { opacity: 0.6 },
                        ]}
                      >
                        {requestingAdd ? (
                          <ActivityIndicator size="small" color={c.text} />
                        ) : (
                          <>
                            <MaterialIcons name="send" size={18} color={c.muted} />
                            <ThemedText style={{ color: c.muted, fontSize: 14, marginLeft: 8, fontWeight: '500' }}>
                              తరువాత యాడ్మిన్‌ను అడగండి
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Create Location Form */}
                    <View style={{ alignItems: 'center', marginBottom: 24 }}>
                      <View style={[styles.popupIcon, { backgroundColor: c.tint + '15' }]}>
                        <MaterialIcons name="add-location" size={44} color={c.tint} />
                      </View>
                      <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 19, textAlign: 'center', paddingHorizontal: 8 }}>
                        &ldquo;{notFoundPlaceName}&rdquo; క్రియేట్ చేయండి
                      </ThemedText>
                      <ThemedText style={{ color: c.muted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                        ఈ లొకేషన్ జోడించడానికి జిల్లా ఎంచుకోండి
                      </ThemedText>
                    </View>

                    {/* District Selection */}
                    <View style={{ marginBottom: 20, width: '100%' }}>
                      <ThemedText style={{ color: c.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
                        జిల్లా ఎంచుకోండి <ThemedText style={{ color: '#e74c3c' }}>*</ThemedText>
                      </ThemedText>
                      <ThemedText style={{ color: c.muted, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
                        {notFoundPlaceName} ఏ జిల్లాలో ఉంది?
                      </ThemedText>
                      
                      {selectedDistrict ? (
                        <View style={[styles.selectedDistrictCard, { backgroundColor: c.tint + '08', borderColor: c.tint }]}>
                          <MaterialIcons name="location-on" size={22} color={c.tint} />
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>
                              {selectedDistrict.match.name}
                            </ThemedText>
                            {selectedDistrict.state && (
                              <ThemedText style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>
                                {selectedDistrict.state.name}
                              </ThemedText>
                            )}
                          </View>
                          <Pressable
                            onPress={() => {
                              setSelectedDistrict(null);
                              setDistrictQuery('');
                            }}
                            hitSlop={10}
                            style={({ pressed }) => [
                              { 
                                backgroundColor: c.background,
                                borderRadius: 20,
                                padding: 6,
                              },
                              pressed && { opacity: 0.7 }
                            ]}
                          >
                            <MaterialIcons name="close" size={18} color={c.muted} />
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <View style={[styles.searchRow, { borderColor: c.border, backgroundColor: c.card }]}>
                            <MaterialIcons name="search" size={20} color={c.muted} />
                            <TextInput
                              value={districtQuery}
                              onChangeText={(text) => {
                                setDistrictQuery(text);
                                if (text.trim().length >= 2) {
                                  handleDistrictSearch(text);
                                } else {
                                  setDistrictResults([]);
                                }
                              }}
                              placeholder="జిల్లా పేరు వెతకండి..."
                              placeholderTextColor={c.muted}
                              style={[styles.searchRowInput, { color: c.text, fontSize: 15 }]}
                            />
                            {districtSearching && <ActivityIndicator size="small" color={c.tint} />}
                          </View>
                          
                          {districtResults.length > 0 && (
                            <ScrollView style={[styles.districtResults, { borderColor: c.border, backgroundColor: c.card }]}>
                              {districtResults.map((item, index) => (
                                <Pressable
                                  key={index}
                                  onPress={() => {
                                    setSelectedDistrict(item);
                                    if (item.state) {
                                      setSelectedState(item);
                                    }
                                    setDistrictResults([]);
                                    setDistrictQuery('');
                                  }}
                                  style={({ pressed }) => [
                                    styles.districtResultItem,
                                    { 
                                      borderBottomColor: c.border,
                                      backgroundColor: pressed ? c.background : 'transparent',
                                    },
                                    index === districtResults.length - 1 && { borderBottomWidth: 0 },
                                  ]}
                                >
                                  <MaterialIcons name="location-city" size={20} color={c.muted} style={{ marginRight: 10 }} />
                                  <View style={{ flex: 1 }}>
                                    <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>
                                      {item.match.name}
                                    </ThemedText>
                                    {item.state && (
                                      <ThemedText style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>
                                        {item.state.name}
                                      </ThemedText>
                                    )}
                                  </View>
                                  <MaterialIcons name="chevron-right" size={20} color={c.muted} />
                                </Pressable>
                              ))}
                            </ScrollView>
                          )}
                        </>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={{ gap: 12, marginTop: 24, width: '100%' }}>
                      <Pressable
                        onPress={handleCreateAndUseLocation}
                        disabled={!selectedDistrict || creatingLocation}
                        style={({ pressed }) => [
                          styles.popupBtn,
                          styles.popupBtnPrimary,
                          { backgroundColor: c.tint },
                          pressed && { opacity: 0.85 },
                          (!selectedDistrict || creatingLocation) && { opacity: 0.5 },
                        ]}
                      >
                        {creatingLocation ? (
                          <>
                            <ActivityIndicator size="small" color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: 10, fontSize: 15 }}>
                              క్రియేట్ అవుతోంది...
                            </ThemedText>
                          </>
                        ) : (
                          <>
                            <MaterialIcons name="check-circle" size={22} color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 }}>
                              క్రియేట్ చేసి వాడండి
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                      
                      <Pressable
                        onPress={() => {
                          setShowCreateForm(false);
                          setSelectedDistrict(null);
                          setSelectedState(null);
                          setDistrictQuery('');
                          setDistrictResults([]);
                        }}
                        style={({ pressed }) => [
                          styles.popupBtn,
                          { 
                            borderWidth: 1.5, 
                            borderColor: c.border,
                            backgroundColor: c.background,
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <MaterialIcons name="arrow-back" size={20} color={c.text} />
                        <ThemedText style={{ color: c.text, fontWeight: '600', marginLeft: 6, fontSize: 15 }}>
                          వెనక్కి
                        </ThemedText>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 50,
  },
  viewCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  headlineText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  autoTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  datelineCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  datelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datelineText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  datelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  bodyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  highlightsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  factBoxCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    height: '30%',
    minHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  searchBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    maxHeight: 400,
    marginTop: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  // Article Preview Styles
  articlePreview: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  previewHeadline: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  previewSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  headlineInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
    minHeight: 60,
  },
  subtitleInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    minHeight: 50,
  },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  addParagraphBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  bodySection: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  previewParagraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 10,
  },
  datelineSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  datelinePreview: {
    flex: 1,
    fontSize: 14,
    marginLeft: 6,
  },
  tagCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  popupIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(231,76,60,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  popupInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  popupButtons: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  popupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popupBtnPrimary: {
    // additional styling handled inline
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  notFoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  typeChipLarge: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  selectedDistrictCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchRowInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  districtResults: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  districtResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  stateDisplay: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
