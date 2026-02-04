/**
 * Simplified Create Reporter Screen
 * Telugu UI - Easy for newspaper publishers
 *
 * Step 1: హోదా (Designation) - Select reporter role
 * Step 2: ప్రాంతం (Location) - Select area based on designation level
 * Step 3: వివరాలు (Details) - Name and Phone number
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import {
  checkPublicReporterAvailability,
  createTenantReporter,
  getReporterDesignations,
  type CreateTenantReporterInput,
  type ReporterDesignation,
  type ReporterLevel,
} from '@/services/reporters';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────────────────────  Helpers  ───────────────────────────── */

function digitsOnly(s: string) {
  return s.replace(/\D+/g, '');
}

function normalizeLocationType(t?: string | null) {
  const v = String(t || '').toUpperCase();
  if (v.includes('ASSEMBLY')) return 'ASSEMBLY';
  if (v.includes('DISTRICT')) return 'DISTRICT';
  if (v.includes('MANDAL')) return 'MANDAL';
  if (v.includes('STATE')) return 'STATE';
  return v;
}

function isAllowedLocationForLevel(level: string, item: CombinedLocationItem) {
  const lvl = String(level || '').toUpperCase();
  const type = normalizeLocationType(item.type);
  if (lvl === 'STATE') return type === 'STATE';
  // Staff Reporter (DISTRICT level) - select mandal, we use its district
  if (lvl === 'DISTRICT') return type === 'MANDAL';
  // Constituency Reporter - can select mandal OR district
  if (lvl === 'CONSTITUENCY') return type === 'MANDAL' || type === 'DISTRICT';
  // RC (ASSEMBLY level) - can select mandal OR district
  if (lvl === 'ASSEMBLY') return type === 'MANDAL' || type === 'DISTRICT';
  // Mandal Reporter - only mandal
  if (lvl === 'MANDAL') return type === 'MANDAL';
  return false;
}

const LEVEL_ORDER = ['STATE', 'DISTRICT', 'CONSTITUENCY', 'ASSEMBLY', 'MANDAL'] as const;
const LEVEL_LABELS: Record<string, string> = {
  STATE: 'రాష్ట్రం',
  DISTRICT: 'జిల్లా',
  CONSTITUENCY: 'నియోజకవర్గం',
  ASSEMBLY: 'RC స్థాయి',
  MANDAL: 'మండలం',
};

// Level-specific colors and icons for visual hierarchy
const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; icon: string; emoji: string; avatar: string }> = {
  STATE: { color: '#7C3AED', bgColor: '#7C3AED15', icon: 'flag', emoji: '🏛️', avatar: '🎤' },
  DISTRICT: { color: '#2563EB', bgColor: '#2563EB15', icon: 'location-city', emoji: '🏢', avatar: '📰' },
  CONSTITUENCY: { color: '#059669', bgColor: '#05966915', icon: 'how-to-vote', emoji: '🗳️', avatar: '📊' },
  ASSEMBLY: { color: '#10B981', bgColor: '#10B98115', icon: 'location-searching', emoji: '📍', avatar: '📝' },
  MANDAL: { color: '#D97706', bgColor: '#D9770615', icon: 'home-work', emoji: '🏘️', avatar: '✍️' },
};

// Get search hint text based on designation level
function getSearchHintForLevel(level: string): string {
  const lvl = String(level || '').toUpperCase();
  if (lvl === 'STATE') return 'రాష్ట్రం';
  // Staff Reporter (DISTRICT) - search mandal, we'll use its district
  if (lvl === 'DISTRICT') return 'మండలం';
  // Constituency Reporter - search mandal or district
  if (lvl === 'CONSTITUENCY') return 'మండలం లేదా జిల్లా';
  // RC (ASSEMBLY) - can search mandal or district
  if (lvl === 'ASSEMBLY') return 'మండలం లేదా జిల్లా';
  // Mandal Reporter
  if (lvl === 'MANDAL') return 'మండలం';
  return 'ప్రాంతం';
}

const PRIMARY_COLOR = '#DC2626';
const SUCCESS_COLOR = '#10B981';

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function CreateReporterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const secondaryText = c.muted;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Designation
  const [designations, setDesignations] = useState<ReporterDesignation[]>([]);
  const [selectedDesig, setSelectedDesig] = useState<ReporterDesignation | null>(null);
  const [desigQuery, setDesigQuery] = useState('');

  // Step 2: Location
  const [locQuery, setLocQuery] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locItems, setLocItems] = useState<CombinedLocationItem[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<CombinedLocationItem | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Step 3: Name & Phone
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedLevel = String(selectedDesig?.level || '').toUpperCase();

  /* ── Load session and designations ── */
  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        const session: any = (t as any)?.session;
        const tid = session?.tenantId || session?.tenant?.id;
        setTenantId(typeof tid === 'string' ? tid : null);

        const list = await getReporterDesignations();
        setDesignations(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setError(e?.message || 'లోడ్ కాలేదు');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Designation grouped by level ── */
  const designationsByLevel = useMemo(() => {
    const q = desigQuery.trim().toLowerCase();
    // Filter out TENANT_ADMIN from UI
    const withoutTenantAdmin = designations.filter(
      (d) => String(d.code || '').toUpperCase() !== 'TENANT_ADMIN'
    );
    const filtered = q
      ? withoutTenantAdmin.filter((d) => 
          String(d.name || '').toLowerCase().includes(q) || 
          String(d.nativeName || '').toLowerCase().includes(q)
        )
      : withoutTenantAdmin;
    const buckets: Record<string, ReporterDesignation[]> = { STATE: [], DISTRICT: [], CONSTITUENCY: [], ASSEMBLY: [], MANDAL: [] };
    for (const d of filtered) {
      const lvl = String(d.level || '').toUpperCase();
      if (buckets[lvl]) buckets[lvl].push(d);
    }
    // Sort each bucket by levelOrder
    Object.keys(buckets).forEach((lvl) => {
      buckets[lvl].sort((a, b) => (a.levelOrder || 0) - (b.levelOrder || 0));
    });
    return buckets;
  }, [designations, desigQuery]);

  /* ── Location search ── */
  useEffect(() => {
    if (step !== 2) return;
    const q = locQuery.trim();
    if (q.length < 2) {
      setLocItems([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        setLocLoading(true);
        const res = await searchCombinedLocations(q, 20);
        const items = Array.isArray(res?.items) ? res.items : [];
        if (!cancelled) {
          const filtered = items.filter((it) => isAllowedLocationForLevel(selectedLevel, it));
          setLocItems(filtered);
        }
      } catch {
        if (!cancelled) setLocItems([]);
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [locQuery, selectedLevel, step]);

  /* ── Check availability when location selected ── */
  const checkAvailability = useCallback(
    async (loc: CombinedLocationItem) => {
      if (!tenantId || !selectedDesig?.id) return;
      const locId = loc.match?.id;
      if (!locId) return;

      setCheckingAvailability(true);
      setIsAvailable(null);

      try {
        const level = selectedLevel as Exclude<ReporterLevel, null>;
        const payload: any = { designationId: selectedDesig.id, level };
        const locType = normalizeLocationType(loc.type);
        
        if (selectedLevel === 'STATE') {
          payload.stateId = locId;
        } else if (selectedLevel === 'DISTRICT') {
          // Staff Reporter: selected mandal, use its district
          payload.districtId = loc.district?.id || locId;
        } else if (selectedLevel === 'ASSEMBLY') {
          // RC: can select mandal or district - API uses assemblyConstituencyId
          // For now, pass the selected location id
          if (locType === 'MANDAL') {
            payload.mandalId = locId;
          } else if (locType === 'DISTRICT') {
            payload.districtId = locId;
          }
        } else if (selectedLevel === 'MANDAL') {
          payload.mandalId = locId;
        }

        // Skip availability check if we don't have the right ID for the level
        // This handles cases where API expects specific ID types
        try {
          const res = await checkPublicReporterAvailability(tenantId, payload);
          setIsAvailable(!!res?.available);
          if (!res?.available) {
            setFormError('ఈ ప్రాంతంలో ఇప్పటికే రిపోర్టర్ ఉన్నారు');
          } else {
            setFormError(null);
          }
        } catch (apiErr: any) {
          // If API returns 404, location not found
          if (apiErr?.status === 404) {
            console.log('[checkAvailability] API 404 - location not found:', apiErr?.data);
            setIsAvailable(false);
            const field = apiErr?.data?.field || 'location';
            setFormError(`ఎంచుకున్న ${field === 'districtId' ? 'జిల్లా' : field === 'mandalId' ? 'మండలం' : 'ప్రాంతం'} కనుగొనబడలేదు`);
          } else if (apiErr?.status === 400) {
            // If API returns 400, assume available (API may not support this combination)
            console.log('[checkAvailability] API 400 - assuming available for level:', level, 'locType:', locType);
            setIsAvailable(true);
            setFormError(null);
          } else {
            throw apiErr;
          }
        }
      } catch (e: any) {
        setFormError(e?.message || 'చెక్ చేయలేకపోయాము');
        setIsAvailable(false);
      } finally {
        setCheckingAvailability(false);
      }
    },
    [tenantId, selectedDesig?.id, selectedLevel]
  );

  /* ── Submit ── */
  const submit = useCallback(async () => {
    setFormError(null);
    if (!tenantId) {
      setFormError('Tenant ID లేదు');
      return;
    }
    if (!selectedDesig?.id || !selectedLoc?.match?.id) {
      setFormError('అన్ని ఫీల్డ్‌లు పూర్తి చేయండి');
      return;
    }

    setSubmitting(true);
    try {
      const level = selectedLevel as Exclude<ReporterLevel, null>;
      const locType = normalizeLocationType(selectedLoc.type);
      const input: CreateTenantReporterInput = {
        fullName: fullName.trim(),
        mobileNumber: digitsOnly(mobileNumber),
        designationId: selectedDesig.id,
        level,
        subscriptionActive: false,
        manualLoginEnabled: true,
        manualLoginDays: 365,
        autoPublish: true,
      };

      if (selectedLevel === 'STATE') {
        input.stateId = selectedLoc.match.id;
      } else if (selectedLevel === 'DISTRICT') {
        // Staff Reporter: selected mandal, use its district
        input.districtId = selectedLoc.district?.id || selectedLoc.match.id;
      } else if (selectedLevel === 'ASSEMBLY') {
        // RC: can select mandal or district
        if (locType === 'MANDAL') {
          input.mandalId = selectedLoc.match.id;
        } else if (locType === 'DISTRICT') {
          input.districtId = selectedLoc.match.id;
        }
      } else if (selectedLevel === 'MANDAL') {
        input.mandalId = selectedLoc.match.id;
      }

      console.log('[CreateReporter] 📤 Payload being sent:', JSON.stringify(input, null, 2));
      console.log('[CreateReporter] Tenant ID:', tenantId);
      console.log('[CreateReporter] Selected Location:', selectedLoc);
      console.log('[CreateReporter] Selected Level:', selectedLevel);
      console.log('[CreateReporter] Selected Designation:', selectedDesig);

      const created = await createTenantReporter(tenantId, input);

      console.log('[CreateReporter] ✅ Success:', created);
      Alert.alert(
        '✅ రిపోర్టర్ క్రియేట్ అయింది',
        `${created.fullName} విజయవంతంగా జోడించబడ్డారు.\n\nఇప్పుడు వారి ID కార్డ్ జెనరేట్ చేయండి.`,
        [
          {
            text: 'రిపోర్టర్ చూడండి',
            onPress: () => router.replace(`/tenant/reporter/${created.id}` as any),
          },
          {
            text: 'జాబితాకు వెళ్ళండి',
            onPress: () => router.replace('/tenant/reporters'),
          },
        ]
      );
    } catch (e: any) {
      setFormError(e?.message || 'క్రియేట్ కాలేదు');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, selectedDesig, selectedLoc, selectedLevel, fullName, mobileNumber, router]);

  /* ── Navigation ── */
  const goBack = useCallback(() => {
    setFormError(null);
    if (step === 1) {
      router.back();
    } else if (step === 2) {
      setStep(1);
      setSelectedLoc(null);
      setIsAvailable(null);
      setLocQuery('');
    } else {
      setStep(2);
    }
  }, [step, router]);

  const canGoToStep3 = useMemo(() => {
    return selectedLoc?.match?.id && isAvailable === true;
  }, [selectedLoc?.match?.id, isAvailable]);

  const canSubmit = useMemo(() => {
    return fullName.trim().length >= 2 && digitsOnly(mobileNumber).length === 10;
  }, [fullName, mobileNumber]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { color: c.text }]}>లోడ్ అవుతోంది...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <MaterialIcons name="error-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>వెనక్కి వెళ్ళండి</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          
          {step === 1 && desigQuery !== null ? (
            <>
              <View style={[styles.headerSearchBox, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="search" size={18} color={secondaryText} />
                <TextInput
                  style={[styles.headerSearchInput, { color: c.text }]}
                  placeholder="హోదా వెతకండి..."
                  placeholderTextColor={secondaryText}
                  value={desigQuery}
                  onChangeText={setDesigQuery}
                />
                {desigQuery.length > 0 && (
                  <Pressable onPress={() => setDesigQuery('')}>
                    <Ionicons name="close-circle" size={18} color={secondaryText} />
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: c.text }]}>రిపోర్టర్ జోడించండి</Text>
              <Text style={[styles.headerStep, { color: secondaryText }]}>
                స్టెప్ {step}/3
              </Text>
            </View>
          )}
          <View style={{ width: 40 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }]} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════════════════════════════════════
              STEP 1: హోదా (Designation)
              ══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepIconCircle, { backgroundColor: '#6366F1' }]}>
                  <MaterialIcons name="badge" size={32} color="#fff" />
                </View>
                <Text style={[styles.stepTitle, { color: c.text }]}>హోదా ఎంచుకోండి</Text>
                <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
                  స్థాయి ఎంచుకుని హోదా సెలెక్ట్ చేయండి
                </Text>
              </View>

              {/* Level Selection - 2x2 Grid */}
              <View style={styles.levelGrid}>
                {LEVEL_ORDER.map((lvl) => {
                  const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.DISTRICT;
                  const items = designationsByLevel[lvl] || [];
                  const isExpanded = selectedLevel === lvl;
                  
                  return (
                    <Pressable
                      key={lvl}
                      style={[
                        styles.levelSquare,
                        { backgroundColor: cfg.bgColor, borderColor: c.border },
                        isExpanded && { borderColor: cfg.color, borderWidth: 3 },
                      ]}
                      onPress={() => {
                        if (items.length === 1) {
                          // Auto-select if only one option
                          setSelectedDesig(items[0]);
                          setTimeout(() => setStep(2), 200);
                        } else if (items.length > 0) {
                          // Set a temporary selection to show this level's items
                          if (selectedLevel === lvl) {
                            setSelectedDesig(null); // Toggle off
                          } else {
                            // Create a dummy to set the level
                            setSelectedDesig({ 
                              id: '', 
                              tenantId: null,
                              name: '', 
                              nativeName: '',
                              code: '',
                              level: lvl as any,
                              levelOrder: 0,
                              createdAt: '',
                              updatedAt: ''
                            });
                          }
                        }
                      }}
                    >
                      {/* Avatar Circle with Mic */}
                      <View style={[styles.levelAvatarCircle, { backgroundColor: cfg.color }]}>
                        <Text style={styles.levelAvatarEmoji}>{cfg.avatar}</Text>
                        <View style={[styles.micBadge, { backgroundColor: '#fff' }]}>
                          <MaterialIcons name="mic" size={12} color={cfg.color} />
                        </View>
                      </View>
                      
                      {/* Level Info */}
                      <Text style={[styles.levelSquareTitle, { color: cfg.color }]}>
                        {LEVEL_LABELS[lvl]}
                      </Text>
                      <Text style={[styles.levelSquareCount, { color: secondaryText }]}>
                        {items.length} హోదాలు
                      </Text>
                      
                      {/* Check if selected */}
                      {isExpanded && selectedDesig?.id && (
                        <View style={[styles.levelSelectedBadge, { backgroundColor: SUCCESS_COLOR }]}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Show designations only for selected level */}
              {selectedLevel && (designationsByLevel[selectedLevel] || []).length > 0 && (
                <View style={styles.levelGroup}>
                  <Text style={[styles.levelGroupTitle, { color: LEVEL_CONFIG[selectedLevel]?.color || c.text }]}>
                    {LEVEL_CONFIG[selectedLevel]?.emoji} {LEVEL_LABELS[selectedLevel]} హోదాలు
                  </Text>
                  <View style={styles.designationGrid}>
                    {(designationsByLevel[selectedLevel] || []).map((d) => {
                      const isSelected = selectedDesig?.id === d.id;
                      const cfg = LEVEL_CONFIG[selectedLevel] || LEVEL_CONFIG.DISTRICT;
                      return (
                        <Pressable
                          key={d.id}
                          style={[
                            styles.designationCard,
                            { backgroundColor: c.card, borderColor: c.border },
                            isSelected && { borderColor: cfg.color, borderWidth: 2, backgroundColor: cfg.bgColor },
                          ]}
                          onPress={() => {
                            setSelectedDesig(d);
                            setFormError(null);
                            // Auto advance to step 2
                            setTimeout(() => setStep(2), 200);
                          }}
                        >
                          <View style={[styles.desigIcon, { backgroundColor: cfg.bgColor, alignSelf: 'center' }]}>
                            <Text style={{ fontSize: 24 }}>{cfg.avatar}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text
                              style={[
                                styles.designationName,
                                { color: c.text, textAlign: 'center' },
                                isSelected && { color: cfg.color, fontWeight: '700' },
                              ]}
                              numberOfLines={1}
                            >
                              {d.nativeName}
                            </Text>
                            <Text style={[styles.designationSubname, { color: secondaryText, textAlign: 'center' }]} numberOfLines={1}>
                              {d.name}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={styles.selectedCheck}>
                              <Ionicons name="checkmark-circle" size={20} color={SUCCESS_COLOR} />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Show all if searching */}
              {desigQuery.trim() && !selectedLevel && (
                <View style={styles.levelGroup}>
                  <Text style={[styles.levelGroupTitle, { color: c.text }]}>
                    🔍 &quot;{desigQuery}&quot; కోసం ఫలితాలు
                  </Text>
                  <View style={styles.designationGrid}>
                    {designations
                      .filter((d) => 
                        String(d.code || '').toUpperCase() !== 'TENANT_ADMIN' &&
                        (d.name.toLowerCase().includes(desigQuery.toLowerCase()) ||
                         (d.nativeName || '').toLowerCase().includes(desigQuery.toLowerCase()))
                      )
                      .map((d) => {
                        const isSelected = selectedDesig?.id === d.id;
                        const lvl = String(d.level || '').toUpperCase();
                        const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.DISTRICT;
                        return (
                          <Pressable
                            key={d.id}
                            style={[
                              styles.designationCard,
                              { backgroundColor: c.card, borderColor: c.border },
                              isSelected && { borderColor: cfg.color, borderWidth: 2, backgroundColor: cfg.bgColor },
                            ]}
                            onPress={() => {
                              setSelectedDesig(d);
                              setFormError(null);
                              setTimeout(() => setStep(2), 200);
                            }}
                          >
                            <View style={[styles.desigIcon, { backgroundColor: cfg.bgColor, alignSelf: 'center' }]}>
                              <Text style={{ fontSize: 24 }}>{cfg.avatar}</Text>
                            </View>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                              <Text
                                style={[
                                  styles.designationName,
                                  { color: c.text, textAlign: 'center' },
                                  isSelected && { color: cfg.color, fontWeight: '700' },
                                ]}
                                numberOfLines={1}
                              >
                                {d.nativeName}
                              </Text>
                              <Text style={[styles.designationSubname, { color: secondaryText, textAlign: 'center' }]} numberOfLines={1}>
                                {d.name}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 2: ప్రాంతం (Location)
              ══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepIconCircle, { backgroundColor: '#F59E0B' }]}>
                  <MaterialIcons name="location-on" size={32} color="#fff" />
                </View>
                <Text style={[styles.stepTitle, { color: c.text }]}>
                  {getSearchHintForLevel(selectedLevel)} ఎంచుకోండి
                </Text>
                <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
                  {selectedDesig?.name} కోసం పని ప్రాంతం
                </Text>
              </View>

              {/* Selected Designation Chip */}
              <View style={[styles.selectedChip, { backgroundColor: c.card, borderColor: c.border }]}>
                <MaterialIcons name="badge" size={18} color={PRIMARY_COLOR} />
                <Text style={[styles.selectedChipText, { color: c.text }]}>
                  {selectedDesig?.nativeName || selectedDesig?.name}
                </Text>
                <Pressable onPress={() => setStep(1)} style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>మార్చు</Text>
                </Pressable>
              </View>

              {/* Location Search */}
              <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="search" size={20} color={secondaryText} />
                <TextInput
                  style={[styles.searchInput, { color: c.text }]}
                  placeholder={`🔍 ${getSearchHintForLevel(selectedLevel)} పేరు టైప్ చేయండి...`}
                  placeholderTextColor={secondaryText}
                  value={locQuery}
                  onChangeText={setLocQuery}
                  autoFocus
                />
                {locQuery.length > 0 && (
                  <Pressable onPress={() => setLocQuery('')}>
                    <Ionicons name="close-circle" size={20} color={secondaryText} />
                  </Pressable>
                )}
              </View>

              {/* Location Results */}
              {locLoading ? (
                <ActivityIndicator size="small" color={PRIMARY_COLOR} style={{ padding: 30 }} />
              ) : locItems.length > 0 ? (
                <View style={styles.locationList}>
                  {locItems.map((item, idx) => {
                    const locType = normalizeLocationType(item.type);
                    return (
                    <Pressable
                      key={item.match?.id || idx}
                      style={[
                        styles.locationItem,
                        { backgroundColor: c.card, borderColor: c.border },
                        selectedLoc?.match?.id === item.match?.id && styles.locationItemSelected,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelectedLoc(item);
                        setFormError(null);
                        checkAvailability(item);
                      }}
                    >
                      <View style={[styles.locIcon, { backgroundColor: '#F59E0B20' }]}>
                        <MaterialIcons name="location-on" size={20} color="#F59E0B" />
                      </View>
                      <View style={styles.locInfo}>
                        <Text style={[styles.locName, { color: c.text }]}>{item.match?.name || 'Unknown'}</Text>
                        {/* Show district name for mandal, or type indicator */}
                        <Text style={[styles.locSub, { color: secondaryText }]}>
                          {locType === 'MANDAL' && item.district?.name 
                            ? `${item.district.name}${item.state?.name ? `, ${item.state.name}` : ''}`
                            : locType === 'DISTRICT' 
                              ? `జిల్లా${item.state?.name ? ` • ${item.state.name}` : ''}`
                              : [item.district?.name, item.state?.name].filter(Boolean).join(', ')
                          }
                        </Text>
                      </View>
                      {selectedLoc?.match?.id === item.match?.id && (
                        <>
                          {checkingAvailability ? (
                            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                          ) : isAvailable === true ? (
                            <Ionicons name="checkmark-circle" size={22} color={SUCCESS_COLOR} />
                          ) : isAvailable === false ? (
                            <Ionicons name="close-circle" size={22} color="#EF4444" />
                          ) : null}
                        </>
                      )}
                    </Pressable>
                  );})}
                </View>
              ) : locQuery.length >= 2 ? (
                <Text style={[styles.noResults, { color: secondaryText }]}>ఫలితాలు లేవు</Text>
              ) : (
                <View style={styles.hintBox}>
                  <MaterialIcons name="info-outline" size={20} color={secondaryText} />
                  <Text style={[styles.hintText, { color: secondaryText }]}>
                    {getSearchHintForLevel(selectedLevel)} పేరు టైప్ చేయండి (2+ అక్షరాలు)
                  </Text>
                </View>
              )}

              {/* Error */}
              {formError && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error" size={18} color="#EF4444" />
                  <Text style={styles.errorBoxText}>{formError}</Text>
                </View>
              )}

              {/* Spacer for fixed bottom button */}
              <View style={{ height: 80 }} />
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 3: వివరాలు (Name & Phone)
              ══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepIconCircle, { backgroundColor: SUCCESS_COLOR }]}>
                  <MaterialIcons name="person-add" size={32} color="#fff" />
                </View>
                <Text style={[styles.stepTitle, { color: c.text }]}>వివరాలు నమోదు చేయండి</Text>
                <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
                  రిపోర్టర్ పేరు మరియు ఫోన్ నంబర్
                </Text>
              </View>

              {/* Summary Chips */}
              <View style={styles.summaryChips}>
                <View style={[styles.summaryChip, { backgroundColor: c.card, borderColor: c.border }]}>
                  <MaterialIcons name="badge" size={16} color={PRIMARY_COLOR} />
                  <Text style={[styles.summaryChipText, { color: c.text }]} numberOfLines={1}>
                    {selectedDesig?.name}
                  </Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: c.card, borderColor: c.border }]}>
                  <MaterialIcons name="location-on" size={16} color="#F59E0B" />
                  <Text style={[styles.summaryChipText, { color: c.text }]} numberOfLines={1}>
                    {selectedLoc?.match?.name}
                  </Text>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: c.text }]}>పూర్తి పేరు *</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  placeholder="ఉదా: రాజేష్ కుమార్"
                  placeholderTextColor={secondaryText}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* Mobile Number */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: c.text }]}>మొబైల్ నంబర్ *</Text>
                <View style={[styles.phoneInputRow, { borderColor: c.border, backgroundColor: c.card }]}>
                  <Text style={[styles.phonePrefix, { color: secondaryText }]}>+91</Text>
                  <TextInput
                    style={[styles.phoneInput, { color: c.text }]}
                    placeholder="9876543210"
                    placeholderTextColor={secondaryText}
                    value={mobileNumber}
                    onChangeText={(t) => {
                      const digits = digitsOnly(t);
                      setMobileNumber(digits);
                      if (digits.length === 10) {
                        Keyboard.dismiss();
                      }
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  {digitsOnly(mobileNumber).length === 10 && (
                    <Ionicons name="checkmark-circle" size={22} color={SUCCESS_COLOR} />
                  )}
                </View>
              </View>

              {/* Error */}
              {formError && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error" size={18} color="#EF4444" />
                  <Text style={styles.errorBoxText}>{formError}</Text>
                </View>
              )}

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={18} color="#6366F1" />
                <Text style={styles.infoText}>
                  రిపోర్టర్ 365 రోజుల ఫ్రీ యాక్సెస్‌తో క్రియేట్ అవుతారు. తర్వాత సెట్టింగ్‌లు మార్చవచ్చు.
                </Text>
              </View>

              {/* Submit Button */}
              <Pressable
                style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
                onPress={submit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>రిపోర్టర్ క్రియేట్ చేయండి</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Fixed Bottom Button for Step 2 */}
        {step === 2 && (
          <View style={[styles.fixedBottomBtn, { backgroundColor: c.background, borderTopColor: c.border }]}>
            <Pressable
              style={[styles.primaryBtn, !canGoToStep3 && styles.btnDisabled, { marginBottom: 0 }]}
              onPress={() => setStep(3)}
              disabled={!canGoToStep3}
            >
              <Text style={styles.primaryBtnText}>తదుపరి</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorText: { marginTop: 12, fontSize: 16, textAlign: 'center' },
  retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerStep: { fontSize: 13, marginTop: 2 },
  headerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    marginRight: 8,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },

  progressBar: { height: 4, backgroundColor: '#E5E7EB' },
  progressFill: { height: '100%', backgroundColor: PRIMARY_COLOR },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  stepContainer: { gap: 16 },
  stepHeader: { alignItems: 'center', marginBottom: 8 },
  stepIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  stepTitle: { fontSize: 22, fontWeight: '700' },
  stepSubtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },

  // 2x2 Level Grid
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  levelSquare: {
    width: '47%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  levelAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelAvatarEmoji: {
    fontSize: 28,
  },
  micBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelSquareTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  levelSquareCount: {
    fontSize: 12,
  },
  levelSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },

  levelGroup: { marginTop: 16, marginBottom: 8 },
  levelHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 10, 
    marginBottom: 12 
  },
  levelIconBadge: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  levelGroupTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  levelCount: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  levelCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  designationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  designationCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  desigIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  designationName: { fontSize: 13, flex: 1, fontWeight: '600' },
  designationSubname: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  selectedCheck: { position: 'absolute', top: 6, right: 6 },

  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  selectedChipText: { flex: 1, fontSize: 14, fontWeight: '600' },
  changeBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: PRIMARY_COLOR + '15', borderRadius: 6 },
  changeBtnText: { fontSize: 12, color: PRIMARY_COLOR, fontWeight: '600' },

  locationList: { gap: 10 },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  locationItemSelected: { borderColor: SUCCESS_COLOR, borderWidth: 2, backgroundColor: SUCCESS_COLOR + '08' },
  locIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  locInfo: { flex: 1 },
  locName: { fontSize: 15, fontWeight: '600' },
  locSub: { fontSize: 12, marginTop: 2 },
  noResults: { padding: 30, textAlign: 'center', fontSize: 14 },

  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center' },
  hintText: { fontSize: 14 },

  summaryChips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '48%' },
  summaryChipText: { fontSize: 13, fontWeight: '500' },

  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 },
  phonePrefix: { fontSize: 16, fontWeight: '600', marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 16, paddingVertical: 14 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8 },
  errorBoxText: { color: '#DC2626', fontSize: 14, flex: 1 },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8 },
  infoText: { color: '#4338CA', fontSize: 13, flex: 1, lineHeight: 18 },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY_COLOR, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SUCCESS_COLOR, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  fixedBottomBtn: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderTopWidth: 1,
  },
});
