import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getBaseUrl } from '@/services/http';
import { getTenantAdminOverview, type TenantAdminOverviewCard } from '@/services/tenantAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_PADDING_H = 14;

function iconNameForCardKey(key?: string) {
  switch (key) {
    case 'web_articles':
      return 'language';
    case 'newspaper_articles':
      return 'newspaper';
    case 'reporters':
      return 'groups';
    case 'id_cards':
      return 'badge';
    case 'payments':
      return 'payments';
    case 'ads':
      return 'campaign';
    default:
      return 'grid-view';
  }
}

function accentColorForCardKey(key: string | undefined, c: (typeof Colors)['light']) {
  switch (key) {
    case 'web_articles':
      return c.tint;
    case 'newspaper_articles':
      return c.secondary;
    case 'reporters':
      return c.warning;
    case 'id_cards':
      return c.tint;
    case 'payments':
      return c.secondary;
    case 'ads':
      return c.warning;
    default:
      return c.tint;
  }
}

function gradientForCardKey(key: string | undefined, c: (typeof Colors)['light']) {
  // Use only theme tokens. Provide a bold but on-brand gradient.
  const a = accentColorForCardKey(key, c);
  if (a === c.secondary) return [c.secondary, c.tint] as const;
  if (a === c.warning) return [c.warning, c.tint] as const;
  return [c.tint, c.secondary] as const;
}

function formatGeneratedAt(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export default function TenantDashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getTenantAdminOverview>> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantAdminOverview();
      setOverview(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pageWidth = useMemo(() => Math.max(320, windowWidth || 360), [windowWidth]);
  const cardWidth = useMemo(() => {
    // Match the page's inner width so the left gap is correct and symmetric.
    return Math.max(240, pageWidth - SCREEN_PADDING_H * 2);
  }, [pageWidth]);
  const styles = useMemo(() => makeStyles(scheme, cardWidth), [scheme, cardWidth]);
  const tenantInitials = useMemo(() => {
    const name = overview?.tenant?.name || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
    return letters || 'T';
  }, [overview?.tenant?.name]);

  const onOpenDrilldown = useCallback(async (card: TenantAdminOverviewCard) => {
    const href = card?.drilldown?.href;
    if (!href) return;
    const base = getBaseUrl();
    // href already includes /api/v1/... ; base also includes /api/v1.
    // Build a full URL by taking the origin from base.
    let url = href;
    try {
      const origin = new URL(base).origin;
      url = `${origin}${href}`;
    } catch {
      // If URL parsing fails, fall back to plain concatenation.
      url = `${base}${href.startsWith('/') ? '' : '/'}${href}`;
    }
    try {
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  const generatedAtLabel = formatGeneratedAt(overview?.generatedAt);
  const title = overview?.tenant?.name || 'Tenant Dashboard';
  const subtitle = overview?.tenant?.slug ? overview.tenant.slug : 'Overview';
  const c = Colors[scheme];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      <View style={styles.appBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, styles.iconBtnLeft, pressed && styles.pressed]}
          hitSlop={10}
        >
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <View style={styles.appBarTitleCol}>
          <View style={styles.appBarTitleRow}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText} type="defaultSemiBold">
                {tenantInitials}
              </ThemedText>
            </View>
            <View style={styles.titleTextCol}>
              <ThemedText style={styles.title} type="defaultSemiBold" numberOfLines={1}>
                {title}
              </ThemedText>
              <ThemedText style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </ThemedText>
            </View>
          </View>
          {!!generatedAtLabel && (
            <ThemedText style={styles.generatedAt} numberOfLines={1}>
              Updated {generatedAtLabel}
            </ThemedText>
          )}
        </View>

        <Pressable
          onPress={load}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <MaterialIcons name="refresh" size={22} color={c.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText style={styles.centerText}>Loading overview…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={styles.errorTitle} type="defaultSemiBold">
            Couldn’t load dashboard
          </ThemedText>
          <ThemedText style={styles.centerText}>{error}</ThemedText>
          <Pressable onPress={load} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryBtnText} type="defaultSemiBold">
              Retry
            </ThemedText>
          </Pressable>
        </View>
      ) : !overview ? (
        <View style={styles.center}>
          <ThemedText style={styles.centerText}>No dashboard data</ThemedText>
        </View>
      ) : (
        <View style={styles.body}>
          <FlatList
            data={overview.cards || []}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={pageWidth}
            disableIntervalMomentum
            decelerationRate="fast"
            removeClippedSubviews
            initialNumToRender={3}
            windowSize={5}
            contentContainerStyle={styles.carouselContent}
            getItemLayout={(_data, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
            renderItem={({ item }) => (
              <View style={[styles.page, { width: pageWidth }]}>
                <DashboardCard card={item} scheme={scheme} styles={styles} onPress={() => onOpenDrilldown(item)} />
              </View>
            )}
          />

          <View style={styles.bottomSpacer} />
        </View>
      )}
    </SafeAreaView>
  );
}

type ScreenStyles = ReturnType<typeof makeStyles>;

function DashboardCard({
  card,
  scheme,
  styles: s,
  onPress,
}: {
  card: TenantAdminOverviewCard;
  scheme: 'light' | 'dark';
  styles: ScreenStyles;
  onPress: () => void;
}) {
  const c = Colors[scheme];
  const iconName = iconNameForCardKey(card.key) as any;
  const gradient = gradientForCardKey(card.key, c);
  const contrastText = scheme === 'dark' ? Colors.dark.text : Colors.light.background;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { borderColor: c.border },
        pressed && s.cardPressed,
      ]}
      android_ripple={{ color: c.border }}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.cardBg}
      />

      <View style={s.cardTopRow}>
        <View style={s.iconPill}>
          <MaterialIcons name={iconName} size={18} color={contrastText} />
        </View>
        {!!card.drilldown?.href && <MaterialIcons name="chevron-right" size={20} color={contrastText} />}
      </View>

      <ThemedText style={[s.cardTitle, { color: contrastText }]} type="defaultSemiBold" numberOfLines={2}>
        {card.title}
      </ThemedText>

      <ThemedText style={[s.primaryValue, { color: contrastText }]} type="defaultSemiBold" numberOfLines={1}>
        {String(card.primary?.value ?? 0)}
      </ThemedText>

      <ThemedText style={[s.primaryLabel, { color: contrastText }]} numberOfLines={2}>
        {card.primary?.label}
      </ThemedText>
    </Pressable>
  );
}

function makeStyles(scheme: 'light' | 'dark', cardWidth: number) {
  const c = Colors[scheme];
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    iconBtnLeft: { marginRight: 10 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appBarTitleCol: { flex: 1 },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    avatarText: { color: c.text },
    titleTextCol: { flex: 1 },
    title: { color: c.text, fontSize: 16 },
    subtitle: { color: c.muted, fontSize: 13, marginTop: 2 },
    generatedAt: { color: c.muted, fontSize: 12, marginTop: 6 },

    body: { flex: 1, paddingTop: 12 },
    sectionHeaderRow: {
      paddingHorizontal: SCREEN_PADDING_H,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    sectionTitle: { color: c.text },
    sectionHint: { color: c.muted, fontSize: 13 },
    carouselContent: { paddingBottom: 18 },
    page: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 10, alignItems: 'center' },
    bottomSpacer: { height: 18 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
    centerText: { color: c.muted, textAlign: 'center' },
    errorTitle: { color: c.text, textAlign: 'center' },
    primaryBtn: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.tint,
    },
    primaryBtnText: { color: Colors.light.background },
    pressed: { opacity: 0.85 },

    // Card styles (scoped via factory because width depends on screen)
    card: {
      width: cardWidth,
      minHeight: 180,
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      overflow: 'hidden',
    },
    cardPressed: { transform: [{ scale: 0.995 }], opacity: 0.96 },
    cardBg: {
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },

    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconPill: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 18, marginTop: 14 },
    primaryValue: { fontSize: 44, lineHeight: 48, marginTop: 10 },
    primaryLabel: { fontSize: 14, marginTop: 8, opacity: 0.95 },
  });
}
