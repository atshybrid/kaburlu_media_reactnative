/**
 * Transfer Reporter Designation & Location
 * Reuses create-reporter's designation + location selection flow
 * 
 * Flow:
 * 1. Select new designation
 * 2. Select new location (if required by level)
 * 3. Confirm and call transfer API
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { searchCombinedLocations, type CombinedLocationItem } from '@/services/locations';
import {
  getReporterDesignations,
  transferReporterAssignment,
  type ReporterDesignation,
  type ReporterLevel,
} from '@/services/reporters';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_COLOR = '#DC2626';

const LEVEL_TELUGU: Record<string, string> = {
  STATE: 'రాష్ట్ర స్థాయి',
  DISTRICT: 'జిల్లా స్థాయి',
  DIVISION: 'విభాగ స్థాయి',
  CONSTITUENCY: 'నియోజకవర్గ స్థాయి',
  MANDAL: 'మండల స్థాయి',
  ASSEMBLY: 'అసెంబ్లీ స్థాయి',
};

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; avatar: string }> = {
  STATE: { color: '#7C3AED', bgColor: '#EDE9FE', avatar: '🏛️' },
  DISTRICT: { color: '#2563EB', bgColor: '#DBEAFE', avatar: '🏢' },
  DIVISION: { color: '#D97706', bgColor: '#FEF3C7', avatar: '🏘️' },
  CONSTITUENCY: { color: '#059669', bgColor: '#D1FAE5', avatar: '🗳️' },
  MANDAL: { color: '#DC2626', bgColor: '#FEE2E2', avatar: '📍' },
  ASSEMBLY: { color: '#9333EA', bgColor: '#F3E8FF', avatar: '🏛️' },
};

function normalizeLocationType(t?: string | null) {
  const v = String(t || '').toUpperCase();
  if (v.includes('ASSEMBLY')) return 'ASSEMBLY';
  if (v.includes('DISTRICT')) return 'DISTRICT';
  if (v.includes('MANDAL')) return 'MANDAL';
  if (v.includes('STATE')) return 'STATE';
  return v;
}

export default function TransferReporterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    reporterId: string; 
    reporterName: string;
    currentDesignationId?: string;
  }>();

  const reporterId = String(params?.reporterId || '');
  const reporterName = String(params?.reporterName || 'Reporter');

  const [step, setStep] = useState<1 | 2>(1);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Designation
  const [designations, setDesignations] = useState<ReporterDesignation[]>([]);
  const [selectedDesig, setSelectedDesig] = useState<ReporterDesignation | null>(null);
  const [desigQuery, setDesigQuery] = useState('');

  // Step 2: Location
  const [locQuery, setLocQuery] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locItems, setLocItems] = useState<CombinedLocationItem[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<CombinedLocationItem | null>(null);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  /* Load data */
  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        const session: any = (t as any)?.session;
        const tid = session?.tenantId || session?.tenant?.id;
        setTenantId(typeof tid === 'string' ? tid : null);

        if (tid) {
          const list = await getReporterDesignations(tid);
          setDesignations(Array.isArray(list) ? list : []);
        }
      } catch (e: any) {
        Alert.alert('లోడ్ కాలేదు', e?.message || 'డేటా లోడ్ కాలేదు');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Designation grouped by level */
  const designationsByLevel = useMemo(() => {
    const q = desigQuery.trim().toLowerCase();
    const withoutTenantAdmin = designations.filter(
      (d) => String(d.code || '').toUpperCase() !== 'TENANT_ADMIN'
    );
    const filtered = q
      ? withoutTenantAdmin.filter((d) => 
          String(d.name || '').toLowerCase().includes(q) || 
          String(d.nativeName || '').toLowerCase().includes(q)
        )
      : withoutTenantAdmin;
    
    const buckets: Record<string, ReporterDesignation[]> = { 
      STATE: [], DISTRICT: [], CONSTITUENCY: [], DIVISION: [], MANDAL: [], ASSEMBLY: [] 
    };
    for (const d of filtered) {
      const lvl = String(d.level || '').toUpperCase();
      if (buckets[lvl]) buckets[lvl].push(d);
    }
    Object.keys(buckets).forEach((lvl) => {
      buckets[lvl].sort((a, b) => (a.levelOrder || 0) - (b.levelOrder || 0));
    });
    return buckets;
  }, [designations, desigQuery]);

  const selectedLevel = selectedDesig?.level;

  /* Location search */
  const searchLoc = useCallback(async (q: string) => {
    if (!q.trim()) {
      setLocItems([]);
      return;
    }
    setLocLoading(true);
    try {
      const results = await searchCombinedLocations(q.trim());
      setLocItems(results?.items || []);
    } catch {
      setLocItems([]);
    } finally {
      setLocLoading(false);
    }
  }, []);

  /* Submit transfer */
  const handleSubmit = useCallback(async () => {
    if (!tenantId || !reporterId || !selectedDesig) return;

    const level = String(selectedLevel || '').toUpperCase();
    
    // Check if location required
    if (level !== 'STATE' && !selectedLoc) {
      Alert.alert('తప్పు', 'దయచేసి ప్రాంతం ఎంచుకోండి');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        designationId: selectedDesig.id,
        level: selectedDesig.level as Exclude<ReporterLevel, null>,
      };

      // Add location based on level
      if (selectedLoc?.match?.id) {
        const locId = selectedLoc.match.id;
        const locType = normalizeLocationType(selectedLoc.type);
        
        if (level === 'STATE') {
          payload.stateId = locId;
        } else if (level === 'DISTRICT') {
          payload.districtId = selectedLoc.district?.id || locId;
        } else if (level === 'DIVISION') {
          payload.divisionId = locId;
        } else if (level === 'CONSTITUENCY') {
          payload.constituencyId = locId;
        } else if (level === 'MANDAL') {
          payload.mandalId = locId;
        } else if (level === 'ASSEMBLY') {
          if (locType === 'ASSEMBLY') {
            payload.assemblyConstituencyId = locId;
          } else if (locType === 'MANDAL') {
            payload.mandalId = locId;
          } else if (locType === 'DISTRICT') {
            payload.districtId = locId;
          } else {
            payload.assemblyConstituencyId = locId;
          }
        }
      }

      await transferReporterAssignment(tenantId, reporterId, payload);
      
      Alert.alert('విజయవంతం', 'డిజిగ్నేషన్ మార్చబడింది', [
        { text: 'సరే', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('limit reached') || msg.includes('409')) {
        Alert.alert('లిమిట్ చేరుకుంది', 'ఈ డిజిగ్నేషన్ కోసం రిపోర్టర్ల లిమిట్ చేరుకుంది');
      } else {
        Alert.alert('తప్పు', msg || 'మార్చడం విఫలమైంది');
      }
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, reporterId, selectedDesig, selectedLevel, selectedLoc, router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => step === 1 ? router.back() : setStep(1)} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>డిజిగ్నేషన్ మార్చండి</Text>
          <Text style={[styles.headerSubtitle, { color: c.muted }]}>{reporterName}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Designation */}
        {step === 1 && (
          <View style={{ padding: 20 }}>
            <Text style={[styles.stepTitle, { color: c.text }]}>కొత్త డిజిగ్నేషన్</Text>
            
            {/* Search */}
            <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
              <MaterialIcons name="search" size={20} color={c.muted} />
              <TextInput
                style={[styles.searchInput, { color: c.text }]}
                placeholder="డిజిగ్నేషన్ వెతకండి..."
                placeholderTextColor={c.muted}
                value={desigQuery}
                onChangeText={setDesigQuery}
              />
              {desigQuery && (
                <Pressable onPress={() => setDesigQuery('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={c.muted} />
                </Pressable>
              )}
            </View>

            {/* Designations by level */}
            {Object.entries(designationsByLevel).map(([level, desigs]) => {
              if (desigs.length === 0) return null;
              return (
                <View key={level} style={{ marginTop: 20 }}>
                  <Text style={[styles.levelHeader, { color: c.muted }]}>
                    {LEVEL_TELUGU[level] || level}
                  </Text>
                  {desigs.map((d) => {
                    const isSelected = selectedDesig?.id === d.id;
                    const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.DISTRICT;
                    return (
                      <Pressable
                        key={d.id}
                        style={[
                          styles.designationCard,
                          { backgroundColor: c.card, borderColor: c.border },
                          isSelected && { borderColor: cfg.color, borderWidth: 2, backgroundColor: cfg.bgColor }
                        ]}
                        onPress={() => {
                          setSelectedDesig(d);
                          setSelectedLoc(null);
                          setLocQuery('');
                          const lvl = String(d.level || '').toUpperCase();
                          if (lvl === 'STATE') {
                            // STATE doesn't need location, submit directly
                            setTimeout(() => handleSubmit(), 100);
                          } else {
                            setTimeout(() => setStep(2), 200);
                          }
                        }}
                      >
                        <View style={[styles.desigIcon, { backgroundColor: cfg.bgColor }]}>
                          <Text style={{ fontSize: 24 }}>{cfg.avatar}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.designationName, { color: c.text }]}>
                            {d.nativeName || d.name}
                          </Text>
                          {d.name !== d.nativeName && (
                            <Text style={[styles.designationSub, { color: c.muted }]}>{d.name}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <MaterialIcons name="check-circle" size={24} color={cfg.color} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* Step 2: Select Location */}
        {step === 2 && selectedDesig && (
          <View style={{ padding: 20 }}>
            <Text style={[styles.stepTitle, { color: c.text }]}>ప్రాంతం ఎంచుకోండి</Text>
            <Text style={[styles.stepSubtitle, { color: c.muted }]}>
              {selectedDesig.nativeName || selectedDesig.name} కోసం
            </Text>

            {/* Location Search */}
            <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border, marginTop: 16 }]}>
              <MaterialIcons name="search" size={20} color={c.muted} />
              <TextInput
                style={[styles.searchInput, { color: c.text }]}
                placeholder="మండల, జిల్లా పేరు రాయండి..."
                placeholderTextColor={c.muted}
                value={locQuery}
                onChangeText={(q) => {
                  setLocQuery(q);
                  searchLoc(q);
                }}
              />
              {locLoading && <ActivityIndicator size="small" color={PRIMARY_COLOR} />}
            </View>

            {/* Selected Location */}
            {selectedLoc && (
              <View style={[styles.selectedChip, { backgroundColor: c.card, borderColor: PRIMARY_COLOR }]}>
                <MaterialIcons name="location-on" size={18} color={PRIMARY_COLOR} />
                <Text style={[styles.selectedText, { color: c.text }]}>{selectedLoc.match?.name || ''}</Text>
                <Pressable onPress={() => setSelectedLoc(null)} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={c.muted} />
                </Pressable>
              </View>
            )}

            {/* Location Results */}
            {locItems.length > 0 && !selectedLoc && (
              <View style={{ marginTop: 12 }}>
                {locItems.slice(0, 8).map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={[styles.locationItem, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => {
                      setSelectedLoc(item);
                      setLocQuery('');
                      setLocItems([]);
                      Keyboard.dismiss();
                    }}
                  >
                    <MaterialIcons name="location-on" size={18} color={c.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationName, { color: c.text }]}>{item.match?.name || ''}</Text>
                      {item.district?.name && (
                        <Text style={[styles.locationMeta, { color: c.muted }]}>
                          {item.district.name}{item.state?.name ? `, ${item.state.name}` : ''}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              style={[
                styles.submitBtn,
                { backgroundColor: PRIMARY_COLOR },
                (!selectedLoc || submitting) && { opacity: 0.5 }
              ]}
              onPress={handleSubmit}
              disabled={!selectedLoc || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>మార్చు</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepSubtitle: { fontSize: 14, marginTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderRadius: 10, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  levelHeader: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  designationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  desigIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  designationName: { fontSize: 15, fontWeight: '600' },
  designationSub: { fontSize: 12, marginTop: 2 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 2, borderRadius: 10, marginTop: 12 },
  selectedText: { flex: 1, fontSize: 14, fontWeight: '600' },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  locationName: { fontSize: 14, fontWeight: '600' },
  locationMeta: { fontSize: 12, marginTop: 2 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
