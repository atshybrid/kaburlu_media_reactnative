import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getStateSymbol } from '@/components/languageSymbols';
import { clearTokens, loadTokens, saveTokens } from '@/services/auth';
import { getDeviceIdentity } from '@/services/device';
import { Language } from '@/types/language';
import {
  getLanguages,
  registerGuestUser,
  updatePreferences,
} from '@/services/api';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { Spacing } from '@/constants/Spacing';

// ─── Theme ───────────────────────────────────────────────────────────────────
const INDIGO       = '#4F46E5';
const INDIGO_DARK  = '#3730A3';
const SAFFRON      = '#FA7C05';
const BG           = '#EEEEFF';
const CARD_BG      = '#FFFFFF';
const TEXT_DARK    = '#1E1B4B';
const TEXT_MUTED   = '#6B7280';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W   = (SCREEN_W - Spacing.md * 2 - CARD_GAP) / 2;
const PAPER_DATE = new Date().toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
}).toUpperCase();

function getDeskForLanguage(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c === 'te') return 'HYDERABAD';
  if (c === 'hi') return 'DELHI';
  if (c === 'ta') return 'CHENNAI';
  if (c === 'kn') return 'BENGALURU';
  if (c === 'mr') return 'MUMBAI';
  if (c === 'bn') return 'KOLKATA';
  if (c === 'ml') return 'KOCHI';
  if (c === 'gu') return 'AHMEDABAD';
  if (c === 'pa') return 'CHANDIGARH';
  return 'NATIONAL';
}

function getLanguageAccent(code?: string): string {
  const c = String(code || '').toLowerCase();
  if (c === 'te') return '#7C3AED';
  if (c === 'hi') return '#DC2626';
  if (c === 'ta') return '#0891B2';
  if (c === 'kn') return '#2563EB';
  if (c === 'mr') return '#EA580C';
  if (c === 'bn') return '#DB2777';
  if (c === 'ml') return '#059669';
  if (c === 'gu') return '#CA8A04';
  if (c === 'pa') return '#16A34A';
  return INDIGO;
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────
const CardSkeleton = () => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.skeletonGrid}>
      {[...Array(6)].map((_, i) => (
        <Animated.View key={i} style={[styles.skeletonCard, { opacity: pulse }]} />
      ))}
    </View>
  );
};

// ─── Language Card ────────────────────────────────────────────────────────────
interface CardProps {
  item: Language;
  selected: boolean;
  onPress: (lang: Language) => void;
}

const LanguageCard = memo(({ item, selected, onPress }: CardProps) => {
  const scale  = useRef(new Animated.Value(0.85)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  const nativePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 12,
      stiffness: 120,
    }).start();
  }, [scale]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(nativePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(nativePulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [nativePulse]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(bounce, { toValue: 0.92, useNativeDriver: true, speed: 40 }),
      Animated.spring(bounce, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress(item);
  }, [bounce, item, onPress]);

  const StateSymbol = getStateSymbol(String(item.code || '').toLowerCase());
  const desk = getDeskForLanguage(item.code);
  const accentColor = getLanguageAccent(item.code);

  const nativeScale = nativePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const nativeOpacity = nativePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: Animated.multiply(scale, bounce) }] },
          selected && styles.cardSelected,
        ]}
      >
        {/* Watermark */}
        {StateSymbol ? (
          <View style={styles.watermarkWrap}>
            <StateSymbol size={56} color={INDIGO_DARK} />
          </View>
        ) : null}

        {/* Check badge */}
        {selected && (
          <View style={styles.checkBadge}>
            <MaterialCommunityIcons name="check" size={12} color="#fff" />
          </View>
        )}

        <View style={styles.paperHeaderRow}>
          <Text style={styles.paperMasthead}>KABURLU DAILY</Text>
          <Text style={styles.paperDate}>{PAPER_DATE}</Text>
        </View>

        <View style={styles.paperRule} />

        <View style={styles.paperColumns}>
          <View style={styles.paperCol} />
          <View style={styles.paperCol} />
          <View style={styles.paperColShort} />
        </View>

        <Text style={styles.paperDesk}>{desk} DESK</Text>

        {/* Label */}
        <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>
          {item.name.toUpperCase()}
        </Text>
        {item.nativeName ? (
          <Animated.Text
            style={[
              styles.cardNative,
              { color: accentColor, opacity: nativeOpacity, transform: [{ scale: nativeScale }] },
              selected && styles.cardNativeSelected,
            ]}
          >
            {item.nativeName}
          </Animated.Text>
        ) : null}
        <Text style={styles.cardCode}>{String(item.code || '').toUpperCase()} EDITION</Text>
      </Animated.View>
    </Pressable>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function LanguageSelectionScreen() {
  const [languages,        setLanguages]        = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);

  const btnAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch languages
  useEffect(() => {
    (async () => {
      try {
        const langs = await getLanguages();
        setLanguages(langs);

        // Restore previously saved language (don't auto-select on fresh load)
        const saved = await AsyncStorage.getItem('selectedLanguage');
        if (saved) {
          const parsed: Language = JSON.parse(saved);
          const match = langs.find((l) => l.id === parsed.id);
          if (match) {
            setSelectedLanguage(match);
            Animated.spring(btnAnim, { toValue: 1, useNativeDriver: true }).start();
          }
        }
      } catch (e) {
        console.error('getLanguages error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [btnAnim]);

  // ── Card press
  const handleCardPress = useCallback(
    (lang: Language) => {
      setSelectedLanguage(lang);
      Animated.spring(btnAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }).start();
    },
    [btnAnim],
  );

  // ── GET STARTED
  const handleContinue = useCallback(async () => {
    if (!selectedLanguage) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem('selectedLanguage', JSON.stringify(selectedLanguage));

      const deviceDetails = await getDeviceIdentity();
      const existingTokens = await loadTokens();

      const registerFreshGuest = async () => {
        const auth = await registerGuestUser({
          languageId: String(selectedLanguage.id),
          deviceDetails,
        });
        await saveTokens({
          jwt: auth.jwt,
          refreshToken: auth.refreshToken,
          expiresAt: auth.expiresAt,
          languageId: auth.languageId,
          user: auth.user,
        });
      };

      if (existingTokens?.jwt && existingTokens?.refreshToken) {
        try {
          await updatePreferences({ languageId: String(selectedLanguage.id) });
        } catch (e: any) {
          const msg = String(e?.message || '');
          const status = Number(e?.status || e?.response?.status || 0);
          const shouldReRegister = /user not found/i.test(msg) || status === 401 || status === 404;
          if (!shouldReRegister) throw e;

          // Stale/invalid user session on backend: reset auth and continue as guest.
          await clearTokens().catch(() => {});
          await registerFreshGuest();
        }
      } else {
        await registerFreshGuest();
      }

      router.replace('/(tabs)');
    } catch (e) {
      console.error('handleContinue error:', e);
    } finally {
      setSaving(false);
    }
  }, [selectedLanguage]);

  // ── Button transform
  const btnTranslateY = btnAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [120, 0],
  });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Language Settings</Text>
      </View>

      {/* Hero text */}
      <View style={styles.hero}>
        <Text style={styles.heroLine}>
          {'Choose Your '}
          <Text style={styles.heroAccent}>Voice</Text>
        </Text>
        <Text style={styles.heroSub}>
          Pick the language you want news delivered in
        </Text>
      </View>

      {/* Cards */}
      {loading ? (
        <CardSkeleton />
      ) : (
        <FlatList
          data={languages}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <LanguageCard
              item={item}
              selected={selectedLanguage?.id === item.id}
              onPress={handleCardPress}
            />
          )}
        />
      )}

      {/* GET STARTED button */}
      <Animated.View
        style={[
          styles.btnWrap,
          { transform: [{ translateY: btnTranslateY }] },
        ]}
        pointerEvents={selectedLanguage ? 'auto' : 'none'}
      >
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          onPress={handleContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>GET STARTED →</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
    letterSpacing: 0.4,
  },

  hero: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  heroLine: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: -0.5,
  },
  heroAccent: {
    color: '#FF9933',
    fontStyle: 'italic',
  },
  heroSub: {
    marginTop: 6,
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: CARD_GAP,
  },
  skeletonCard: {
    width: CARD_W,
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: '#D1D5FF',
    marginBottom: CARD_GAP,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 140,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },

  // Card
  card: {
    width: CARD_W,
    minHeight: 156,
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: SAFFRON,
    borderWidth: 2,
    backgroundColor: '#FFF5EB',
  },
  watermarkWrap: {
    position: 'absolute',
    opacity: 0.06,
    top: 34,
    right: -8,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SAFFRON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperMasthead: {
    fontSize: 9,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 1,
  },
  paperDate: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  paperRule: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
  },
  paperColumns: {
    marginTop: 6,
    gap: 3,
  },
  paperCol: {
    height: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  paperColShort: {
    height: 2,
    width: '70%',
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  paperDesk: {
    marginTop: 7,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: '#374151',
    textAlign: 'center',
  },
  cardCode: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  cardLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    letterSpacing: 0.7,
  },
  cardLabelSelected: {
    color: INDIGO_DARK,
  },
  cardNative: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cardNativeSelected: {
    textDecorationLine: 'underline',
  },

  // Button
  btnWrap: {
    position: 'absolute',
    bottom: 36,
    left: Spacing.md,
    right: Spacing.md,
  },
  btn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D97706',
    ...Shadows.md,
  },
  btnText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
