import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { loadTokens } from '@/services/auth';
import {
    getTenantAdminDashboard,
    type QuickAction,
    type RecentActivityItem,
    type TenantAdminFullResponse,
} from '@/services/tenantAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMoney(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined || !Number.isFinite(minorUnits)) return '—';
  const major = Math.round(minorUnits / 100);
  if (major >= 100000) return `₹${(major / 100000).toFixed(1)}L`;
  if (major >= 1000) return `₹${(major / 1000).toFixed(1)}K`;
  return `₹${major.toLocaleString()}`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function initials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return letters || 'T';
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

const ACTION_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  review_kyc: 'verified-user',
  review_articles: 'rate-review',
  renew_id_cards: 'badge',
  collect_payments: 'payments',
  add_reporter: 'person-add',
  create_article: 'edit-note',
};

const ACTIVITY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  article: 'article',
  payment: 'payments',
  kyc: 'verified-user',
};

const ACTIVITY_COLORS: Record<string, string> = {
  article: '#6366f1',
  payment: '#10b981',
  kyc: '#f59e0b',
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function TenantDashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TenantAdminFullResponse | null>(null);

  // Fallback branding from session
  const [sessionBrand, setSessionBrand] = useState<{ primary?: string; logo?: string; name?: string }>({});

  const primary = data?.branding?.primaryColor || sessionBrand.primary || c.tint;
  const logoUrl = data?.branding?.logoUrl || sessionBrand.logo;
  const tenantName = data?.tenant?.name || sessionBrand.name || 'Dashboard';

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Load session for fallback branding
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

      // Fetch full dashboard
      const dashboard = await getTenantAdminDashboard();
      setData(dashboard);
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

  const onRefresh = useCallback(() => void loadData(true), [loadData]);

  // Filter quick actions by priority
  const quickActionsHigh = useMemo(() => (data?.quickActions || []).filter((a) => a.priority === 'high'), [data]);
  const quickActionsMedLow = useMemo(() => (data?.quickActions || []).filter((a) => a.priority !== 'high'), [data]);

  const roleLabel = useMemo(() => {
    const code = data?.profile?.designation?.code || '';
    if (code === 'TENANT_ADMIN') return 'Tenant Admin';
    if (code === 'SUPER_ADMIN') return 'Super Admin';
    if (code === 'REPORTER') return 'Reporter';
    return data?.profile?.designation?.name || 'Admin';
  }, [data]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <DashboardSkeleton scheme={scheme} onBack={() => router.back()} />
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

  const { reporters, articles, payments, idCards, billing, aiUsage, recentActivity } = data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={[primary, alphaBg(primary, 0.85, primary)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.heroLogo}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain" />
              ) : (
                <ThemedText type="title" style={{ color: primary, fontSize: 24 }}>
                  {initials(tenantName)}
                </ThemedText>
              )}
            </View>
            <ThemedText type="title" style={styles.heroTitle} numberOfLines={1}>
              {tenantName}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>{roleLabel}</ThemedText>

            {data.tenant?.prgiNumber && (
              <View style={styles.heroBadge}>
                <MaterialIcons name="verified" size={12} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.heroBadgeText}>{data.tenant.prgiNumber}</ThemedText>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Stats Overview Row ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="people"
            label="Reporters"
            value={formatNumber(reporters.active)}
            subValue={`${reporters.total} total`}
            color="#6366f1"
            onPress={() => router.push('/tenant/reporters' as any)}
            c={c}
          />
          <StatCard
            icon="article"
            label="Published"
            value={formatNumber(articles.web.byStatus.PUBLISHED || 0)}
            subValue={`+${articles.web.published7d} this week`}
            color="#10b981"
            c={c}
          />
          <StatCard
            icon="visibility"
            label="Views"
            value={formatNumber(articles.web.totalViews)}
            subValue="All time"
            color="#f59e0b"
            c={c}
          />
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>
          {/* ── Priority Actions ── */}
          {quickActionsHigh.length > 0 && (
            <>
              <SectionHeader icon="priority-high" title="Needs Attention" c={c} />
              <View style={styles.alertsGrid}>
                {quickActionsHigh.map((action) => (
                  <ActionCard key={action.key} action={action} primary={primary} c={c} router={router} />
                ))}
              </View>
            </>
          )}

          {/* ── Quick Actions ── */}
          <SectionHeader icon="flash-on" title="Quick Actions" c={c} />
          <View style={styles.quickActionsRow}>
            <QuickActionButton
              icon="edit-note"
              label="Post News"
              onPress={() => router.push('/post-news' as any)}
              primary={primary}
              c={c}
            />
            <QuickActionButton
              icon="person-add"
              label="Add Reporter"
              onPress={() => router.push('/tenant/create-reporter' as any)}
              primary={primary}
              c={c}
            />
            <QuickActionButton
              icon="people"
              label="Reporters"
              onPress={() => router.push('/tenant/reporters' as any)}
              primary={primary}
              c={c}
            />
          </View>

          {/* ── More Actions ── */}
          {quickActionsMedLow.length > 0 && (
            <View style={styles.moreActionsGrid}>
              {quickActionsMedLow.slice(0, 4).map((action) => (
                <MoreActionItem key={action.key} action={action} c={c} router={router} />
              ))}
            </View>
          )}

          {/* ── Reporters Summary ── */}
          <SectionHeader
            icon="people"
            title="Reporters"
            actionLabel="View All"
            onAction={() => router.push('/tenant/reporters' as any)}
            c={c}
          />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.reporterStatsRow}>
              <View style={styles.reporterStat}>
                <ThemedText type="defaultSemiBold" style={{ color: '#10b981', fontSize: 20 }}>
                  {reporters.active}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 11 }}>Active</ThemedText>
              </View>
              <View style={[styles.dividerV, { backgroundColor: c.border }]} />
              <View style={styles.reporterStat}>
                <ThemedText type="defaultSemiBold" style={{ color: '#6366f1', fontSize: 20 }}>
                  {reporters.kyc.approved}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 11 }}>Verified</ThemedText>
              </View>
              <View style={[styles.dividerV, { backgroundColor: c.border }]} />
              <View style={styles.reporterStat}>
                <ThemedText type="defaultSemiBold" style={{ color: '#f59e0b', fontSize: 20 }}>
                  {reporters.kyc.pending + reporters.kyc.submitted}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 11 }}>Pending KYC</ThemedText>
              </View>
              <View style={[styles.dividerV, { backgroundColor: c.border }]} />
              <View style={styles.reporterStat}>
                <ThemedText type="defaultSemiBold" style={{ color: c.muted, fontSize: 20 }}>
                  {reporters.inactive}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 11 }}>Inactive</ThemedText>
              </View>
            </View>

            {/* Level breakdown */}
            <View style={[styles.levelRow, { borderTopColor: c.border }]}>
              {Object.entries(reporters.byLevel).map(([level, count]) => (
                <LevelPill key={level} level={level} count={count || 0} c={c} />
              ))}
            </View>
          </View>

          {/* ── Articles Summary ── */}
          <SectionHeader icon="article" title="Articles" c={c} />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.articleStatsGrid}>
              <ArticleStatTile
                icon="drafts"
                label="Drafts"
                value={articles.web.byStatus.DRAFT || 0}
                color="#8b5cf6"
                c={c}
              />
              <ArticleStatTile
                icon="pending"
                label="Pending"
                value={articles.web.byStatus.PENDING || 0}
                color="#f59e0b"
                c={c}
              />
              <ArticleStatTile
                icon="check-circle"
                label="Published"
                value={articles.web.byStatus.PUBLISHED || 0}
                color="#10b981"
                c={c}
              />
              <ArticleStatTile
                icon="cancel"
                label="Rejected"
                value={articles.web.byStatus.REJECTED || 0}
                color="#ef4444"
                c={c}
              />
            </View>

            <View style={[styles.articleMetaRow, { borderTopColor: c.border }]}>
              <View style={styles.articleMeta}>
                <MaterialIcons name="newspaper" size={16} color={c.muted} />
                <ThemedText style={{ color: c.text, fontSize: 13 }}>
                  {articles.newspaper.byStatus.PUBLISHED || 0} Newspaper
                </ThemedText>
              </View>
              <View style={styles.articleMeta}>
                <MaterialIcons name="rate-review" size={16} color={c.muted} />
                <ThemedText style={{ color: c.text, fontSize: 13 }}>
                  {articles.raw.pendingReview} Awaiting Review
                </ThemedText>
              </View>
            </View>
          </View>

          {/* ── Payments & ID Cards Row ── */}
          <View style={styles.twoColRow}>
            {/* Payments */}
            <View style={[styles.smallCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.smallCardHeader}>
                <View style={[styles.smallCardIcon, { backgroundColor: alphaBg('#10b981', 0.12, c.background) }]}>
                  <MaterialIcons name="payments" size={18} color="#10b981" />
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 13 }}>Payments</ThemedText>
              </View>
              <ThemedText type="title" style={{ color: '#10b981', fontSize: 22, marginTop: 8 }}>
                {formatMoney(payments.revenue30d)}
              </ThemedText>
              <ThemedText style={{ color: c.muted, fontSize: 11 }}>Last 30 days</ThemedText>
              <View style={styles.smallCardMeta}>
                <View style={[styles.metaPill, { backgroundColor: alphaBg('#f59e0b', 0.1, c.background) }]}>
                  <ThemedText style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                    {payments.pending} pending
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* ID Cards */}
            <View style={[styles.smallCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.smallCardHeader}>
                <View style={[styles.smallCardIcon, { backgroundColor: alphaBg('#6366f1', 0.12, c.background) }]}>
                  <MaterialIcons name="badge" size={18} color="#6366f1" />
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 13 }}>ID Cards</ThemedText>
              </View>
              <ThemedText type="title" style={{ color: '#6366f1', fontSize: 22, marginTop: 8 }}>
                {idCards.issued}
              </ThemedText>
              <ThemedText style={{ color: c.muted, fontSize: 11 }}>Total issued</ThemedText>
              <View style={styles.smallCardMeta}>
                {idCards.expiring30d > 0 && (
                  <View style={[styles.metaPill, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
                    <ThemedText style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>
                      {idCards.expiring30d} expiring
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.metaPill, { backgroundColor: alphaBg('#10b981', 0.1, c.background) }]}>
                  <ThemedText style={{ color: '#10b981', fontSize: 11, fontWeight: '600' }}>
                    +{idCards.issuedThisMonth} this month
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* ── Billing & AI Usage ── */}
          <View style={styles.twoColRow}>
            {/* Subscription */}
            <View style={[styles.smallCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.smallCardHeader}>
                <View style={[styles.smallCardIcon, { backgroundColor: alphaBg('#ec4899', 0.12, c.background) }]}>
                  <MaterialIcons name="card-membership" size={18} color="#ec4899" />
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 13 }}>Subscription</ThemedText>
              </View>
              <View style={styles.subscriptionStatus}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: billing.hasActiveSubscription ? '#10b981' : '#ef4444' },
                  ]}
                />
                <ThemedText
                  style={{
                    color: billing.hasActiveSubscription ? '#10b981' : '#ef4444',
                    fontWeight: '600',
                  }}
                >
                  {billing.hasActiveSubscription ? 'Active' : 'Inactive'}
                </ThemedText>
              </View>
              {billing.subscription?.plan && (
                <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                  {billing.subscription.plan.name}
                </ThemedText>
              )}
            </View>

            {/* AI Usage */}
            <View style={[styles.smallCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.smallCardHeader}>
                <View style={[styles.smallCardIcon, { backgroundColor: alphaBg('#8b5cf6', 0.12, c.background) }]}>
                  <MaterialIcons name="auto-awesome" size={18} color="#8b5cf6" />
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 13 }}>AI Usage</ThemedText>
              </View>
              <View style={styles.aiUsageBar}>
                <View
                  style={[
                    styles.aiUsageFill,
                    {
                      backgroundColor: aiUsage.limitReached ? '#ef4444' : '#8b5cf6',
                      width: `${Math.min(100, (aiUsage.tokensThisMonth / aiUsage.limitThisMonth) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                {formatNumber(aiUsage.tokensThisMonth)} / {formatNumber(aiUsage.limitThisMonth)} tokens
              </ThemedText>
            </View>
          </View>

          {/* ── Recent Activity ── */}
          {recentActivity.length > 0 && (
            <>
              <SectionHeader icon="history" title="Recent Activity" c={c} />
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 8 }]}>
                {recentActivity.slice(0, 5).map((item, idx) => (
                  <ActivityItem key={item.id} item={item} isLast={idx === recentActivity.slice(0, 5).length - 1} c={c} />
                ))}
              </View>
            </>
          )}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Sub-Components  ───────────────────────────── */

function SectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  c: typeof Colors.light;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <MaterialIcons name={icon} size={18} color={c.muted} />
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>{title}</ThemedText>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <ThemedText style={{ color: c.tint, fontSize: 13, fontWeight: '600' }}>{actionLabel}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
  onPress,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  subValue: string;
  color: string;
  onPress?: () => void;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && onPress && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.statCardIcon, { backgroundColor: alphaBg(color, 0.12, c.background) }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 20, marginTop: 8 }}>
        {value}
      </ThemedText>
      <ThemedText style={{ color: c.muted, fontSize: 11 }}>{label}</ThemedText>
      <ThemedText style={{ color: c.muted, fontSize: 10, marginTop: 2 }}>{subValue}</ThemedText>
    </Pressable>
  );
}

function ActionCard({
  action,
  primary,
  c,
  router,
}: {
  action: QuickAction;
  primary: string;
  c: typeof Colors.light;
  router: ReturnType<typeof useRouter>;
}) {
  const color = PRIORITY_COLORS[action.priority] || c.tint;
  const icon = ACTION_ICONS[action.key] || 'arrow-forward';

  return (
    <Pressable
      onPress={() => router.push(action.href as any)}
      style={({ pressed }) => [
        styles.alertCard,
        { backgroundColor: alphaBg(color, 0.08, c.card), borderColor: alphaBg(color, 0.2, c.border) },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.alertIcon, { backgroundColor: alphaBg(color, 0.15, c.background) }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 13, flex: 1 }} numberOfLines={2}>
        {action.label}
      </ThemedText>
      <MaterialIcons name="chevron-right" size={20} color={c.muted} />
    </Pressable>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
  primary,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  primary: string;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: alphaBg(primary, 0.12, c.background) }]}>
        <MaterialIcons name={icon} size={22} color={primary} />
      </View>
      <ThemedText style={{ color: c.text, fontSize: 12, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function MoreActionItem({
  action,
  c,
  router,
}: {
  action: QuickAction;
  c: typeof Colors.light;
  router: ReturnType<typeof useRouter>;
}) {
  const icon = ACTION_ICONS[action.key] || 'arrow-forward';

  return (
    <Pressable
      onPress={() => router.push(action.href as any)}
      style={({ pressed }) => [
        styles.moreActionItem,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <MaterialIcons name={icon} size={18} color={c.muted} />
      <ThemedText style={{ color: c.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
        {action.label}
      </ThemedText>
      <MaterialIcons name="chevron-right" size={18} color={c.muted} />
    </Pressable>
  );
}

function LevelPill({ level, count, c }: { level: string; count: number; c: typeof Colors.light }) {
  const colors: Record<string, string> = {
    STATE: '#6366f1',
    DISTRICT: '#f59e0b',
    MANDAL: '#10b981',
    ASSEMBLY: '#ec4899',
  };
  const color = colors[level] || c.muted;

  return (
    <View style={[styles.levelPill, { backgroundColor: alphaBg(color, 0.1, c.background) }]}>
      <ThemedText style={{ color, fontSize: 11, fontWeight: '600' }}>
        {count} {level}
      </ThemedText>
    </View>
  );
}

function ArticleStatTile({
  icon,
  label,
  value,
  color,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: number;
  color: string;
  c: typeof Colors.light;
}) {
  return (
    <View style={[styles.articleStatTile, { backgroundColor: alphaBg(color, 0.06, c.background) }]}>
      <MaterialIcons name={icon} size={18} color={color} />
      <ThemedText type="defaultSemiBold" style={{ color: c.text, fontSize: 18 }}>{value}</ThemedText>
      <ThemedText style={{ color: c.muted, fontSize: 10 }}>{label}</ThemedText>
    </View>
  );
}

function ActivityItem({
  item,
  isLast,
  c,
}: {
  item: RecentActivityItem;
  isLast: boolean;
  c: typeof Colors.light;
}) {
  const icon = ACTIVITY_ICONS[item.type] || 'circle';
  const color = ACTIVITY_COLORS[item.type] || c.muted;

  return (
    <View style={[styles.activityItem, !isLast && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
      <View style={[styles.activityIcon, { backgroundColor: alphaBg(color, 0.1, c.background) }]}>
        <MaterialIcons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>
          {item.title || item.type}
        </ThemedText>
        <ThemedText style={{ color: c.muted, fontSize: 11 }}>
          {item.status && <ThemedText style={{ color }}>{item.status} • </ThemedText>}
          {timeAgo(item.at)}
        </ThemedText>
      </View>
      {item.amountMinor !== undefined && (
        <ThemedText style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}>
          {formatMoney(item.amountMinor)}
        </ThemedText>
      )}
    </View>
  );
}

function DashboardSkeleton({ scheme, onBack }: { scheme: 'light' | 'dark'; onBack: () => void }) {
  const c = Colors[scheme];
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[c.muted, alphaBg(c.muted, 0.7, c.muted)]} style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.heroContent}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <View style={{ marginTop: 12 }}>
            <Skeleton width={180} height={22} borderRadius={11} />
          </View>
          <View style={{ marginTop: 6 }}>
            <Skeleton width={100} height={14} borderRadius={7} />
          </View>
        </View>
      </LinearGradient>
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton width={50} height={20} borderRadius={10} style={{ marginTop: 8 }} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <View style={styles.content}>
        <Skeleton width={140} height={18} borderRadius={9} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.quickAction, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton width={44} height={44} borderRadius={12} />
              <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: 12 }]}>
            <Skeleton width="100%" height={60} borderRadius={12} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Hero */
  hero: {
    paddingTop: 52,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: { alignItems: 'center', marginTop: 8 },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImg: { width: 48, height: 48 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 10 },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  /* Stats Row */
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: -24, gap: 10 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Content */
  content: { padding: 16, gap: 0 },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /* Alerts */
  alertsGrid: { gap: 8, marginBottom: 8 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Quick Actions */
  quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },

  /* More Actions */
  moreActionsGrid: { gap: 6, marginBottom: 8 },
  moreActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  /* Cards */
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },

  /* Reporter Stats */
  reporterStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  reporterStat: { alignItems: 'center', flex: 1 },
  dividerV: { width: 1, height: 32, marginHorizontal: 4 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },

  /* Article Stats */
  articleStatsGrid: { flexDirection: 'row', gap: 8 },
  articleStatTile: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, gap: 4 },
  articleMetaRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /* Two Col */
  twoColRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12 },
  smallCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallCardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  subscriptionStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  aiUsageBar: { height: 6, backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  aiUsageFill: { height: '100%', borderRadius: 3 },

  /* Activity */
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Error */
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
});
