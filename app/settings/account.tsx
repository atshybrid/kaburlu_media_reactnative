import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { LANGUAGES } from '@/constants/languages';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getUserPreferences, pickPreferenceLanguage, pickPreferenceLocation } from '@/services/api';
import { loadTokens, softLogout } from '@/services/auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    UIManager,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  const isFabric = (global as any)?.nativeFabricUIManager != null;
  if (!isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

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

function initials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return letters || 'U';
}

type SettingItem = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  route?: string;
  onPress?: () => void;
  badge?: string;
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function AccountScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [roleReporter, setRoleReporter] = useState(false);
  const [roleTenantAdmin, setRoleTenantAdmin] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);

  // User info
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [langName, setLangName] = useState('');
  const [location, setLocation] = useState('');

  const primary = c.tint;

  const fetchPrefs = useCallback(async () => {
    try {
      const t = await loadTokens();
      setLoggedIn(Boolean(t?.jwt));
      setUserName(t?.user?.fullName || t?.user?.name || '');
      setUserRole(t?.user?.role || '');

      // Photo
      try {
        const saved = await AsyncStorage.getItem('profile_photo_url');
        if (saved) setPhotoUrl(saved);
        else if ((t?.user as any)?.profilePhotoUrl) setPhotoUrl((t?.user as any).profilePhotoUrl);
      } catch {}

      // Role-based access
      const role = String(t?.user?.role || '').toUpperCase();
      const isReporter = role === 'CITIZEN_REPORTER' || role === 'TENANT_REPORTER' || role === 'REPORTER';
      const isAdmin = role === 'TENANT_ADMIN';
      setRoleReporter(isReporter);
      setRoleTenantAdmin(isAdmin);

      // Developer mode
      try {
        const raw = String(process.env.EXPO_PUBLIC_DEVELOPER_MODE ?? '').toLowerCase();
        const envOn = raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
        const stored = (await AsyncStorage.getItem('developer_mode')) === '1';
        setDeveloperMode(envOn || stored);
      } catch {}

      // Language & Location from prefs
      const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
      const pl = pickPreferenceLanguage(prefs);
      const loc = pickPreferenceLocation(prefs);

      // Language
      let storedLangObj: any = null;
      try {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) {
          try { storedLangObj = JSON.parse(raw); }
          catch { storedLangObj = raw; }
        }
      } catch {}

      const hasStoredLang = !!(
        storedLangObj &&
        ((typeof storedLangObj === 'object' && (storedLangObj.code || storedLangObj.id)) ||
          (typeof storedLangObj === 'string' && storedLangObj.trim().length > 0))
      );

      if (hasStoredLang) {
        const j = storedLangObj;
        if (j?.name) setLangName(j.name);
        else if (j?.code) {
          const found = LANGUAGES.find((l) => l.code === j.code);
          if (found) setLangName(found.name);
        } else if (typeof j === 'string') {
          const found = LANGUAGES.find((l) => l.code === j);
          if (found) setLangName(found.name);
        }
      } else if (pl) {
        setLangName(pl.name);
        try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(pl)); } catch {}
      }

      // Location
      if (loc) {
        setLocation(loc);
        try { await AsyncStorage.setItem('profile_location', loc); } catch {}
      } else {
        const obj = await AsyncStorage.getItem('profile_location_obj');
        if (obj) {
          try {
            const parsed = JSON.parse(obj);
            setLocation(parsed?.name || parsed?.placeName || '');
          } catch {}
        }
        if (!loc) {
          const l = await AsyncStorage.getItem('profile_location');
          setLocation(l || '');
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  useFocusEffect(useCallback(() => {
    fetchPrefs();
    return () => {};
  }, [fetchPrefs]));

  const toggleDeveloperMode = async () => {
    const next = !developerMode;
    setDeveloperMode(next);
    try { await AsyncStorage.setItem('developer_mode', next ? '1' : '0'); } catch {}
    Alert.alert('Developer Mode', next ? 'Enabled' : 'Disabled');
  };

  const onLogout = useCallback(async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          // Get mobile before clearing tokens
          const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
          
          // Soft logout but keep language, location, and push notification preferences
          const keysToKeep = ['selectedLanguage', 'profile_location', 'profile_location_obj', 'push_notifications_enabled'];
          await softLogout(keysToKeep, mobile || undefined);
          
          // Refresh to show guest state
          await fetchPrefs();
        },
      },
    ]);
  }, [fetchPrefs]);

  const roleLabel = (() => {
    const r = String(userRole || '').toUpperCase();
    if (r === 'SUPER_ADMIN') return 'Super Admin';
    if (r === 'TENANT_ADMIN') return 'Tenant Admin';
    if (r === 'TENANT_REPORTER' || r === 'REPORTER') return 'Reporter';
    if (r === 'USER') return 'Reader';
    return r || 'Guest';
  })();

  /* ── Settings Items ── */
  const preferencesItems: SettingItem[] = [
    {
      key: 'language',
      icon: 'language',
      title: 'Language',
      subtitle: langName || 'Select your app language',
      color: '#6366f1',
      route: '/language',
    },
    {
      key: 'location',
      icon: 'location-on',
      title: 'Location',
      subtitle: location || 'Choose your area',
      color: '#10b981',
      route: '/settings/location',
    },
    {
      key: 'appearance',
      icon: 'palette',
      title: 'Appearance',
      subtitle: 'Theme, font size, reading mode',
      color: '#8b5cf6',
      route: '/settings/appearance',
    },
  ];

  const privacyItems: SettingItem[] = [
    {
      key: 'privacy',
      icon: 'shield',
      title: 'Privacy & Security',
      subtitle: 'Privacy policy, terms, permissions',
      color: '#ef4444',
      route: '/settings/privacy',
    },
    {
      key: 'applock',
      icon: 'lock',
      title: 'App Lock',
      subtitle: 'Secure your app with PIN or biometrics',
      color: '#f59e0b',
      route: '/settings/app-lock',
    },
  ];

  const dataItems: SettingItem[] = [
    {
      key: 'storage',
      icon: 'storage',
      title: 'Downloads & Storage',
      subtitle: 'Offline, saved items, cache',
      color: '#0ea5e9',
      route: '/settings/storage',
    },
    {
      key: 'permissions',
      icon: 'admin-panel-settings',
      title: 'Permissions',
      subtitle: 'Camera, location, notifications',
      color: '#ec4899',
      route: '/settings/permissions',
    },
  ];

  const supportItems: SettingItem[] = [
    {
      key: 'support',
      icon: 'help-outline',
      title: 'Support & Feedback',
      subtitle: 'Contact us, report an issue',
      color: '#14b8a6',
      route: '/settings/support',
    },
    {
      key: 'about',
      icon: 'info-outline',
      title: 'About',
      subtitle: 'Version and app info',
      color: '#64748b',
      route: '/settings/about',
    },
  ];

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <AccountSkeleton scheme={scheme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero Profile Card ── */}
        <LinearGradient
          colors={[primary, alphaBg(primary, 0.85, primary)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable
            onLongPress={toggleDeveloperMode}
            delayLongPress={600}
            style={styles.heroContent}
          >
            <Pressable
              onPress={() => loggedIn ? router.push('/settings/profile') : router.push('/auth/login')}
              style={styles.avatarContainer}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: '#fff' }]}>
                  <ThemedText type="title" style={{ color: primary, fontSize: 28 }}>
                    {initials(userName)}
                  </ThemedText>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <MaterialIcons name="edit" size={12} color="#fff" />
              </View>
            </Pressable>

            <ThemedText type="title" style={styles.heroName} numberOfLines={1}>
              {loggedIn ? userName || 'User' : 'Guest'}
            </ThemedText>
            <ThemedText style={styles.heroRole}>
              {roleLabel}{developerMode ? ' · Dev' : ''}
            </ThemedText>

            {!loggedIn && (
              <Pressable
                onPress={() => router.push('/auth/login')}
                style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.9 }]}
              >
                <MaterialIcons name="login" size={18} color={primary} />
                <ThemedText style={{ color: primary, fontWeight: '600' }}>Sign In</ThemedText>
              </Pressable>
            )}
          </Pressable>

          {/* Quick action buttons */}
          {loggedIn && (
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.push('/settings/profile')}
                style={({ pressed }) => [styles.heroActionBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="person" size={20} color="#fff" />
                <ThemedText style={styles.heroActionText}>Profile</ThemedText>
              </Pressable>
              <View style={styles.heroActionDivider} />
              <Pressable
                onPress={onLogout}
                style={({ pressed }) => [styles.heroActionBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="logout" size={20} color="#fff" />
                <ThemedText style={styles.heroActionText}>Logout</ThemedText>
              </Pressable>
            </View>
          )}
        </LinearGradient>

        {/* ── Content ── */}
        <View style={styles.content}>
          {/* Preferences */}
          <SectionHeader title="Preferences" c={c} />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {preferencesItems.map((item, idx) => (
              <SettingRow
                key={item.key}
                item={item}
                isLast={idx === preferencesItems.length - 1}
                c={c}
              />
            ))}
          </View>

          {/* Privacy & Security */}
          <SectionHeader title="Privacy & Security" c={c} />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {privacyItems.map((item, idx) => (
              <SettingRow
                key={item.key}
                item={item}
                isLast={idx === privacyItems.length - 1}
                c={c}
              />
            ))}
          </View>

          {/* Data & Storage */}
          <SectionHeader title="Data & Storage" c={c} />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {dataItems.map((item, idx) => (
              <SettingRow
                key={item.key}
                item={item}
                isLast={idx === dataItems.length - 1}
                c={c}
              />
            ))}
          </View>

          {/* Support */}
          <SectionHeader title="Support" c={c} />
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {supportItems.map((item, idx) => (
              <SettingRow
                key={item.key}
                item={item}
                isLast={idx === supportItems.length - 1}
                c={c}
              />
            ))}
          </View>

          {/* Tenant Admin Dashboard (if applicable) */}
          {roleTenantAdmin && (
            <>
              <SectionHeader title="Administration" c={c} />
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <SettingRow
                  item={{
                    key: 'tenantAdmin',
                    icon: 'admin-panel-settings',
                    title: 'Admin Dashboard',
                    subtitle: 'Manage reporters, articles & tenant settings',
                    color: '#6366f1',
                    route: '/tenant/dashboard',
                  }}
                  isLast
                  c={c}
                />
              </View>
            </>
          )}

          {/* Reporter Dashboard (if applicable) */}
          {roleReporter && (
            <>
              <SectionHeader title="Reporter" c={c} />
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <SettingRow
                  item={{
                    key: 'reporter',
                    icon: 'badge',
                    title: 'Reporter Dashboard',
                    subtitle: 'Manage your reporter profile & articles',
                    color: '#f59e0b',
                    route: '/reporter/dashboard',
                  }}
                  isLast
                  c={c}
                />
              </View>
            </>
          )}

          {/* Developer Tools */}
          {developerMode && (
            <>
              <SectionHeader title="Developer" c={c} />
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <SettingRow
                  item={{
                    key: 'debug',
                    icon: 'bug-report',
                    title: 'Debug Tools',
                    subtitle: 'Reset app storage, tokens, etc.',
                    color: '#ef4444',
                    route: '/settings/account-debug',
                  }}
                  isLast
                  c={c}
                />
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

function SectionHeader({ title, c }: { title: string; c: typeof Colors.light }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
        {title.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function SettingRow({
  item,
  isLast,
  c,
}: {
  item: SettingItem;
  isLast: boolean;
  c: typeof Colors.light;
}) {
  const onPress = () => {
    if (item.onPress) item.onPress();
    else if (item.route) router.push(item.route as any);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: c.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: alphaBg(item.color, 0.12, c.background) }]}>
        <MaterialIcons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>{item.title}</ThemedText>
        <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {item.subtitle}
        </ThemedText>
      </View>
      {item.badge && (
        <View style={[styles.badge, { backgroundColor: alphaBg(item.color, 0.15, c.background) }]}>
          <ThemedText style={{ color: item.color, fontSize: 11, fontWeight: '600' }}>{item.badge}</ThemedText>
        </View>
      )}
      <MaterialIcons name="chevron-right" size={22} color={c.muted} />
    </Pressable>
  );
}

function AccountSkeleton({ scheme }: { scheme: 'light' | 'dark' }) {
  const c = Colors[scheme];
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[c.muted, alphaBg(c.muted, 0.7, c.muted)]} style={styles.hero}>
        <View style={styles.heroContent}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <View style={{ marginTop: 12 }}>
            <Skeleton width={140} height={22} borderRadius={11} />
          </View>
          <View style={{ marginTop: 6 }}>
            <Skeleton width={80} height={14} borderRadius={7} />
          </View>
        </View>
      </LinearGradient>
      <View style={styles.content}>
        <Skeleton width={100} height={12} borderRadius={6} style={{ marginBottom: 10 }} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.settingRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width={120} height={16} borderRadius={8} />
                <Skeleton width={180} height={12} borderRadius={6} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
        <Skeleton width={140} height={12} borderRadius={6} style={{ marginTop: 16, marginBottom: 10 }} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.settingRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width={100} height={16} borderRadius={8} />
                <Skeleton width={160} height={12} borderRadius={6} style={{ marginTop: 4 }} />
              </View>
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

  /* Hero */
  hero: {
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: { alignItems: 'center' },
  avatarContainer: { position: 'relative' },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 12 },
  heroRole: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  heroActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  heroActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  heroActionDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.3)' },

  /* Content */
  content: { padding: 16 },

  /* Section */
  sectionHeader: { marginTop: 16, marginBottom: 8, paddingHorizontal: 4 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  /* Setting Row */
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingContent: { flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 4 },
});
