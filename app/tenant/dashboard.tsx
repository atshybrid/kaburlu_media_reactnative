import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import { getTenantAdminOverview, type TenantAdminOverviewCard } from '@/services/tenantAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_PADDING_H = 14;
const CAROUSEL_HEIGHT = 232;

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

function TenantDashboardSkeleton(opts: { styles: ReturnType<typeof makeStyles>; pageWidth: number }) {
  const { styles, pageWidth } = opts;
  return (
    <View style={styles.body}>
      <View style={styles.carouselArea}>
        <View style={[styles.page, { width: pageWidth }]}>
          <View style={{ paddingHorizontal: SCREEN_PADDING_H }}>
            <Skeleton width={'100%'} height={CAROUSEL_HEIGHT} borderRadius={22} />
          </View>
        </View>
      </View>

      <View style={styles.actionsArea}>
        <View style={{ paddingHorizontal: SCREEN_PADDING_H }}>
          <Skeleton width={'100%'} height={56} borderRadius={16} />
        </View>
      </View>
    </View>
  );
}


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
  // Relative luminance heuristic
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return lum < 0.55 ? Colors.light.background : Colors.light.text;
}


export default function TenantDashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [brandSecondary, setBrandSecondary] = useState<string | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [brandLogoAspectRatio, setBrandLogoAspectRatio] = useState<number | null>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        const session: any = (t as any)?.session;
        const ds = session?.domainSettings;
        const colors = ds?.data?.theme?.colors;
        const primary = colors?.primary || colors?.accent;
        const secondary = colors?.secondary || colors?.accent;
        const logo = ds?.data?.seo?.ogImageUrl || ds?.data?.branding?.logoUrl;
        setBrandPrimary(isValidHexColor(primary) ? String(primary) : null);
        setBrandSecondary(isValidHexColor(secondary) ? String(secondary) : null);
        setBrandLogoUrl(typeof logo === 'string' && logo.trim() ? logo.trim() : null);
        setBrandLogoAspectRatio(null);
      } catch {
        setBrandPrimary(null);
        setBrandSecondary(null);
        setBrandLogoUrl(null);
        setBrandLogoAspectRatio(null);
      }
    })();
  }, []);

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
    if (card?.key === 'reporters') {
      router.push('/tenant/reporters');
      return;
    }
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
  }, [router]);

  const cardsData = useMemo(() => {
    const list = Array.isArray(overview?.cards) ? overview.cards : [];
    const hasReporters = list.some((c) => c?.key === 'reporters');
    if (hasReporters) return list;
    const reportersCard: TenantAdminOverviewCard = {
      key: 'reporters',
      title: 'Reporters',
      primary: { label: 'Active reporters', value: 0 },
      secondary: [],
    };
    return [reportersCard, ...list];
  }, [overview]);

  const postNewsPrimaryColor = useMemo(() => {
    return brandPrimary || Colors[scheme].tint;
  }, [brandPrimary, scheme]);

  const c = Colors[scheme];
  const appBarBg = c.background;
  const appBarFg = c.text;
  const appBarBtnBg = c.card;
  const appBarBtnBorder = c.border;

  const logoBox = useMemo(() => {
    // Default: square. If logo is a wide rectangle, widen the container.
    const ratio = brandLogoAspectRatio;
    const isWide = typeof ratio === 'number' && ratio > 1.25;
    const isTall = typeof ratio === 'number' && ratio < 0.8;

    // Keep height consistent; widen for rectangular logos.
    const height = 56;
    const width = isWide ? 96 : 56;
    const borderRadius = isWide ? 16 : 16;
    // For tall logos, a slightly wider box helps avoid tiny rendering.
    const adjustedWidth = isTall ? 64 : width;

    return { width: adjustedWidth, height, borderRadius };
  }, [brandLogoAspectRatio]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      <View style={[styles.appBar, { backgroundColor: appBarBg }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            styles.iconBtnLeft,
            { backgroundColor: appBarBtnBg, borderColor: appBarBtnBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
        >
          <MaterialIcons name="arrow-back" size={22} color={appBarFg} />
        </Pressable>

        <View style={styles.appBarCenter}>
          <View style={[styles.logoOnlyWrap, { width: logoBox.width, height: logoBox.height, borderRadius: logoBox.borderRadius }]}>
            {brandLogoUrl ? (
              <Image
                source={{ uri: brandLogoUrl }}
                style={styles.logoOnlyImg}
                resizeMode="contain"
                onLoad={(e) => {
                  const w = e?.nativeEvent?.source?.width;
                  const h = e?.nativeEvent?.source?.height;
                  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
                    setBrandLogoAspectRatio(w / h);
                  }
                }}
              />
            ) : (
              <ThemedText style={styles.logoOnlyFallback} type="defaultSemiBold">
                {tenantInitials}
              </ThemedText>
            )}
          </View>
        </View>

        <Pressable
          onPress={load}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: appBarBtnBg, borderColor: appBarBtnBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
        >
          <MaterialIcons name="refresh" size={22} color={appBarFg} />
        </Pressable>
      </View>

      <View style={styles.bodyContainer}>
      {loading ? (
        <TenantDashboardSkeleton styles={styles} pageWidth={pageWidth} />
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={styles.errorTitle} type="defaultSemiBold">
            Couldn’t load dashboard
          </ThemedText>
          <ThemedText style={styles.centerText}>{error}</ThemedText>
          <Pressable
            onPress={load}
            style={({ pressed }) => [styles.primaryBtn, brandSecondary ? { backgroundColor: brandSecondary } : null, pressed && styles.pressed]}
          >
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
          <View style={styles.carouselArea}>
            <FlatList
              data={cardsData}
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
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              getItemLayout={(_data, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
              renderItem={({ item }) => (
                <View style={[styles.page, { width: pageWidth }]}>
                  <DashboardCard
                    card={item}
                    scheme={scheme}
                    styles={styles}
                    onPress={() => onOpenDrilldown(item)}
                    brandPrimary={brandPrimary}
                    brandSecondary={brandSecondary}
                  />
                </View>
              )}
            />
          </View>

          <View style={styles.actionsArea}>
            <Pressable
              onPress={() => router.push('/post-news' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                { borderColor: postNewsPrimaryColor, backgroundColor: Colors.light.background },
                pressed && styles.cardPressed,
              ]}
              android_ripple={{ color: c.border }}
              accessibilityLabel="Post News"
            >
              <View style={styles.actionCardRow}>
                <View style={styles.actionIconPill}>
                  <MaterialIcons name="newspaper" size={20} color={postNewsPrimaryColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={[styles.actionLabel, { color: postNewsPrimaryColor }]}>
                  Post News
                </ThemedText>
                <MaterialIcons name="chevron-right" size={22} color={postNewsPrimaryColor} />
              </View>
            </Pressable>
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      )}
      </View>
    </SafeAreaView>
  );
}

type ScreenStyles = ReturnType<typeof makeStyles>;

function DashboardCard({
  card,
  scheme,
  styles: s,
  onPress,
  brandPrimary,
  brandSecondary,
}: {
  card: TenantAdminOverviewCard;
  scheme: 'light' | 'dark';
  styles: ScreenStyles;
  onPress: () => void;
  brandPrimary: string | null;
  brandSecondary: string | null;
}) {
  const c = Colors[scheme];
  const iconName = iconNameForCardKey(card.key) as any;
  const gradient = (brandPrimary && brandSecondary)
    ? ([brandPrimary, brandSecondary] as const)
    : (brandPrimary
      ? ([brandPrimary, brandPrimary] as const)
      : gradientForCardKey(card.key, c));
  const contrastText = pickReadableTextColor(gradient?.[0] ?? null) || (scheme === 'dark' ? Colors.dark.text : Colors.light.background);

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
    bodyContainer: { flex: 1, backgroundColor: c.background },
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
    appBarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    logoOnlyWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      padding: 2,
    },
    logoOnlyImg: { width: '100%', height: '100%' },
    logoOnlyFallback: { color: c.text },

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
    carouselArea: { height: CAROUSEL_HEIGHT },
    carousel: { flexGrow: 0 },
    carouselContent: { paddingBottom: 18 },
    page: { height: CAROUSEL_HEIGHT, paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 10, alignItems: 'center' },
    actionsArea: { paddingHorizontal: SCREEN_PADDING_H, paddingTop: 8, alignItems: 'center' },
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

    actionCard: {
      width: cardWidth,
      minHeight: 74,
      borderWidth: 1,
      borderRadius: 18,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    actionCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    actionIconPill: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: { flex: 1, fontSize: 16 },
  });
}
