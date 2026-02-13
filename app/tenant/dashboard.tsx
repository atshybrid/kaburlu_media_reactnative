/**
 * Tenant Admin Dashboard - Clean, Simple, Beginner-Friendly
 * 
 * Features:
 * ✅ Simple & Easy to Understand
 * ✅ Clean Card-Based Design  
 * ✅ Big, Clear Buttons
 * ✅ Minimal, Classic UI
 */

import { ThemedText } from '@/components/ThemedText';
import ReporterWantedPoster from '@/components/tenant/ReporterWantedPoster';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
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
import { useCallback, useState } from 'react';
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
    useColorScheme as useRNColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─────────────────────────────────────────────────────────────
   Helper Functions
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   Main Dashboard Component
───────────────────────────────────────────────────────────── */

export default function TenantDashboardScreen() {
  const scheme = useRNColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReporterPoster, setShowReporterPoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TenantAdminFullResponse | null>(null);
  const [sessionBrand, setSessionBrand] = useState<{ primary?: string; logo?: string; name?: string }>({});
  const [actualPendingCount, setActualPendingCount] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const primary = data?.branding?.primaryColor || sessionBrand.primary || c.tint;
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
      
      try {
        const pendingRes = await getNewspaperArticles({ status: 'PENDING', limit: 1 });
        setActualPendingCount(pendingRes.total || 0);
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

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/news');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  const handleLogout = async () => {
    if (loggingOut) return;
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              await softLogout();
              // Redirect to news feed as guest
              router.replace('/news');
            } catch (e: any) {
              console.error('[Dashboard] Logout error:', e);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    void loadData(true);
  }, [loadData]);

  const pendingArticles = actualPendingCount ?? data?.articles?.web?.byStatus?.PENDING ?? 0;
  const pendingKyc = data?.reporters?.kycByStatus?.PENDING ?? 0;

  if (loading && !data) {
    return <DashboardSkeleton topInset={insets.top} c={c} />;
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorCenter}>
          <View style={[styles.errorIcon, { backgroundColor: '#FEE2E2' }]}>
            <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          </View>
          <ThemedText style={{ fontSize: 18, fontWeight: '700', marginTop: 16, color: c.text }}>
            {error || 'Failed to load'}
          </ThemedText>
          <Pressable
            onPress={() => loadData()}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Try Again</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { reporters, articles, payments, idCards } = data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#F8F9FA' }]} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
      
      <ReporterWantedPoster
        visible={showReporterPoster}
        onClose={() => setShowReporterPoster(false)}
        tenantName={tenantName}
        tenantLogo={logoUrl}
        brandColor={primary}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* ══════════════════════════════════════════════════════════════════
            SIMPLE HEADER - CLEAN & MINIMAL
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.replace('/news')}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </Pressable>
            
            <View style={styles.headerCenter}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.headerLogo} contentFit="contain" />
              ) : (
                <View style={[styles.headerLogoFallback, { backgroundColor: alphaBg(primary, 0.12, '#f3f4f6') }]}>
                  <ThemedText style={[styles.headerLogoText, { color: primary }]}>
                    {initials(tenantName)}
                  </ThemedText>
                </View>
              )}
              <View style={styles.headerInfo}>
                <ThemedText style={styles.headerName} numberOfLines={1}>
                  {tenantName}
                </ThemedText>
                {data.tenant?.prgiNumber && (
                  <View style={styles.headerVerified}>
                    <MaterialIcons name="verified" size={14} color="#10B981" />
                    <ThemedText style={styles.headerVerifiedText}>Verified</ThemedText>
                  </View>
                )}
              </View>
            </View>

            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <MaterialIcons name="logout" size={24} color="#DC2626" />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {/* ══════════════════════════════════════════════════════════════════
              📊 QUICK STATS - AT A GLANCE
          ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.statsCard}>
            <View style={styles.stat}>
              <ThemedText style={[styles.statNumber, { color: '#10B981' }]}>
                {articles.web.published7d}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Published This Week</ThemedText>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.stat}>
              <ThemedText style={[styles.statNumber, { color: '#3B82F6' }]}>
                {reporters.total}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Total Reporters</ThemedText>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.stat}>
              <ThemedText style={[styles.statNumber, pendingArticles > 0 ? { color: '#F59E0B' } : { color: '#6B7280' }]}>
                {pendingArticles}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Pending Review</ThemedText>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════════════════
              ⚠ PENDING ALERT - IF ANY
          ══════════════════════════════════════════════════════════════════ */}
          {pendingArticles > 0 && (
            <Pressable
              onPress={() => router.push('/tenant/news-approval' as any)}
              style={({ pressed }) => [
                styles.alertCard,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.alertIcon}>
                <MaterialIcons name="error-outline" size={28} color="#fff" />
              </View>
              <View style={styles.alertContent}>
                <ThemedText style={styles.alertTitle}>
                  {pendingArticles} Article{pendingArticles > 1 ? 's' : ''} Waiting for Approval
                </ThemedText>
                <ThemedText style={styles.alertSubtitle}>
                  Tap to review and publish
                </ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={28} color="#fff" />
            </Pressable>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              🎯 MAIN ACTIONS - SIMPLE & CLEAR
          ══════════════════════════════════════════════════════════════════ */}
          <ThemedText style={styles.sectionTitle}>Main Actions</ThemedText>
          
          <View style={styles.actionsGrid}>
            <Pressable
              onPress={() => router.push('/tenant/news-approval' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="rate-review" size={32} color="#F59E0B" />
              </View>
              {pendingArticles > 0 && (
                <View style={styles.actionBadge}>
                  <ThemedText style={styles.actionBadgeText}>{pendingArticles}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.actionTitle}>Approve News</ThemedText>
              <ThemedText style={styles.actionSubtitle}>Review & Publish</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/tenant/create-reporter' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#E0E7FF' }]}>
                <MaterialIcons name="person-add" size={32} color="#6366F1" />
              </View>
              <ThemedText style={styles.actionTitle}>Add Reporter</ThemedText>
              <ThemedText style={styles.actionSubtitle}>Create New</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/tenant/reporters' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#F3E8FF' }]}>
                <MaterialIcons name="groups" size={32} color="#8B5CF6" />
              </View>
              <ThemedText style={styles.actionTitle}>My Reporters</ThemedText>
              <ThemedText style={styles.actionSubtitle}>{reporters.total} Members</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/post-news' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#D1FAE5' }]}>
                <MaterialIcons name="edit" size={32} color="#10B981" />
              </View>
              <ThemedText style={styles.actionTitle}>Write News</ThemedText>
              <ThemedText style={styles.actionSubtitle}>Post Article</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/tenant/daily-newspaper' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="newspaper" size={32} color="#F59E0B" />
              </View>
              <ThemedText style={styles.actionTitle}>Daily Newspaper</ThemedText>
              <ThemedText style={styles.actionSubtitle}>Today's Articles</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/tenant/epaper' as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="menu-book" size={32} color="#3B82F6" />
              </View>
              <ThemedText style={styles.actionTitle}>E-Paper</ThemedText>
              <ThemedText style={styles.actionSubtitle}>Digital Edition</ThemedText>
            </Pressable>
          </View>

          {/* ══════════════════════════════════════════════════════════════════
              📋 MORE OPTIONS - LIST VIEW
          ══════════════════════════════════════════════════════════════════ */}
          <ThemedText style={styles.sectionTitle}>More Options</ThemedText>
          
          <View style={styles.optionsCard}>
            <Pressable
              onPress={() => (router.push as any)({ pathname: '/tenant/reporters', params: { kycFilter: 'PENDING' } })}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MaterialIcons name="verified-user" size={20} color="#DC2626" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>KYC Verification</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Review pending requests</ThemedText>
              </View>
              {pendingKyc > 0 && (
                <View style={styles.optionBadge}>
                  <ThemedText style={styles.optionBadgeText}>{pendingKyc}</ThemedText>
                </View>
              )}
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>

            <View style={styles.optionDivider} />

            <Pressable
              onPress={() => router.push('/tenant/reporters' as any)}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="badge" size={20} color="#3B82F6" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>ID Cards</ThemedText>
                <ThemedText style={styles.optionSubtitle}>{idCards.issued} issued</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>

            <View style={styles.optionDivider} />

            <Pressable
              onPress={() => (router.push as any)({ pathname: '/tenant/news-approval', params: { status: 'PUBLISHED' } })}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#D1FAE5' }]}>
                <MaterialIcons name="article" size={20} color="#10B981" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>Published Articles</ThemedText>
                <ThemedText style={styles.optionSubtitle}>{articles.web.byStatus.PUBLISHED || 0} total</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>

            <View style={styles.optionDivider} />

            <Pressable
              onPress={() => router.push('/tenant/epaper' as any)}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="menu-book" size={20} color="#3B82F6" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>E-Paper</ThemedText>
                <ThemedText style={styles.optionSubtitle}>View digital editions</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>

            <View style={styles.optionDivider} />

            <Pressable
              onPress={() => setShowReporterPoster(true)}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FCE7F3' }]}>
                <MaterialIcons name="campaign" size={20} color="#EC4899" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>Reporter Wanted Poster</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Create recruitment post</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>

            <View style={styles.optionDivider} />

            <Pressable
              onPress={() => {}}
              style={({ pressed }) => [
                styles.optionItem,
                pressed && { backgroundColor: '#F9FAFB' },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="account-balance-wallet" size={20} color="#F59E0B" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>Payments & Revenue</ThemedText>
                <ThemedText style={styles.optionSubtitle}>{formatMoney(payments.revenue30d)} this month</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────
   Loading Skeleton
───────────────────────────────────────────────────────────── */

function DashboardSkeleton({ topInset, c }: { topInset: number; c: typeof Colors.light }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topInset + 16 }]}>
          <View style={styles.headerRow}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <Skeleton width={140} height={20} borderRadius={10} />
            </View>
            <Skeleton width={40} height={40} borderRadius={20} />
          </View>
        </View>
        <View style={styles.content}>
          <Skeleton width={'100%' as any} height={90} borderRadius={16} style={{ marginBottom: 20 }} />
          <Skeleton width={100} height={16} borderRadius={8} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={'47%' as any} height={130} borderRadius={16} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { 
    flex: 1 
  },

  /* Header */
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginRight: 14,
    gap: 12,
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoText: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerVerifiedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Content */
  content: {
    padding: 20,
  },

  /* Stats Card */
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },

  /* Alert Card */
  alertCard: {
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  alertIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },

  /* Section Title */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  /* Actions Grid */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 32,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },

  /* Options Card */
  optionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  optionBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginRight: 8,
  },
  optionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 68,
  },

  /* Error State */
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
});
