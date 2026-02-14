import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { formatMonthDayFromLexicon, getDateLineLanguage, normalizeLangBaseCode } from '@/constants/dateLineLexicon';
import { useColorScheme } from '@/hooks/useColorScheme';
import { searchCombinedLocations, requestAddLocation, smartAddLocation, searchDistricts, type CombinedLocationItem, type SmartAddLocationRequest } from '@/services/locations';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
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
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import { Audio } from 'expo-av';

export default function LocationSelectionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    tenantId?: string;
    languageCode?: string;
    initialQuery?: string;
    newspaperName?: string;
  }>();

  const [tenantId] = useState(params.tenantId || '');
  const [languageCode] = useState(params.languageCode || 'te');
  const [newspaperName] = useState(params.newspaperName || '');
  
  const [searchQuery, setSearchQuery] = useState(params.initialQuery || '');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CombinedLocationItem[]>([]);
  
  // Location not found - request add
  const [showNotFound, setShowNotFound] = useState(false);
  const [notFoundPlaceName, setNotFoundPlaceName] = useState('');
  const [requestingAdd, setRequestingAdd] = useState(false);
  
  // Create location form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createKind, setCreateKind] = useState<'mandal' | 'district'>('mandal');
  const [newDistrictName, setNewDistrictName] = useState('');
  const [newDistrictStateName, setNewDistrictStateName] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<CombinedLocationItem | null>(null);
  const [districtQuery, setDistrictQuery] = useState('');
  const [districtResults, setDistrictResults] = useState<CombinedLocationItem[]>([]);
  const [districtSearching, setDistrictSearching] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const districtInputRef = useRef<any>(null);

  const norm = (s: string) => s.trim().toLowerCase();

  const translationsToNames = (translations: { language: string; name: string }[]) => {
    return translations.reduce((acc, t) => {
      const base = normalizeLangBaseCode(t.language);
      acc[base] = t.name;
      return acc;
    }, {} as Record<string, string>);
  };

  // Auto-search on mount if initialQuery provided
  useEffect(() => {
    if (params.initialQuery && params.initialQuery.trim().length >= 2) {
      performSearch(params.initialQuery.trim());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Play audio when showing "not found" (Telugu only)
  useEffect(() => {
    const playAudio = async () => {
      if (showNotFound && languageCode === 'te') {
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
          const { sound } = await Audio.Sound.createAsync(
            require('@/assets/audio/AI Location add.mp3'),
            { shouldPlay: true, isLooping: true, volume: 0.7 }
          );
          soundRef.current = sound;
        } catch (error) {
          console.error('Failed to play audio:', error);
        }
      } else {
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          } catch {}
        }
      }
    };
    playAudio();
  }, [showNotFound, languageCode]);

  useEffect(() => {
    if (showNotFound && showCreateForm) {
      const t = setTimeout(() => {
        districtInputRef.current?.focus?.();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [showNotFound, showCreateForm]);

  const clearNotFoundUI = () => {
    setShowNotFound(false);
    setNotFoundPlaceName('');
    setShowCreateForm(false);
    setCreateKind('mandal');
    setNewDistrictName('');
    setNewDistrictStateName('');
    setSelectedDistrict(null);
    setDistrictQuery('');
    setDistrictResults([]);
  };

  const resetAllAndStartOver = () => {
    clearNotFoundUI();
    setSearchQuery('');
    setResults([]);
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || !tenantId) return;

    setSearching(true);
    clearNotFoundUI();
    
    try {
      const result = await searchCombinedLocations(query.trim(), 20, tenantId);
      const items = result.items || [];
      setResults(items);
      
      if (items.length === 0) {
        setNotFoundPlaceName(query.trim());
        setShowNotFound(true);
        setShowCreateForm(true);
        setCreateKind('mandal');
        setNewDistrictName('');
        setNewDistrictStateName('');
      }
    } catch (error: any) {
      console.error('Location search failed:', error);
      setResults([]);
      
      if (error?.status === 404 || error?.message?.includes('404')) {
        setNotFoundPlaceName(query.trim());
        setShowNotFound(true);
        setShowCreateForm(true);
        setCreateKind('mandal');
        setNewDistrictName('');
        setNewDistrictStateName('');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (text.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        performSearch(text);
      }, 400);
    } else {
      setResults([]);
      clearNotFoundUI();
    }
  };

  const handleLocationSelect = async (item: CombinedLocationItem) => {
    // Save to AsyncStorage
    await AsyncStorage.setItem('SELECTED_LOCATION', JSON.stringify(item));
    
    // Get localized name
    const lang = getDateLineLanguage(languageCode);
    const localizedName = (item.match?.names as any)?.[lang] || item.match?.name || '';
    
    // Format dateline
    const monthDay = formatMonthDayFromLexicon(languageCode, new Date());
    const dateline = `${localizedName} (${newspaperName}) ${monthDay}`;
    await AsyncStorage.setItem('FORMATTED_DATELINE', dateline);
    
    // Navigate back
    router.back();
  };

  const handleRequestAdd = async () => {
    setRequestingAdd(true);
    try {
      await requestAddLocation(notFoundPlaceName, tenantId);
      Alert.alert(
        'Request Submitted',
        `Your request to add "${notFoundPlaceName}" has been submitted. It will be reviewed by admins.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit request');
    } finally {
      setRequestingAdd(false);
    }
  };

  const searchDistrict = async (query: string) => {
    if (!query.trim() || !tenantId) return;
    
    setDistrictSearching(true);
    try {
      const result = await searchDistricts(query.trim(), tenantId);
      setDistrictResults(result.items || []);
    } catch (error) {
      console.error('District search failed:', error);
      setDistrictResults([]);
    } finally {
      setDistrictSearching(false);
    }
  };

  const handleCreateLocation = async () => {
    if (createKind === 'mandal') {
      if (!notFoundPlaceName.trim() || !selectedDistrict) {
        Alert.alert('Error', 'Please select a district');
        return;
      }
    } else {
      if (!newDistrictName.trim()) {
        Alert.alert('Error', 'Please enter district name');
        return;
      }
      if (!newDistrictStateName.trim()) {
        Alert.alert('Error', 'Please enter state name');
        return;
      }
    }

    setCreatingLocation(true);
    try {
      const req: SmartAddLocationRequest =
        createKind === 'mandal'
          ? {
              areaName: notFoundPlaceName.trim(),
              languageCode: languageCode || 'te',
              forceType: 'mandal',
              parentDistrictName: selectedDistrict!.match.name,
              parentDistrictId: selectedDistrict!.match.id,
              stateName: selectedDistrict!.state?.name,
              stateId: selectedDistrict!.state?.id,
            }
          : {
              areaName: newDistrictName.trim(),
              languageCode: languageCode || 'te',
              forceType: 'district',
              stateName: newDistrictStateName.trim(),
            };
      
      const created = await smartAddLocation(req);
      
      if (created && created.success) {
        // Best effort: re-fetch via search API so we get native names as the search endpoint returns
        // consistent language keys for `match.names`.
        let refreshedItem: CombinedLocationItem | null = null;
        try {
          const refreshQuery = createKind === 'mandal' ? notFoundPlaceName.trim() : newDistrictName.trim();
          const refreshed = await searchCombinedLocations(refreshQuery, 20, tenantId);
          refreshedItem = (refreshed.items || []).find((i) => i.match?.id === created.location.id) || null;
        } catch {}

        // Convert SmartAddLocationResponse to handleLocationSelect format
        const convertedItem: CombinedLocationItem = {
          type: created.type as any,
          match: {
            id: created.location.id,
            name: created.location.name,
            names: translationsToNames(created.location.translations),
          },
          district: created.location.district ? {
            id: created.location.district.id,
            name: created.location.district.name,
            names: {},
          } : null,
          state: created.location.state ? {
            id: created.location.state.id,
            name: created.location.state.name,
            names: {},
          } : null,
          mandal: null,
          village: null,
        };

        const finalItem = refreshedItem || convertedItem;

        if (createKind === 'district') {
          // If user was creating district for a mandal that wasn't found, keep them here and switch back to mandal creation.
          // Heuristic: if the district name differs from the not-found place name, treat it as "create district first".
          if (norm(newDistrictName) !== norm(notFoundPlaceName)) {
            setSelectedDistrict(finalItem);
            setCreateKind('mandal');
            setDistrictQuery('');
            setDistrictResults([]);
            return;
          }
        }

        await handleLocationSelect(finalItem);
      } else {
        Alert.alert('Success', 'Location created successfully');
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to create location';
      if (error?.status === 400) {
        Alert.alert('Missing Details', msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setCreatingLocation(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Select Location
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
        <MaterialIcons name="search" size={22} color={c.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search place name..."
          placeholderTextColor={c.muted}
          style={[styles.searchInput, { color: c.text }]}
          autoFocus={!params.initialQuery}
        />
        {searching && <ActivityIndicator size="small" color={c.tint} />}
      </View>

      {/* Results */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {!showNotFound && results.length === 0 && !searching && searchQuery.trim().length < 2 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="location-on" size={64} color={c.muted} style={{ opacity: 0.5 }} />
            <ThemedText style={[styles.emptyText, { color: c.muted }]}>
              Type at least 2 characters to search
            </ThemedText>
          </View>
        )}

        {!showNotFound && results.length === 0 && searchQuery.trim().length >= 2 && !searching && (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={64} color={c.muted} style={{ opacity: 0.5 }} />
            <ThemedText style={[styles.emptyText, { color: c.muted }]}>
              No locations found
            </ThemedText>
          </View>
        )}

        {!showNotFound && results.map((item, index) => (
          <Pressable
            key={index}
            onPress={() => handleLocationSelect(item)}
            style={({ pressed }) => [
              styles.resultItem,
              { 
                backgroundColor: pressed ? c.background : c.card,
                borderBottomColor: c.border,
              },
            ]}
          >
            <View style={styles.resultIcon}>
              <MaterialIcons name="place" size={24} color={c.tint} />
            </View>
            <View style={styles.resultContent}>
              <ThemedText style={styles.resultName}>{item.match.name}</ThemedText>
              <View style={styles.resultMeta}>
                <ThemedText style={[styles.resultType, { color: c.muted }]}>
                  {item.type}
                </ThemedText>
                {item.district && (
                  <ThemedText style={[styles.resultDetail, { color: c.muted }]}>
                    • {item.district.name}
                  </ThemedText>
                )}
                {item.state && (
                  <ThemedText style={[styles.resultDetail, { color: c.muted }]}>
                    • {item.state.name}
                  </ThemedText>
                )}
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={c.muted} />
          </Pressable>
        ))}

        {/* Location Not Found Section */}
        {showNotFound && (
          <View style={[styles.notFoundContainer, { backgroundColor: c.card }]}>
            <View style={styles.notFoundHeader}>
              <MaterialIcons name="report-problem" size={48} color="#F59E0B" />
              <ThemedText type="defaultSemiBold" style={[styles.notFoundTitle, { color: c.text }]}>
                Location Not Found
              </ThemedText>
              <ThemedText style={[styles.notFoundDesc, { color: c.muted }]}>
                &ldquo;{notFoundPlaceName}&rdquo; is not in our database
              </ThemedText>
            </View>

            {!showCreateForm ? (
              <View style={styles.notFoundActions}>
                <Pressable
                  onPress={() => setShowCreateForm(true)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.primaryButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  disabled={requestingAdd}
                >
                  <MaterialIcons name="add-location" size={20} color="#fff" />
                  <ThemedText style={styles.primaryButtonText}>
                    Add Location Myself
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleRequestAdd}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.secondaryButton,
                    { borderColor: c.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                  disabled={requestingAdd}
                >
                  {requestingAdd ? (
                    <ActivityIndicator size="small" color={c.tint} />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color={c.tint} />
                      <ThemedText style={[styles.secondaryButtonText, { color: c.tint }]}>
                        Request Admin to Add
                      </ThemedText>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    resetAllAndStartOver();
                  }}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.tertiaryButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText style={[styles.tertiaryButtonText, { color: c.muted }]}>
                    Try Different Search
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.createForm}>
                <ThemedText type="defaultSemiBold" style={[styles.formTitle, { color: c.text }]}>
                  Add &ldquo;{notFoundPlaceName}&rdquo;
                </ThemedText>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <Pressable
                    onPress={() => setCreateKind('mandal')}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.secondaryButton,
                      {
                        borderColor: createKind === 'mandal' ? c.tint : c.border,
                        opacity: pressed ? 0.8 : 1,
                        flex: 1,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.secondaryButtonText, { color: createKind === 'mandal' ? c.tint : c.muted }]}> 
                      Mandal
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setCreateKind('district');
                      if (!newDistrictName.trim()) setNewDistrictName(notFoundPlaceName);
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.secondaryButton,
                      {
                        borderColor: createKind === 'district' ? c.tint : c.border,
                        opacity: pressed ? 0.8 : 1,
                        flex: 1,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.secondaryButtonText, { color: createKind === 'district' ? c.tint : c.muted }]}> 
                      District
                    </ThemedText>
                  </Pressable>
                </View>

                {createKind === 'mandal' ? (
                  <View style={styles.formField}>
                    <ThemedText style={[styles.formLabel, { color: c.text }]}>
                      Select District *
                    </ThemedText>
                    <View style={[styles.districtSearch, { backgroundColor: c.background, borderColor: c.border }]}>
                      <MaterialIcons name="search" size={20} color={c.muted} />
                      <TextInput
                        ref={districtInputRef}
                        value={districtQuery}
                        onChangeText={(text) => {
                          setDistrictQuery(text);
                          if (text.trim().length >= 2) {
                            searchDistrict(text);
                          } else {
                            setDistrictResults([]);
                          }
                        }}
                        placeholder="Search district..."
                        placeholderTextColor={c.muted}
                        style={[styles.districtInput, { color: c.text }]}
                      />
                      {districtSearching && <ActivityIndicator size="small" />}
                    </View>

                    {selectedDistrict && (
                      <View style={[styles.selectedDistrict, { backgroundColor: c.background, borderColor: c.tint }]}>
                        <MaterialIcons name="check-circle" size={20} color="#10B981" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <ThemedText style={{ color: c.text, fontWeight: '600' }}>
                            {selectedDistrict.match.name}
                          </ThemedText>
                          {selectedDistrict.state && (
                            <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                              {selectedDistrict.state.name}
                            </ThemedText>
                          )}
                        </View>
                        <Pressable onPress={() => setSelectedDistrict(null)}>
                          <MaterialIcons name="close" size={20} color={c.muted} />
                        </Pressable>
                      </View>
                    )}

                    {!selectedDistrict && districtResults.length > 0 && (
                      <ScrollView style={styles.districtResults} nestedScrollEnabled>
                        {districtResults.map((item, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => {
                              setSelectedDistrict(item);
                              setDistrictQuery('');
                              setDistrictResults([]);
                            }}
                            style={({ pressed }) => [
                              styles.districtItem,
                              { 
                                backgroundColor: pressed ? c.background : 'transparent',
                                borderBottomColor: c.border,
                              },
                            ]}
                          >
                            <ThemedText style={{ color: c.text }}>{item.match.name}</ThemedText>
                            {item.state && (
                              <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                                {item.state.name}
                              </ThemedText>
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                ) : (
                  <View style={styles.formField}>
                    <ThemedText style={[styles.formLabel, { color: c.text }]}>District Name *</ThemedText>
                    <View style={[styles.districtSearch, { backgroundColor: c.background, borderColor: c.border }]}>
                      <MaterialIcons name="edit" size={18} color={c.muted} />
                      <TextInput
                        value={newDistrictName}
                        onChangeText={setNewDistrictName}
                        placeholder="Enter district name"
                        placeholderTextColor={c.muted}
                        style={[styles.districtInput, { color: c.text }]}
                      />
                    </View>

                    <ThemedText style={[styles.formLabel, { color: c.text, marginTop: 12 }]}>State Name *</ThemedText>
                    <View style={[styles.districtSearch, { backgroundColor: c.background, borderColor: c.border }]}>
                      <MaterialIcons name="map" size={18} color={c.muted} />
                      <TextInput
                        value={newDistrictStateName}
                        onChangeText={setNewDistrictStateName}
                        placeholder="Ex: Andhra Pradesh"
                        placeholderTextColor={c.muted}
                        style={[styles.districtInput, { color: c.text }]}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.formActions}>
                  <Pressable
                    onPress={handleCreateLocation}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.primaryButton,
                      {
                        opacity:
                          pressed ||
                          creatingLocation ||
                          (createKind === 'mandal' ? !selectedDistrict : !newDistrictName.trim() || !newDistrictStateName.trim())
                            ? 0.5
                            : 1,
                      },
                    ]}
                    disabled={
                      creatingLocation ||
                      (createKind === 'mandal' ? !selectedDistrict : !newDistrictName.trim() || !newDistrictStateName.trim())
                    }
                  >
                    {creatingLocation ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="add" size={20} color="#fff" />
                        <ThemedText style={styles.primaryButtonText}>
                          {createKind === 'mandal' ? 'Create Mandal' : 'Create District'}
                        </ThemedText>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={handleRequestAdd}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.secondaryButton,
                      { borderColor: c.border, opacity: pressed || requestingAdd ? 0.8 : 1 },
                    ]}
                    disabled={requestingAdd}
                  >
                    {requestingAdd ? (
                      <ActivityIndicator size="small" color={c.tint} />
                    ) : (
                      <>
                        <MaterialIcons name="send" size={18} color={c.tint} />
                        <ThemedText style={[styles.secondaryButtonText, { color: c.tint }]}> 
                          Request Admin to Add
                        </ThemedText>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      resetAllAndStartOver();
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.tertiaryButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <ThemedText style={[styles.tertiaryButtonText, { color: c.muted }]}>
                      Try Different Search
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  
  backButton: {
    padding: Spacing.xs,
  },
  
  headerTitle: {
    fontSize: Typography.h4,
    flex: 1,
    textAlign: 'center',
  },
  
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  
  searchInput: {
    flex: 1,
    fontSize: Typography.body,
    paddingVertical: Spacing.xs,
  },
  
  content: {
    flex: 1,
  },
  
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  
  emptyText: {
    fontSize: Typography.body,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DC262610',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  resultContent: {
    flex: 1,
  },
  
  resultName: {
    fontSize: Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs / 2,
  },
  
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  
  resultType: {
    fontSize: Typography.caption,
    textTransform: 'capitalize',
  },
  
  resultDetail: {
    fontSize: Typography.caption,
  },
  
  notFoundContainer: {
    margin: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  
  notFoundHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  
  notFoundTitle: {
    fontSize: Typography.h3,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  
  notFoundDesc: {
    fontSize: Typography.bodySmall,
    textAlign: 'center',
  },
  
  notFoundActions: {
    gap: Spacing.md,
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minHeight: 44,
  },
  
  primaryButton: {
    backgroundColor: '#DC2626',
  },
  
  primaryButtonText: {
    color: '#fff',
    fontSize: Typography.body,
    fontWeight: '600',
  },
  
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  
  secondaryButtonText: {
    fontSize: Typography.body,
    fontWeight: '600',
  },
  
  tertiaryButton: {
    backgroundColor: 'transparent',
  },
  
  tertiaryButtonText: {
    fontSize: Typography.bodySmall,
    fontWeight: '500',
  },
  
  createForm: {
    gap: Spacing.lg,
  },
  
  formTitle: {
    fontSize: Typography.h4,
    marginBottom: Spacing.sm,
  },
  
  formField: {
    gap: Spacing.sm,
  },
  
  formLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: '600',
  },
  
  districtSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  
  districtInput: {
    flex: 1,
    fontSize: Typography.body,
    paddingVertical: Spacing.xs,
  },
  
  selectedDistrict: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  
  districtResults: {
    maxHeight: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
  districtItem: {
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  
  formActions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
