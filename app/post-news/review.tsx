import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { formatMonthDayFromLexicon, getDateLineLanguage } from '@/constants/dateLineLexicon';
import { useColorScheme } from '@/hooks/useColorScheme';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
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

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    const v: any = value;
    if (typeof v.title === 'string' && typeof v.content === 'string') {
      return v.title.trim() ? `${v.title}: ${v.content}` : v.content;
    }
    if (typeof v.content === 'string') return v.content;
    if (typeof v.title === 'string') return v.title;
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
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

  // Audio refs - REMOVED location audio to prevent double playback
  const reviewSoundRef = useRef<Audio.Sound | null>(null);
  const reviewVoicePlayedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(true);

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
      setHeadline(toDisplayText(parsed.print_article.headline));
      setSubtitle(toDisplayText(parsed.print_article.subtitle) || '');
      setBodyParagraphs(
        Array.isArray(parsed.print_article.body)
          ? parsed.print_article.body.map((p: any) => toDisplayText(p))
          : []
      );
      setPlaceName(toDisplayText(parsed.print_article.dateline?.place));
      setNewspaperName(toDisplayText(parsed.print_article.dateline?.newspaper) || '');

      // Load previously selected location (for back navigation)
      const storedLocation = await AsyncStorage.getItem('SELECTED_LOCATION');
      if (storedLocation) {
        try {
          const parsedLocation = JSON.parse(storedLocation);
          if (parsedLocation?.match?.id) {
            setSelectedLocation(parsedLocation);
            setLocationAutoSearchDone(true); // Don't re-search if already selected

            // Reset place name to the selected location name
            const lang = getDateLineLanguage(storedLanguage || 'te');
            const localizedName = (parsedLocation.match?.names as any)?.[lang] || parsedLocation.match?.name;
            if (localizedName) {
              setPlaceName(localizedName);
            }
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

  // Play review voice when this screen loads (Telugu only)
  // AUTO-STOP after playing once to prevent overlap with location audio
  useEffect(() => {
    const playReviewVoice = async () => {
      if (loading || !isFocused) return;
      const lc = String(languageCode || '').toLowerCase();
      if (!lc.startsWith('te')) return;
      if (reviewVoicePlayedRef.current) return;
      reviewVoicePlayedRef.current = true;

      try {
        if (reviewSoundRef.current) {
          await reviewSoundRef.current.unloadAsync();
          reviewSoundRef.current = null;
        }
        const { sound } = await Audio.Sound.createAsync(
          require('@/assets/audio/Review_post_voice_telugu.mp3'),
          { shouldPlay: true, isLooping: false, volume: 1.0 }
        );
        reviewSoundRef.current = sound;
        
        // Auto-stop after audio finishes to prevent overlap
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(console.error);
            reviewSoundRef.current = null;
          }
        });
      } catch (error) {
        console.error('Failed to play review voice:', error);
      }
    };

    void playReviewVoice();
  }, [loading, languageCode, isFocused]);

  // REMOVED: Location audio now handled in separate screen
  // This prevents double audio playback issue

  // Stop audio when screen loses focus (navigation away)
  useFocusEffect(
    useCallback(() => {
      // Screen gained focus - reload location data in case it changed
      setIsFocused(true);
      
      // Reload location if it was set in the location selection screen
      (async () => {
        try {
          const storedLocation = await AsyncStorage.getItem('SELECTED_LOCATION');
          const storedDateline = await AsyncStorage.getItem('FORMATTED_DATELINE');
          if (storedLocation) {
            const parsedLocation = JSON.parse(storedLocation);
            if (parsedLocation?.match?.id) {
              setSelectedLocation(parsedLocation);
              setLocationAutoSearchDone(true);

              // Reset place name to the selected location name
              const lang = getDateLineLanguage(languageCode || 'te');
              const localizedName = (parsedLocation.match?.names as any)?.[lang] || parsedLocation.match?.name;
              if (localizedName) {
                setPlaceName(localizedName);
              }
            }
          }
          if (storedDateline) {
            setDatelineText(storedDateline);
          }
        } catch {}
      })();
      
      return () => {
        // Screen losing focus - stop audio immediately
        setIsFocused(false);
        
        if (reviewSoundRef.current) {
          reviewSoundRef.current.stopAsync().catch(console.error);
          reviewSoundRef.current.unloadAsync().catch(console.error);
          reviewSoundRef.current = null;
        }
      };
    }, [languageCode])
  );

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (reviewSoundRef.current) {
        reviewSoundRef.current.unloadAsync().catch(console.error);
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
          // No results - just format dateline with place name as-is
          // User can click to open location selection screen
          const formatted = formatDateline(placeName, newspaperName, languageCode);
          setDatelineText(formatted);
        }
      } catch (error: any) {
        console.error('Auto location search failed:', error);
        // On error, just format dateline with place name
        const formatted = formatDateline(placeName, newspaperName, languageCode);
        setDatelineText(formatted);
      } finally {
        setLocationSearching(false);
        setLocationAutoSearchDone(true);
      }
    };
    
    autoSearchLocation();
  }, [placeName, tenantId, loading, locationAutoSearchDone, languageCode, newspaperName]);

  // REMOVED: All location search and modal functions - now handled in separate screen

  const onNext = async () => {
    if (!headline.trim()) {
      Alert.alert('Error', 'Headline is required');
      return;
    }

    // If place name is empty, take user directly to location selection
    if (!placeName.trim()) {
      // Stop review audio before navigating
      if (reviewSoundRef.current) {
        try {
          await reviewSoundRef.current.stopAsync();
          await reviewSoundRef.current.unloadAsync();
          reviewSoundRef.current = null;
        } catch {}
      }

      router.push({
        pathname: '/post-news/select-location' as any,
        params: {
          tenantId,
          languageCode,
          initialQuery: '',
          newspaperName,
        },
      });
      return;
    }

    // Location ID is required - if not selected, navigate to location selection screen
    if (!selectedLocation?.match?.id) {
      // Stop review audio before navigating
      if (reviewSoundRef.current) {
        try {
          await reviewSoundRef.current.stopAsync();
          await reviewSoundRef.current.unloadAsync();
          reviewSoundRef.current = null;
        } catch {}
      }

      // Directly take user to location screen (no modal/blocked state)
      router.push({
        pathname: '/post-news/select-location' as any,
        params: {
          tenantId,
          languageCode,
          initialQuery: placeName,
          newspaperName,
        },
      });
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
            onPress={async () => {
              // Stop review audio before navigating to prevent overlap
              if (reviewSoundRef.current) {
                try {
                  await reviewSoundRef.current.stopAsync();
                  await reviewSoundRef.current.unloadAsync();
                  reviewSoundRef.current = null;
                } catch {}
              }
              
              // Navigate to dedicated location selection screen
              router.push({
                pathname: '/post-news/select-location' as any,
                params: {
                  tenantId,
                  languageCode,
                  initialQuery: placeName,
                  newspaperName,
                },
              });
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
              <MaterialIcons name="edit" size={16} color={c.muted} />
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
              {printArticle.highlights.map((highlight: any, index) => (
                <View key={index} style={styles.highlightRow}>
                  <MaterialIcons name="check-circle" size={16} color={c.tint} />
                  <ThemedText style={[styles.highlightText, { color: c.text }]}>{toDisplayText(highlight)}</ThemedText>
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
              {toDisplayText(response.detected_category || printArticle.news_type || 'General')}
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
              <ThemedText style={{ color: c.text }}>{toDisplayText(printArticle.fact_box as any)}</ThemedText>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Next Button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={onNext}
          disabled={locationSearching}
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: locationSearching ? c.muted : c.tint },
            pressed && { opacity: 0.85 },
            locationSearching && { opacity: 0.7 },
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
                Select Location
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

      {/* REMOVED: Location search modal and location not found popup */}
      {/* These are now handled in the dedicated /post-news/select-location screen */}
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
