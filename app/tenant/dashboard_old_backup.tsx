/**
 * Tenant Admin Dashboard - Redesigned for Easy Navigation
 * 
 * Features:
 * 📰 News Approval (Most Important - Pending articles)
 * 👥 Reporter Management (Create, KYC, ID Card, Edit, Subscription)
 * 📊 Analytics (Daily articles per reporter, counts)
 * 💰 Payments Tracking
 * 📢 Ads Management
 */

import { ThemedText } from '@/components/ThemedText';
import ReporterWantedPoster from '@/components/tenant/ReporterWantedPoster';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens, softLogout } from '@/services/auth';
import { logout } from '@/services/api';
import {
    getNewspaperArticles,
    getTenantAdminDashboard,
    type TenantAdminFullResponse,
} from '@/services/tenantAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─────────────────────────────  Helpers  ───────────────────────────── */

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

function alphaBg(hex: string, alpha: number, fallback: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMoney(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined || !Number.isFinite(minorUnits)) return '₹0';
  const major = Math.round(minorUnits / 100);
  if (major >= 100000) return `₹${(major / 100000).toFixed(1)}L`;
  if (major >= 1000) return `₹${(major / 1000).toFixed(1)}K`;
  return `₹${major.toLocaleString()}`;
}

function initials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return letters || 'T';
}

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function TenantDashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReporterPoster, setShowReporterPoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TenantAdminFullResponse | null>(null);
  const [sessionBrand, setSessionBrand] = useState<{ primary?: string; logo?: string; name?: string }>({});
  const [actualPendingCount, setActualPendingCount] = useState<number | null>(null); // null = not fetched yet
  const [loggingOut, setLoggingOut] = useState(false);

  const primary = data?.branding?.primaryColor || sessionBrand.primary || c.tint;
  const secondary = data?.branding?.secondaryColor || '#DC2626';
  const logoUrl = data?.branding?.logoUrl || sessionBrand.logo;
  const tenantName = data?.tenant?.name || sessionBrand.name || 'Admin Dashboard';

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      setSessionBrand({
        primary: isValidHexColor(pColor) ? String(pColor) : undefined,
        logo: ds?.data?.branding?.logoUrl,
        name: session?.tenant?.name || session?.tenantName,
      });

      const dashboard = await getTenantAdminDashboard();
      setData(dashboard);
      
      // Fetch actual pending count from newspaper API for accuracy
      try {
        const pendingRes = await getNewspaperArticles({ status: 'PENDING', limit: 1 });
        setActualPendingCount(pendingRes.total || 0);
        console.log('[Dashboard] Actual newspaper pending count:', pendingRes.total);
      } catch (e) {
        console.warn('[Dashboard] Failed to fetch pending count:', e);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  // Hardware back button: go to news page
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/news');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const onRefresh = useCallback(() => void loadData(true), [loadData]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    Alert.alert(
      'లాగ్అవుట్',
      'మీరు లాగ్అవుట్ చేయాలనుకుంటున్నారా?',
      [
        { text: 'రద్దు', style: 'cancel' },
        {
          text: 'లాగ్అవుట్',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              const jwt = await AsyncStorage.getItem('jwt');
              const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
              if (jwt) { try { await logout(); } catch (e: any) { console.warn('[TenantDashboard] remote logout failed', e?.message); } }
              
              // Keep language, location, and push notification preferences
              const keysToKeep = ['selectedLanguage', 'profile_location', 'profile_location_obj', 'push_notifications_enabled'];
              await softLogout(keysToKeep, mobile || undefined);
              
              // Go to account tab
              router.replace('/tech');
            } catch (e: any) {
              console.error('[TenantDashboard] Logout failed:', e);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [router]);

  // Calculate stats - Use actual pending count from API for accuracy
  const pendingArticles = useMemo(() => {
    // Prefer actual count fetched from newspaper API (even if 0)
    if (actualPendingCount !== null) {
      console.log('[Dashboard] Using actual pending count:', actualPendingCount);
      return actualPendingCount;
    }
    // Fallback to dashboard data only if newspaper API failed
    if (!data) return 0;
    const webPending = data.articles.web.byStatus.PENDING || 0;
    const rawPending = data.articles.raw.pendingReview || 0;
    const newspaperPending = data.articles.newspaper.byStatus.PENDING || 0;
    const total = webPending + rawPending + newspaperPending;
    console.log('[Dashboard] Pending from dashboard API:', { webPending, rawPending, newspaperPending, total });
    return total;
  }, [data, actualPendingCount]);

  const pendingKyc = useMemo(() => {
    if (!data) return 0;
    return (data.reporters.kyc.pending || 0) + (data.reporters.kyc.submitted || 0);
  }, [data]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={c.muted} translucent={false} />
        <DashboardSkeleton scheme={scheme} topInset={insets.top} c={c} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.errorCenter}>
          <View style={[styles.errorIcon, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          </View>
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 12 }}>
            {error || 'Failed to load dashboard'}
          </ThemedText>
          <Pressable
            onPress={() => loadData()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: primary }, pressed && { opacity: 0.9 }]}
          >
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Try Again</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
            <ThemedText style={{ color: primary }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { reporters, articles, payments, idCards } = data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#fff' }]} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* ══════════════════════════════════════════════════════════════════
            CLEAN WHITE HEADER WITH LOGO, TOP ARTICLE & TOP REPORTER
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: '#fff' }]}>
          
          {/* Top Bar - Back, Title & Logout */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.replace('/news')}
              style={({ pressed }) => [styles.backBtnWhite, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="arrow-back" size={22} color={c.text} />
            </Pressable>
            <ThemedText style={[styles.headerTitle, { color: c.text }]}>Admin Dashboard</ThemedText>
            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [styles.refreshBtnWhite, pressed && { opacity: 0.7 }]}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={c.muted} />
              ) : (
                <MaterialIcons name="logout" size={22} color={c.muted} />
              )}
            </Pressable>
          </View>

          {/* BRAND LOGO - Large & Prominent */}
          <View style={styles.brandLogoSection}>
            <View style={[styles.logoBgWhite, { borderColor: alphaBg(primary, 0.2, '#eee') }]}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImageLarge} contentFit="contain" />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: alphaBg(primary, 0.1, '#f5f5f5') }]}>
                  <ThemedText style={[styles.logoTextLarge, { color: primary }]}>
                    {initials(tenantName)}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[styles.brandNameLarge, { color: c.text }]} numberOfLines={1}>
              {tenantName}
            </ThemedText>
            {data.tenant?.prgiNumber && (
              <View style={[styles.verifiedBadgeWhite, { backgroundColor: alphaBg('#22C55E', 0.1, '#f0fdf4') }]}>
                <MaterialIcons name="verified" size={14} color="#22C55E" />
                <ThemedText style={styles.verifiedTextGreen}>{data.tenant.prgiNumber}</ThemedText>
              </View>
            )}
          </View>

          {/* HIGHLIGHT CARDS - Top Article & Top Reporter */}
          <View style={styles.highlightCards}>
            {/* Top Performing Article */}
            <View style={[styles.highlightCard, { backgroundColor: alphaBg('#3B82F6', 0.08, '#f0f7ff'), borderColor: alphaBg('#3B82F6', 0.2, '#dbeafe') }]}>
              <View style={styles.highlightIconRow}>
                <MaterialIcons name="trending-up" size={20} color="#3B82F6" />
                <ThemedText style={styles.highlightLabel}>Top Article</ThemedText>
              </View>
              <ThemedText style={[styles.highlightValue, { color: '#3B82F6' }]} numberOfLines={1}>
                {formatNumber(articles.web.totalViews)} views
              </ThemedText>
              <ThemedText style={[styles.highlightSub, { color: c.muted }]} numberOfLines={1}>
                {articles.web.byStatus.PUBLISHED || 0} published total
              </ThemedText>
            </View>

            {/* Top Reporter */}
            <View style={[styles.highlightCard, { backgroundColor: alphaBg('#8B5CF6', 0.08, '#faf5ff'), borderColor: alphaBg('#8B5CF6', 0.2, '#ede9fe') }]}>
              <View style={styles.highlightIconRow}>
                <MaterialIcons name="star" size={20} color="#8B5CF6" />
                <ThemedText style={styles.highlightLabel}>Top Reporter</ThemedText>
              </View>
              <ThemedText style={[styles.highlightValue, { color: '#8B5CF6' }]} numberOfLines={1}>
                {reporters.total > 0 ? `${reporters.total} members` : 'No reporters'}
              </ThemedText>
              <ThemedText style={[styles.highlightSub, { color: c.muted }]} numberOfLines={1}>
                {reporters.active} active this month
              </ThemedText>
            </View>
          </View>

          {/* Quick Stats Row */}
          <View style={[styles.quickStatsRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.quickStat}>
              <ThemedText style={[styles.quickStatNum, { color: '#10B981' }]}>{articles.web.published7d}</ThemedText>
              <ThemedText style={[styles.quickStatLabel, { color: c.muted }]}>This Week</ThemedText>
            </View>
            <View style={[styles.quickStatDivider, { backgroundColor: c.border }]} />
            <View style={styles.quickStat}>
              <ThemedText style={[styles.quickStatNum, { color: '#3B82F6' }]}>{articles.web.published30d}</ThemedText>
              <ThemedText style={[styles.quickStatLabel, { color: c.muted }]}>This Month</ThemedText>
            </View>
            <View style={[styles.quickStatDivider, { backgroundColor: c.border }]} />
            <View style={styles.quickStat}>
              <ThemedText style={[styles.quickStatNum, pendingArticles > 0 ? { color: '#F59E0B' } : { color: c.text }]}>{pendingArticles}</ThemedText>
              <ThemedText style={[styles.quickStatLabel, { color: c.muted }]}>Pending</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* ══════════════════════════════════════════════════════════════════
              � PENDING NEWS ALERT - SIMPLE & CLEAR
          ══════════════════════════════════════════════════════════════════ */}
          {pendingArticles > 0 && (
            <Pressable
              onPress={() => router.push('/tenant/news-approval' as any)}
              style={({ pressed }) => [
                styles.pendingBanner,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.pendingIconBox}>
                <MaterialIcons name="notifications" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.pendingTitle}>
                  {pendingArticles} News Waiting
                </ThemedText>
                <ThemedText style={styles.pendingSubtitle}>
                  Tap here to approve
                </ThemedText>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={20} color="#fff" />
            </Pressable>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              🎨 MAIN ACTIONS - BIG EASY BUTTONS
          ══════════════════════════════════════════════════════════════════ */}
          <ThemedText style={[styles.sectionLabel, { color: '#374151' }]}>PRIMARY ACTIONS</ThemedText>
          
          <View style={styles.bigButtonsGrid}>
            <BigButton
              icon="rate-review"
              label="Approve News"
              desc="Review & publish"
              color="#F59E0B"
              badge={pendingArticles}
              onPress={() => router.push('/tenant/news-approval' as any)}
              c={c}
            />
            <BigButton
              icon="person-add"
              label="Add Reporter"
              desc="Create new member"
              color="#6366F1"
              onPress={() => router.push('/tenant/create-reporter' as any)}
              c={c}
            />
            <BigButton
              icon="edit"
              label="Write News"
              desc="Post article"
              color="#10B981"
              onPress={() => router.push('/post-news' as any)}
              c={c}
            />
            <BigButton
              icon="groups"
              label="My Reporters"
              desc={`${reporters.total} reporters`}
              color="#8B5CF6"
              onPress={() => router.push('/tenant/reporters' as any)}
              c={c}
            />
            <BigButton
              icon="campaign"
              label="Reporter Wanted"
              desc="Create poster"
              color="#DC2626"
              onPress={() => setShowReporterPoster(true)}
              c={c}
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════════
              � MANAGEMENT OPTIONS
          ══════════════════════════════════════════════════════════════════ */}
          <ThemedText style={[styles.sectionLabel, { color: '#374151' }]}>Management</ThemedText>
          
          <View style={[styles.optionsList, { backgroundColor: c.card, borderColor: c.border }]}>
            <SimpleOption
              icon="verified-user"
              label="KYC Verification"
              badge={pendingKyc}
              badgeColor="#EF4444"
              onPress={() => (router.push as any)({ pathname: '/tenant/reporters', params: { kycFilter: 'PENDING' } })}
              c={c}
            />
            <View style={[styles.optionDivider, { backgroundColor: c.border }]} />
            <SimpleOption
              icon="badge"
              label="ID Cards"
              subtitle={`${idCards.issued} issued`}
              onPress={() => router.push('/tenant/reporters' as any)}
              c={c}
            />
            <View style={[styles.optionDivider, { backgroundColor: c.border }]} />
            <SimpleOption
              icon="check-circle"
              label="Published Articles"
              subtitle={`${articles.web.byStatus.PUBLISHED || 0} total`}
              onPress={() => (router.push as any)({ pathname: '/tenant/news-approval', params: { status: 'PUBLISHED' } })}
              c={c}
            />
            <View style={[styles.optionDivider, { backgroundColor: c.border }]} />
            <SimpleOption
              icon="account-balance-wallet"
              label="Payments"
              subtitle={formatMoney(payments.revenue30d)}
              onPress={() => {}}
              c={c}
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════════
              � ANALYTICS OVERVIEW
          ══════════════════════════════════════════════════════════════════ */}
          <ThemedText style={[styles.sectionLabel, { color: '#374151' }]}>Analytics</ThemedText>
          
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: '#ECFDF5', borderLeftColor: '#10B981' }]}>
              <MaterialIcons name="calendar-today" size={20} color="#10B981" />
              <View style={styles.analyticsCardContent}>
                <ThemedText style={[styles.analyticsCardNum, { color: '#059669' }]}>+{articles.web.published7d}</ThemedText>
                <ThemedText style={[styles.analyticsCardLabel, { color: '#047857' }]}>This Week</ThemedText>
              </View>
            </View>
            
            <View style={[styles.analyticsCard, { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' }]}>
              <MaterialIcons name="date-range" size={20} color="#3B82F6" />
              <View style={styles.analyticsCardContent}>
                <ThemedText style={[styles.analyticsCardNum, { color: '#2563EB' }]}>+{articles.web.published30d}</ThemedText>
                <ThemedText style={[styles.analyticsCardLabel, { color: '#1E40AF' }]}>This Month</ThemedText>
              </View>
            </View>
            
            <View style={[styles.analyticsCard, { backgroundColor: '#F5F3FF', borderLeftColor: '#8B5CF6' }]}>
              <MaterialIcons name="trending-up" size={20} color="#8B5CF6" />
              <View style={styles.analyticsCardContent}>
                <ThemedText style={[styles.analyticsCardNum, { color: '#7C3AED' }]}>{formatNumber(articles.web.totalViews)}</ThemedText>
                <ThemedText style={[styles.analyticsCardLabel, { color: '#6D28D9' }]}>Total Views</ThemedText>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Reporter Wanted Poster Modal */}
      <ReporterWantedPoster
        visible={showReporterPoster}
        onClose={() => setShowReporterPoster(false)}
        tenantName={tenantName}
        tenantLogo={logoUrl}
        primaryColor={primary}
        secondaryColor={secondary}
      />
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Components  ───────────────────────────── */

function BigButton({
  icon, label, desc, color, badge, onPress, c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  desc: string;
  color: string;
  badge?: number;
  onPress: () => void;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigBtn,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.bigBtnIcon, { backgroundColor: alphaBg(color, 0.12, c.background) }]}>
        <MaterialIcons name={icon} size={28} color={color} />
      </View>
      <ThemedText style={[styles.bigBtnLabel, { color: c.text }]}>{label}</ThemedText>
      <ThemedText style={[styles.bigBtnDesc, { color: c.muted }]}>{desc}</ThemedText>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.bigBtnBadge, { backgroundColor: color }]}>
          <ThemedText style={styles.bigBtnBadgeText}>{badge}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function SimpleOption({
  icon, label, subtitle, badge, badgeColor, onPress, c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: number;
  badgeColor?: string;
  onPress: () => void;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.simpleOpt,
        pressed && { opacity: 0.8 },
      ]}
    >
      <MaterialIcons name={icon} size={22} color={c.muted} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <ThemedText style={[styles.simpleOptLabel, { color: c.text }]}>{label}</ThemedText>
        {subtitle && <ThemedText style={[styles.simpleOptSub, { color: c.muted }]}>{subtitle}</ThemedText>}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.simpleOptBadge, { backgroundColor: badgeColor || '#EF4444' }]}>
          <ThemedText style={styles.simpleOptBadgeText}>{badge}</ThemedText>
        </View>
      )}
      <MaterialIcons name="chevron-right" size={20} color={c.border} />
    </Pressable>
  );
}

function DashboardSkeleton({ topInset, c }: { scheme: 'light' | 'dark'; topInset: number; c: typeof Colors.light }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: '#fff' }]}>
        <View style={styles.topBar}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={120} height={18} borderRadius={9} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
        <View style={styles.brandLogoSection}>
          <Skeleton width={100} height={100} borderRadius={24} />
          <Skeleton width={180} height={24} borderRadius={12} style={{ marginTop: 14 }} />
          <Skeleton width={100} height={28} borderRadius={14} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.highlightCards}>
          <Skeleton width={'48%' as any} height={90} borderRadius={16} />
          <Skeleton width={'48%' as any} height={90} borderRadius={16} />
        </View>
        <Skeleton width={'100%' as any} height={60} borderRadius={14} />
      </View>
      <View style={styles.content}>
        <Skeleton width={100} height={14} borderRadius={7} style={{ marginBottom: 12 }} />
        <View style={styles.bigButtonsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.bigBtn, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton width={56} height={56} borderRadius={16} />
              <Skeleton width={70} height={14} borderRadius={7} style={{ marginTop: 10 }} />
              <Skeleton width={50} height={10} borderRadius={5} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Clean White Header
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtnWhite: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  refreshBtnWhite: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  
  // Brand Logo Section - Centered & Prominent
  brandLogoSection: { alignItems: 'center', marginBottom: 28 },
  logoBgWhite: { width: 110, height: 110, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8, marginBottom: 16 },
  logoImageLarge: { width: 76, height: 76 },
  logoFallback: { width: 102, height: 102, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  logoTextLarge: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  brandNameLarge: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  verifiedBadgeWhite: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, shadowColor: '#22C55E', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  verifiedTextGreen: { color: '#22C55E', fontSize: 13, fontWeight: '700' },
  
  // Highlight Cards - Top Article & Top Reporter
  highlightCards: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  highlightCard: { flex: 1, padding: 16, borderRadius: 18, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },
  highlightIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  highlightLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' },
  highlightValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  highlightSub: { fontSize: 12, marginTop: 5, fontWeight: '500' },
  
  // Quick Stats Row
  quickStatsRow: { flexDirection: 'row', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  quickStat: { flex: 1, alignItems: 'center' },
  quickStatNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  quickStatLabel: { fontSize: 11, fontWeight: '600', marginTop: 3, letterSpacing: 0.3 },
  quickStatDivider: { width: 1, height: 32, alignSelf: 'center' },

  // Content
  content: { paddingHorizontal: 18, paddingTop: 24 },

  // Section Label
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, marginTop: 12, color: '#6B7280' },

  // Pending Banner
  pendingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B', borderRadius: 20, padding: 20, marginBottom: 24, gap: 14, shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6 },
  pendingIconBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  pendingSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 3, fontWeight: '600' },

  // Big Buttons Grid
  bigButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  bigBtn: { width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, position: 'relative', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },
  bigBtnIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  bigBtnLabel: { fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  bigBtnDesc: { fontSize: 12, marginTop: 5, textAlign: 'center', fontWeight: '500' },
  bigBtnBadge: { position: 'absolute', top: 12, right: 12, minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
  bigBtnBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Options List
  optionsList: { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  simpleOpt: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  simpleOptLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  simpleOptSub: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  simpleOptBadge: { minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, marginRight: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 2 },
  simpleOptBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  optionDivider: { height: 1, marginLeft: 60 },

  // Stats Cards
  statsCards: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  statBoxNum: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statBoxLabel: { fontSize: 11, marginTop: 5, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },

  // Analytics Grid
  analyticsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  analyticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  analyticsCardContent: {
    flex: 1,
  },
  analyticsCardNum: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  analyticsCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Error
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
});

