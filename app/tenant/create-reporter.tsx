import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function isValidHexColor(v?: string | null) {
  if (!v) return false;
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(String(v).trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim();
  if (!isValidHexColor(h)) return null;
  const raw = h.slice(1);
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function pickReadableTextColor(bgHex?: string | null) {
  const rgb = bgHex ? hexToRgb(bgHex) : null;
  if (!rgb) return null;
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return lum < 0.55 ? Colors.light.background : Colors.light.text;
}

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
  if (lvl === 'DISTRICT') return type === 'DISTRICT';
  if (lvl === 'ASSEMBLY') return type === 'ASSEMBLY';
  if (lvl === 'MANDAL') return type === 'MANDAL';
  return false;
}

function locationLabel(item: CombinedLocationItem) {
  const main = item.match?.name || 'Unknown';
  const parts = [item.state?.name, item.district?.name, item.mandal?.name].filter(Boolean);
  return { main, sub: parts.join(' • ') };
}

const LEVEL_ORDER = ['STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL'] as const;

export default function CreateReporterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [designations, setDesignations] = useState<ReporterDesignation[]>([]);
  const [selectedDesig, setSelectedDesig] = useState<ReporterDesignation | null>(null);
  const [desigQuery, setDesigQuery] = useState('');

  const [locQuery, setLocQuery] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locItems, setLocItems] = useState<CombinedLocationItem[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<CombinedLocationItem | null>(null);

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{ id: string; available: boolean } | null>(null);

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [idCardCharge, setIdCardCharge] = useState('');

  const [manualLoginEnabled, setManualLoginEnabled] = useState(false);
  const [manualLoginDays, setManualLoginDays] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const locSearchRef = useRef<any>(null);

  const accent = brandPrimary || c.tint;
  const accentText = pickReadableTextColor(accent) || Colors.light.background;

  const isReporterRole = role === 'REPORTER' || role === 'TENANT_REPORTER';
  const isAllowedRole = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN' || isReporterRole;
  const canEditPricing = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';

  const scrollPadBottom = useMemo(() => {
    if (step !== 3) return 18;
    if (subscriptionActive || manualLoginEnabled) return 320;
    return 220;
  }, [step, subscriptionActive, manualLoginEnabled]);

  const scrollToBottomSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const focusLocSearch = useCallback(() => {
    setTimeout(() => locSearchRef.current?.focus?.(), 50);
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const tid = session?.tenantId || session?.tenant?.id;
      setTenantId(typeof tid === 'string' ? tid : null);
      setRole(String(t?.user?.role || ''));

      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const primary = colors?.primary || colors?.accent;
      setBrandPrimary(isValidHexColor(primary) ? String(primary) : null);
    })();
  }, []);

  const loadDesignations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getReporterDesignations();
      setDesignations(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load designations');
      setDesignations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDesignations();
  }, [loadDesignations]);

  useEffect(() => {
    // Auto-enforce subscriptionActive=true for REPORTER creators
    if (isReporterRole) {
      setSubscriptionActive(true);
    } else if (subscriptionActive === null) {
      setSubscriptionActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReporterRole]);

  useEffect(() => {
    // Backend rule: manualLoginEnabled requires subscriptionActive=false.
    if (subscriptionActive) {
      setManualLoginEnabled(false);
      setManualLoginDays('');
    }
  }, [subscriptionActive]);

  const designationsByLevel = useMemo(() => {
    const q = desigQuery.trim().toLowerCase();
    const filtered = q
      ? designations.filter((d) => String(d.name || '').toLowerCase().includes(q))
      : designations;
    const buckets: Record<string, ReporterDesignation[]> = { STATE: [], DISTRICT: [], ASSEMBLY: [], MANDAL: [] };
    for (const d of filtered) {
      const lvl = String(d.level || '').toUpperCase();
      if (buckets[lvl]) buckets[lvl].push(d);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    return buckets;
  }, [designations, desigQuery]);

  const selectedLevel = String(selectedDesig?.level || '').toUpperCase();

  useEffect(() => {
    // Reset dependent selections when designation changes
    setSelectedLoc(null);
    setAvailabilityResult(null);
    setLocQuery('');
    setLocItems([]);
  }, [selectedDesig?.id]);

  const buildAvailabilityPayload = useCallback((locId: string) => {
    if (!selectedDesig?.id) return null;
    const level = selectedLevel as Exclude<ReporterLevel, null>;
    const base: any = {
      designationId: selectedDesig.id,
      level,
    };
    if (selectedLevel === 'STATE') base.stateId = locId;
    if (selectedLevel === 'DISTRICT') base.districtId = locId;
    if (selectedLevel === 'ASSEMBLY') base.assemblyConstituencyId = locId;
    if (selectedLevel === 'MANDAL') base.mandalId = locId;
    return base;
  }, [selectedDesig?.id, selectedLevel]);

  const checkAvailabilityAndMaybeAdvance = useCallback(async (it: CombinedLocationItem) => {
    setFormError(null);
    if (!tenantId) {
      setFormError('Missing tenantId');
      return;
    }
    if (!selectedDesig) {
      setFormError('Select designation first');
      return;
    }
    if (!isAllowedLocationForLevel(selectedLevel, it)) {
      setFormError(`Not allowed: select a ${selectedLevel.toLowerCase()} location`);
      return;
    }
    const locId = it.match?.id;
    if (!locId) {
      setFormError('Invalid location');
      return;
    }

    const payload = buildAvailabilityPayload(locId);
    if (!payload) {
      setFormError('Select a designation');
      return;
    }

    setSelectedLoc(it);
    setCheckingAvailability(true);
    setAvailabilityResult(null);
    try {
      const res = await checkPublicReporterAvailability(tenantId, payload);
      const available = !!res?.available;
      setAvailabilityResult({ id: locId, available });

      if (!available) {
        setFormError('Area not available, try another location');
        return;
      }

      const pricing = res?.pricing;
      const subscriptionEnabled = !!pricing?.subscriptionEnabled;
      if (pricing?.monthlySubscriptionAmount !== undefined && pricing?.monthlySubscriptionAmount !== null) {
        setMonthlyAmount(String(pricing.monthlySubscriptionAmount));
      }
      if (pricing?.idCardCharge !== undefined && pricing?.idCardCharge !== null) {
        setIdCardCharge(String(pricing.idCardCharge));
      }

      if (isReporterRole) {
        setSubscriptionActive(true);
      } else {
        setSubscriptionActive(subscriptionEnabled);
      }

      setStep(3);
    } catch (e: any) {
      setFormError(e?.message || 'Failed to check availability');
    } finally {
      setCheckingAvailability(false);
    }
  }, [tenantId, selectedDesig, selectedLevel, buildAvailabilityPayload, isReporterRole]);

  useEffect(() => {
    const q = locQuery.trim();
    if (step !== 2) return;
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
        if (!cancelled) setLocItems(items);
      } catch {
        if (!cancelled) setLocItems([]);
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [locQuery, step]);

  const onPickLocation = useCallback((it: CombinedLocationItem) => {
    void checkAvailabilityAndMaybeAdvance(it);
  }, [checkAvailabilityAndMaybeAdvance]);

  const goToStep3 = useCallback(async () => {
    setFormError(null);
    const locId = selectedLoc?.match?.id;
    if (!locId || !selectedLoc) {
      setFormError('Select a location');
      return;
    }
    if (availabilityResult?.id === locId) {
      if (availabilityResult.available) setStep(3);
      else setFormError('Area not available, try another location');
      return;
    }
    await checkAvailabilityAndMaybeAdvance(selectedLoc);
  }, [availabilityResult, checkAvailabilityAndMaybeAdvance, selectedLoc]);

  const onBack = useCallback(() => {
    setFormError(null);
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }, [router, step]);

  const selectDesignation = useCallback((d: ReporterDesignation) => {
    setFormError(null);
    setSelectedDesig(d);
    setDesigQuery('');
    setStep(2);
  }, []);

  const clearDesignation = useCallback(() => {
    setFormError(null);
    setSelectedDesig(null);
    setSelectedLoc(null);
    setLocQuery('');
    setLocItems([]);
    setStep(1);
  }, []);

  const canSubmit = useMemo(() => {
    if (!tenantId) return false;
    if (!isAllowedRole) return false;
    if (!selectedDesig?.id) return false;
    if (!selectedLoc?.match?.id) return false;
    if (!fullName.trim()) return false;
    if (digitsOnly(mobileNumber).length !== 10) return false;
    if (subscriptionActive === null) return false;

    if (manualLoginEnabled) {
      if (subscriptionActive) return false;
      const days = Number(digitsOnly(manualLoginDays) || '0');
      if (!Number.isFinite(days) || days < 1 || days > 31) return false;
    }

    if (subscriptionActive) {
      if (!digitsOnly(monthlyAmount).length) return false;
      if (!digitsOnly(idCardCharge).length) return false;
    }
    return true;
  }, [tenantId, isAllowedRole, selectedDesig?.id, selectedLoc?.match?.id, fullName, mobileNumber, subscriptionActive, monthlyAmount, idCardCharge, manualLoginEnabled, manualLoginDays]);

  const submit = useCallback(async () => {
    setFormError(null);
    if (!tenantId) {
      setFormError('Missing tenantId');
      return;
    }
    if (!isAllowedRole) {
      setFormError('Not allowed for your role');
      return;
    }
    if (!selectedDesig?.id || !selectedLevel) {
      setFormError('Select a designation');
      return;
    }
    if (!selectedLoc?.match?.id) {
      setFormError('Select a location');
      return;
    }

    const mobile = digitsOnly(mobileNumber);
    if (mobile.length !== 10) {
      setFormError('Enter a valid 10-digit mobile number');
      return;
    }

    if (manualLoginEnabled) {
      if (subscriptionActive) {
        setFormError('Manual login requires subscription inactive');
        return;
      }
      const days = Number(digitsOnly(manualLoginDays) || '0');
      if (!Number.isFinite(days) || days < 1 || days > 31) {
        setFormError('Manual login days must be between 1 and 31');
        return;
      }
    }

    const payload: CreateTenantReporterInput = {
      designationId: selectedDesig.id,
      level: selectedLevel as Exclude<ReporterLevel, null>,
      fullName: fullName.trim(),
      mobileNumber: mobile,
      subscriptionActive: manualLoginEnabled ? false : !!subscriptionActive,
      autoPublish,
    };

    if (selectedLevel === 'STATE') payload.stateId = selectedLoc.match.id;
    if (selectedLevel === 'DISTRICT') payload.districtId = selectedLoc.match.id;
    if (selectedLevel === 'ASSEMBLY') payload.assemblyConstituencyId = selectedLoc.match.id;
    if (selectedLevel === 'MANDAL') payload.mandalId = selectedLoc.match.id;

    if (manualLoginEnabled) {
      payload.manualLoginEnabled = true;
      payload.manualLoginDays = Number(digitsOnly(manualLoginDays) || '0');
    }

    if (!manualLoginEnabled && subscriptionActive) {
      payload.monthlySubscriptionAmount = Number(digitsOnly(monthlyAmount) || '0');
      payload.idCardCharge = Number(digitsOnly(idCardCharge) || '0');
    }

    setSubmitting(true);
    try {
      await createTenantReporter(tenantId, payload);
      router.replace('/tenant/reporters');
    } catch (e: any) {
      setFormError(e?.message || 'Failed to create reporter');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, isAllowedRole, selectedDesig, selectedLevel, selectedLoc, fullName, mobileNumber, subscriptionActive, monthlyAmount, idCardCharge, router, manualLoginEnabled, manualLoginDays, autoPublish]);

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons name="badge" size={18} color={c.text} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Designation</ThemedText>
          </View>

          <View style={{ gap: 10 }}>
            {LEVEL_ORDER.map((lvl) => {
              const list = designationsByLevel[lvl] || [];
              if (!list.length) return null;
              return (
                <View key={lvl} style={{ gap: 8 }}>
                  <ThemedText style={{ color: c.muted, fontSize: 12 }}>{lvl}</ThemedText>
                  {list.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => selectDesignation(d)}
                      style={({ pressed }) => [
                        styles.pickRow,
                        { borderColor: c.border, backgroundColor: c.background },
                        pressed && { opacity: 0.95 },
                      ]}
                    >
                      <ThemedText type="defaultSemiBold" style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                        {d.name}
                      </ThemedText>
                      <MaterialIcons name="chevron-right" size={22} color={c.muted} />
                    </Pressable>
                  ))}
                </View>
              );
            })}

            {desigQuery.trim().length ? (
              LEVEL_ORDER.every((lvl) => (designationsByLevel[lvl] || []).length === 0) ? (
                <ThemedText style={{ color: c.muted, textAlign: 'center', marginTop: 4 }}>
                  No designations found
                </ThemedText>
              ) : null
            ) : null}
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <>
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.cardHeaderRow}>
              <MaterialIcons name="badge" size={18} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Designation</ThemedText>
            </View>

            <View style={styles.selectedRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                  {selectedDesig?.name}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                  Level: {selectedLevel}
                </ThemedText>
              </View>
              <Pressable onPress={clearDesignation} style={[styles.ghostBtn, { borderColor: c.border }]}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Change</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.cardHeaderRow}>
              <MaterialIcons name="place" size={18} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Location</ThemedText>
            </View>

            <ThemedText style={{ color: c.muted, fontSize: 12 }}>Allowed: {selectedLevel}</ThemedText>

            <Pressable
              onPress={focusLocSearch}
              style={({ pressed }) => [
                styles.searchHintBtn,
                { borderColor: c.border, backgroundColor: c.background },
                pressed && { opacity: 0.95 },
              ]}
            >
              <MaterialIcons name="search" size={18} color={c.muted} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                Search location
              </ThemedText>
            </Pressable>

            {selectedLoc ? (
              <View style={[styles.selectedBox, { borderColor: c.border, backgroundColor: c.background }]}>
                <MaterialIcons name="check-circle" size={18} color={accent} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                    {locationLabel(selectedLoc).main}
                  </ThemedText>
                  <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                    {normalizeLocationType(selectedLoc.type)}{locationLabel(selectedLoc).sub ? ` • ${locationLabel(selectedLoc).sub}` : ''}
                  </ThemedText>
                </View>
                {checkingAvailability ? <ActivityIndicator size="small" /> : null}
              </View>
            ) : null}

            {locQuery.trim().length < 2 ? (
              <ThemedText style={{ color: c.muted, textAlign: 'center', marginTop: 10 }}>
                Type minimum 2 letters to search
              </ThemedText>
            ) : null}

            {locLoading && locQuery.trim().length >= 2 && locItems.length === 0 ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={`loc-skel-${i}`}
                    style={[styles.locItem, { borderColor: c.border, backgroundColor: c.background }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Skeleton width={'70%'} height={14} borderRadius={7} />
                      <View style={{ height: 6 }} />
                      <Skeleton width={'55%'} height={12} borderRadius={6} />
                    </View>
                    <Skeleton width={18} height={18} borderRadius={9} />
                  </View>
                ))}
              </View>
            ) : null}

            {locItems.map((it) => {
              const { main, sub } = locationLabel(it);
              const type = normalizeLocationType(it.type);
              const allowed = selectedDesig ? isAllowedLocationForLevel(selectedLevel, it) : true;
              return (
                <Pressable
                  key={`${type}:${it.match?.id}`}
                  onPress={() => onPickLocation(it)}
                  disabled={checkingAvailability}
                  style={({ pressed }) => [
                    styles.locItem,
                    { borderColor: c.border, backgroundColor: c.background },
                    !allowed && { opacity: 0.45 },
                    checkingAvailability && { opacity: 0.7 },
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                      {main}
                    </ThemedText>
                    <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                      {type}{sub ? ` • ${sub}` : ''}
                    </ThemedText>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={c.muted} />
                </Pressable>
              );
            })}

            {!locLoading && locQuery.trim().length >= 2 && locItems.length === 0 ? (
              <ThemedText style={{ color: c.muted, textAlign: 'center', marginTop: 10 }}>
                No results
              </ThemedText>
            ) : null}

            {formError ? (
              <View style={[styles.errorBox, { borderColor: c.border, backgroundColor: c.background, marginTop: 10 }]}>
                <MaterialIcons name="error-outline" size={18} color={c.warning} />
                <ThemedText style={{ color: c.text, flex: 1 }}>{formError}</ThemedText>
              </View>
            ) : null}

            <Pressable
              disabled={!selectedLoc?.match?.id || checkingAvailability}
              onPress={goToStep3}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: selectedLoc?.match?.id && !checkingAvailability ? accent : c.border, marginTop: 12 },
                pressed && selectedLoc?.match?.id && !checkingAvailability && { opacity: 0.92 },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={{ color: selectedLoc?.match?.id ? accentText : c.muted }}>
                {checkingAvailability ? 'Checking...' : 'Next'}
              </ThemedText>
              <MaterialIcons name="chevron-right" size={20} color={selectedLoc?.match?.id ? accentText : c.muted} />
            </Pressable>
          </View>
        </>
      );
    }

    return (
      <>
        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons name="assignment" size={18} color={c.text} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Summary</ThemedText>
          </View>

          <View style={{ gap: 10 }}>
            <View style={[styles.summaryRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <MaterialIcons name="badge" size={18} color={c.muted} />
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                  {selectedDesig?.name || '—'}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                  Level: {selectedLevel || '—'}
                </ThemedText>
              </View>
              <Pressable onPress={clearDesignation} hitSlop={10}>
                <MaterialIcons name="edit" size={18} color={c.muted} />
              </Pressable>
            </View>

            <View style={[styles.summaryRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <MaterialIcons name="place" size={18} color={c.muted} />
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }} numberOfLines={1}>
                  {selectedLoc ? locationLabel(selectedLoc).main : '—'}
                </ThemedText>
                {selectedLoc ? (
                  <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                    {normalizeLocationType(selectedLoc.type)}{locationLabel(selectedLoc).sub ? ` • ${locationLabel(selectedLoc).sub}` : ''}
                  </ThemedText>
                ) : (
                  <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                    Tap edit to select
                  </ThemedText>
                )}
              </View>
              <Pressable onPress={() => setStep(2)} hitSlop={10}>
                <MaterialIcons name="edit" size={18} color={c.muted} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons name="person" size={18} color={c.text} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Personal</ThemedText>
          </View>
          <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 10 }}>
            Enter name and 10-digit mobile number
          </ThemedText>

          <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>Full name</ThemedText>
          <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
            <MaterialIcons name="person" size={18} color={c.muted} />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text }]}
            />
          </View>

          <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 10, marginBottom: 6 }}>Mobile number</ThemedText>
          <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
            <MaterialIcons name="call" size={18} color={c.muted} />
            <TextInput
              value={mobileNumber}
              onChangeText={(v) => setMobileNumber(digitsOnly(v).slice(0, 10))}
              placeholder="Mobile number (10 digits)"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              style={[styles.input, { color: c.text }]}
              maxLength={10}
            />
          </View>
        </View>

        {!manualLoginEnabled ? (
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.cardHeaderRow}>
              <MaterialIcons name="credit-card" size={18} color={c.text} />
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Subscription</ThemedText>
            </View>

            <View style={[styles.subSwitchRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                  Active
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                  Turn on to enter monthly amount and ID card charge
                </ThemedText>
              </View>
              <Switch
                value={!!subscriptionActive}
                onValueChange={(v) => {
                  setSubscriptionActive(v);
                  if (v) {
                    // Only one allowed
                    setManualLoginEnabled(false);
                    setManualLoginDays('');
                  }
                }}
                disabled={isReporterRole}
                trackColor={{ false: c.border, true: accent }}
                thumbColor={c.card}
              />
            </View>

            {isReporterRole ? (
              <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
                Reporter role requires subscriptionActive=true
              </ThemedText>
            ) : null}

            {subscriptionActive ? (
              <View style={{ gap: 10, marginTop: 10 }}>
                <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 2 }}>Monthly amount</ThemedText>
                <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                  <MaterialIcons name="payments" size={18} color={c.muted} />
                  <TextInput
                    value={monthlyAmount}
                    onChangeText={(v) => setMonthlyAmount(digitsOnly(v))}
                    placeholder="Monthly amount"
                    placeholderTextColor={c.muted}
                    keyboardType="number-pad"
                    onFocus={scrollToBottomSoon}
                    editable={canEditPricing}
                    style={[styles.input, { color: c.text }]}
                  />
                </View>

                <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 4, marginBottom: 2 }}>ID card charge</ThemedText>
                <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                  <MaterialIcons name="badge" size={18} color={c.muted} />
                  <TextInput
                    value={idCardCharge}
                    onChangeText={(v) => setIdCardCharge(digitsOnly(v))}
                    placeholder="ID card charge"
                    placeholderTextColor={c.muted}
                    keyboardType="number-pad"
                    onFocus={scrollToBottomSoon}
                    editable={canEditPricing}
                    style={[styles.input, { color: c.text }]}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons name="settings" size={18} color={c.text} />
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Settings</ThemedText>
          </View>

          {!subscriptionActive && !isReporterRole ? (
            <>
              <View style={[styles.subSwitchRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                    Manual login
                  </ThemedText>
                  <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                    If enabled, subscription must be inactive (max 31 days)
                  </ThemedText>
                </View>
                <Switch
                  value={manualLoginEnabled}
                  onValueChange={(v) => {
                    if (v) {
                      // Only one allowed
                      setSubscriptionActive(false);
                      setManualLoginEnabled(true);
                      scrollToBottomSoon();
                    } else {
                      setManualLoginEnabled(false);
                      setManualLoginDays('');
                    }
                  }}
                  trackColor={{ false: c.border, true: accent }}
                  thumbColor={c.card}
                />
              </View>

              {manualLoginEnabled ? (
                <View style={{ gap: 10, marginTop: 10 }}>
                  <ThemedText style={{ color: c.muted, fontSize: 12, marginBottom: 2 }}>Days (1 to 31)</ThemedText>
                  <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <MaterialIcons name="schedule" size={18} color={c.muted} />
                    <TextInput
                      value={manualLoginDays}
                      onChangeText={(v) => {
                        const raw = digitsOnly(v).slice(0, 2);
                        const n = Number(raw || '0');
                        if (!raw) {
                          setManualLoginDays('');
                          return;
                        }
                        setManualLoginDays(String(Math.min(31, Math.max(0, n))));
                      }}
                      placeholder="Days"
                      placeholderTextColor={c.muted}
                      keyboardType="number-pad"
                      onFocus={scrollToBottomSoon}
                      style={[styles.input, { color: c.text }]}
                      maxLength={2}
                    />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={[styles.subSwitchRow, { borderColor: c.border, backgroundColor: c.background, marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                Auto publish articles
              </ThemedText>
              <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                Allow reporter articles to be auto published
              </ThemedText>
            </View>
            <Switch
              value={autoPublish}
              onValueChange={setAutoPublish}
              trackColor={{ false: c.border, true: accent }}
              thumbColor={c.card}
            />
          </View>
        </View>

        {formError ? (
          <View style={[styles.errorBox, { borderColor: c.border, backgroundColor: c.card }]}>
            <MaterialIcons name="error-outline" size={18} color={c.warning} />
            <ThemedText style={{ color: c.text, flex: 1 }}>{formError}</ThemedText>
          </View>
        ) : null}

        <Pressable
          disabled={!canSubmit || submitting}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: canSubmit ? accent : c.border },
            pressed && canSubmit && { opacity: 0.92 },
            submitting && { opacity: 0.7 },
          ]}
        >
          {submitting ? <ActivityIndicator color={accentText} /> : <MaterialIcons name="check" size={18} color={accentText} />}
          <ThemedText type="defaultSemiBold" style={{ color: canSubmit ? accentText : c.muted }}>
            Create Reporter
          </ThemedText>
        </Pressable>
      </>
    );
  };

  const renderLoadingSkeleton = () => {
    if (step === 2) {
      return (
        <View style={{ padding: 12, gap: 12 }}>
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.cardHeaderRow}>
              <Skeleton width={18} height={18} borderRadius={9} />
              <Skeleton width={110} height={14} borderRadius={7} />
            </View>
            <Skeleton width={'75%'} height={14} borderRadius={7} />
            <View style={{ height: 8 }} />
            <Skeleton width={'55%'} height={12} borderRadius={6} />
          </View>

          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.cardHeaderRow}>
              <Skeleton width={18} height={18} borderRadius={9} />
              <Skeleton width={90} height={14} borderRadius={7} />
            </View>
            <Skeleton width={'40%'} height={12} borderRadius={6} />
            <View style={{ height: 12 }} />
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`step2-skel-${i}`} style={[styles.locItem, { borderColor: c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1 }}>
                  <Skeleton width={'70%'} height={14} borderRadius={7} />
                  <View style={{ height: 6 }} />
                  <Skeleton width={'55%'} height={12} borderRadius={6} />
                </View>
                <Skeleton width={18} height={18} borderRadius={9} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={{ padding: 12, gap: 12 }}>
        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.cardHeaderRow}>
            <Skeleton width={18} height={18} borderRadius={9} />
            <Skeleton width={110} height={14} borderRadius={7} />
          </View>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`desig-skel-${i}`} style={[styles.pickRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <View style={{ flex: 1 }}>
                <Skeleton width={'80%'} height={14} borderRadius={7} />
              </View>
              <Skeleton width={18} height={18} borderRadius={9} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable onPress={onBack} style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        {step === 1 ? (
          <View style={[styles.appBarSearch, { borderColor: c.border, backgroundColor: c.card }]}>
            <MaterialIcons name="search" size={18} color={c.muted} />
            <TextInput
              value={desigQuery}
              onChangeText={setDesigQuery}
              placeholder="Search designation"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text }]}
              returnKeyType="search"
            />
            {desigQuery.trim().length ? (
              <Pressable onPress={() => setDesigQuery('')} hitSlop={10}>
                <MaterialIcons name="close" size={18} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : step === 2 ? (
          <View style={[styles.appBarSearch, { borderColor: c.border, backgroundColor: c.card }]}>
            <MaterialIcons name="search" size={18} color={c.muted} />
            <TextInput
              ref={locSearchRef}
              value={locQuery}
              onChangeText={setLocQuery}
              placeholder="Search location"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text }]}
              returnKeyType="search"
            />
            {locLoading ? <ActivityIndicator size="small" /> : null}
            {locQuery.trim().length ? (
              <Pressable onPress={() => setLocQuery('')} hitSlop={10}>
                <MaterialIcons name="close" size={18} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {renderLoadingSkeleton()}
          </ScrollView>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Couldn’t load</ThemedText>
          <ThemedText style={{ color: c.muted }}>{error}</ThemedText>
          <Pressable onPress={loadDesignations} style={[styles.primaryBtn, { backgroundColor: accent }]}>
            <ThemedText type="defaultSemiBold" style={{ color: accentText }}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : !isAllowedRole ? (
        <View style={styles.center}>
          <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Not allowed</ThemedText>
          <ThemedText style={{ color: c.muted }}>Your role can’t create reporters.</ThemedText>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {Platform.OS === 'ios' ? (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={80}>
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: scrollPadBottom, flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {renderStepContent()}
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: scrollPadBottom, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {renderStepContent()}
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  appBarSearch: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },

  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },

  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  pickRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  inputRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, padding: 0, margin: 0 },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  subSwitchRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  subToggleWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  subToggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  primaryBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  ghostBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },

  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },

  selectedBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  summaryRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchHintBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  locItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
});
