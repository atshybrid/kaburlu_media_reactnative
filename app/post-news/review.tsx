import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { formatMonthDayFromLexicon, getDateLineLanguage } from '@/constants/dateLineLexicon';
import { useColorScheme } from '@/hooks/useColorScheme';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AIRewriteUnifiedResponse } from '@/services/aiRewriteUnified';

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

  // Auto-search location when placeName is set (from AI response)
  useEffect(() => {
    if (locationAutoSearchDone || !placeName.trim() || !tenantId || loading) return;
    
    const autoSearchLocation = async () => {
      setLocationSearching(true);
      try {
        const result = await searchCombinedLocations(placeName.trim(), 20, tenantId);
        const items = result.items || [];
        
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
          // No results - use AI provided place name with default dateline
          const formatted = formatDateline(placeName, newspaperName, languageCode);
          setDatelineText(formatted);
        }
      } catch (error) {
        console.error('Auto location search failed:', error);
        // Fallback to AI provided dateline
        const formatted = formatDateline(placeName, newspaperName, languageCode);
        setDatelineText(formatted);
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
      setLocationResults(result.items || []);
      
      // Update newspaper name if available
      if (result.tenant?.nativeName) {
        setNewspaperName(result.tenant.nativeName);
      }
    } catch (error) {
      console.error('Location search failed:', error);
      setLocationResults([]);
    } finally {
      setLocationSearching(false);
    }
  }, [tenantId]);

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

  const onNext = async () => {
    if (!headline.trim()) {
      Alert.alert('Error', 'Headline is required');
      return;
    }

    if (!placeName.trim()) {
      Alert.alert('Error', 'Place name is required');
      return;
    }

    // Update response with edited values and resolved location
    const updatedResponse: AIRewriteUnifiedResponse = {
      ...response!,
      print_article: {
        ...response!.print_article,
        headline: headline.trim(),
        subtitle: subtitle.trim() || null,
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
            {printArticle.body.map((paragraph, index) => (
              <ThemedText key={index} style={[styles.previewParagraph, { color: c.text }]}>
                {paragraph}
              </ThemedText>
            ))}
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
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: c.tint },
            pressed && { opacity: 0.85 },
          ]}
        >
          <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Next: Add Photos</ThemedText>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Location Search Modal */}
      <Modal visible={locationModalVisible} animationType="slide" transparent>
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
                onSubmitEditing={() => searchLocation(locationQuery)}
                placeholder="Search place name..."
                placeholderTextColor={c.muted}
                style={[styles.searchInput, { color: c.text }]}
                autoFocus
              />
              {locationSearching && <ActivityIndicator size="small" />}
            </View>

            <Pressable
              onPress={() => searchLocation(locationQuery)}
              style={({ pressed }) => [
                styles.searchBtn,
                { backgroundColor: c.tint },
                pressed && { opacity: 0.85 },
              ]}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Search</ThemedText>
            </Pressable>

            <ScrollView style={styles.resultsContainer}>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
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
});
