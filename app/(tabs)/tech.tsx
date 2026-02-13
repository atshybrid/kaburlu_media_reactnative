import BottomSheet from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { LANGUAGES, type Language } from '@/constants/languages';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { afterPreferencesUpdated, getUserPreferences, logout, pickPreferenceLanguage, pickPreferenceLocation, updatePreferences, updateUserProfile, uploadMedia } from '@/services/api';
import { loadTokens, saveTokens, softLogout } from '@/services/auth';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
  return lum < 0.55 ? '#ffffff' : '#0f172a';
}

function withAlpha(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

export default function AccountScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const { setTabBarVisible } = useTabBarVisibility();
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [notify, setNotify] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string>('');
  const [tenantPrimary, setTenantPrimary] = useState<string>('');
  const [tenantSecondary, setTenantSecondary] = useState<string>('');
  const [redirecting, setRedirecting] = useState(true);

  const isTenantAdmin = loggedIn && role === 'TENANT_ADMIN';
  const isReporter = loggedIn && (role === 'REPORTER' || role === 'TENANT_REPORTER' || role === 'CITIZEN_REPORTER');
  const isTenantRole = loggedIn && (role === 'TENANT_ADMIN' || role === 'TENANT_REPORTER' || role === 'REPORTER');
  
  // Guest users have JWT but role is 'Guest' or empty - they should see Sign In button
  const isGuest = !role || role.toUpperCase() === 'GUEST';
  // Proper login means has JWT AND has a real role (not Guest)
  const isProperLogin = loggedIn && !isGuest;

  // Refresh account/profile state from tokens + storage
  const refreshProfile = useCallback(async () => {
    try {
      const t = await loadTokens();
      const hasJwt = !!t?.jwt;
      setLoggedIn(hasJwt);
      if (t?.user) {
        setName(t.user.fullName || t.user.name || '');
        setRole(t.user.role || '');
        if (t.user.profilePhotoUrl) setPhotoUrl(t.user.profilePhotoUrl);
      } else {
        const savedName = await AsyncStorage.getItem('profile_name');
        if (savedName) setName(savedName);
        const savedRole = await AsyncStorage.getItem('profile_role');
        if (savedRole) setRole(savedRole);
        const savedPhoto = await AsyncStorage.getItem('profile_photo_url');
        if (savedPhoto) setPhotoUrl(savedPhoto);
      }

      // Tenant branding/session extras (for TENANT_* roles)
      try {
        const session: any = (t as any)?.session;
        const ds = session?.domainSettings;
        const colors = ds?.data?.theme?.colors;
        const primary = colors?.primary || colors?.accent;
        const secondary = colors?.secondary || colors?.accent;
        const logo = ds?.data?.seo?.ogImageUrl || ds?.data?.branding?.logoUrl;
        const tn = session?.tenant?.name;
        const tid = session?.tenant?.id || session?.tenantId;

        setTenantName(typeof tn === 'string' ? tn : '');
        setTenantId(typeof tid === 'string' ? tid : '');
        setTenantLogoUrl(typeof logo === 'string' ? logo.trim() : '');
        setTenantPrimary(isValidHexColor(primary) ? String(primary) : '');
        setTenantSecondary(isValidHexColor(secondary) ? String(secondary) : '');
      } catch {
        setTenantName('');
        setTenantId('');
        setTenantLogoUrl('');
        setTenantPrimary('');
        setTenantSecondary('');
      }

      // Try server preferences first
      let prefLang: Language | null = null;
      let prefLoc: string | null = null;
      try {
        const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
        prefLang = pickPreferenceLanguage(prefs);
        prefLoc = pickPreferenceLocation(prefs);
      } catch {}
      // IMPORTANT: do not overwrite the locally selected language if it already exists.
      // Some accounts may have stale server preferences (defaulting to English).
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
        (
          (typeof storedLangObj === 'object' && (storedLangObj.code || storedLangObj.id)) ||
          (typeof storedLangObj === 'string' && storedLangObj.trim().length > 0)
        )
      );

      if (hasStoredLang) {
        try {
          if (storedLangObj && typeof storedLangObj === 'object' && storedLangObj.code) {
            setLanguage(storedLangObj as Language);
          } else if (typeof storedLangObj === 'string') {
            setLanguage(LANGUAGES.find(l => l.code === storedLangObj) || LANGUAGES[0]);
          }
        } catch {}
      } else if (prefLang) {
        setLanguage(prefLang);
        try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(prefLang)); } catch {}
      } else {
        const savedLang = await AsyncStorage.getItem('selectedLanguage');
        if (savedLang) {
          try {
            const parsed = JSON.parse(savedLang);
            if (parsed && typeof parsed === 'object' && parsed.code) setLanguage(parsed as Language);
            else if (typeof parsed === 'string') setLanguage(LANGUAGES.find(l => l.code === parsed) || LANGUAGES[0]);
          } catch { setLanguage(LANGUAGES[0]); }
        } else { setLanguage(LANGUAGES[0]); }
      }

      setNotify((await AsyncStorage.getItem('notify')) !== '0');
      setAutoplay((await AsyncStorage.getItem('autoplay')) === '1');

      if (prefLoc) {
        setLocation(prefLoc);
        try { await AsyncStorage.setItem('profile_location', prefLoc); } catch {}
      } else {
        const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
        if (savedLocObj) {
          try { const obj = JSON.parse(savedLocObj); setLocation(obj?.name || ''); } catch {}
        } else {
          const savedLoc = await AsyncStorage.getItem('profile_location');
          if (savedLoc) setLocation(savedLoc);
        }
      }
    } catch (e) {
      try { console.warn('[AccountTab] refreshProfile failed', (e as any)?.message || e); } catch {}
    }
  }, []);

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  useEffect(() => {
    // Initial load sets redirecting to false after checking
    setRedirecting(false);
  }, []);

  // Auto-redirect dashboard users whenever this tab is focused
  useFocusEffect(React.useCallback(() => {
    let active = true;
    (async () => {
      try {
        const t = await loadTokens();
        if (!active || !t?.jwt) return;
        
        const userRole = t?.user?.role || '';
        const normalizedRole = userRole.toUpperCase().trim();
        
        // Tenant Admin -> Tenant Dashboard
        if (normalizedRole === 'TENANT_ADMIN') {
          router.replace('/tenant/dashboard');
          return;
        }
        
        // Reporter -> Reporter Dashboard  
        if (normalizedRole === 'REPORTER' || normalizedRole === 'TENANT_REPORTER') {
          router.replace('/reporter/dashboard');
          return;
        }

        // Public Figure -> Public Figure Dashboard
        if (normalizedRole === 'PUBLIC_FIGURE') {
          router.replace('/public-figure/dashboard');
          return;
        }
        
        // Regular users stay on account page
        refreshProfile();
      } catch {}
    })();
    return () => { active = false; };
  }, [router, refreshProfile]));

  // Android back: go to News instead of blank route
  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => { try { router.replace('/news'); } catch {} return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  // Persist toggles immediately (remove Save button)
  useEffect(() => { AsyncStorage.setItem('notify', notify ? '1' : '0'); }, [notify]);
  useEffect(() => { AsyncStorage.setItem('autoplay', autoplay ? '1' : '0'); }, [autoplay]);
  const persistLanguage = useCallback(async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(lang));
  }, []);

  const gotoLogin = () => router.push('/auth/login');
  const doLogout = async () => {
    try {
      const jwt = await AsyncStorage.getItem('jwt');
      const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
        if (jwt) { try { await logout(); } catch (e:any) { console.warn('[UI] remote logout failed (continuing)', e?.message); } }
  // Keep language, location, and push notification preferences
      const keysToKeep = ['selectedLanguage', 'profile_location', 'profile_location_obj', 'push_notifications_enabled'];
      await softLogout(keysToKeep, mobile || undefined);
      setLoggedIn(false);
      // Redirect to news feed as guest
      router.replace('/news');
    } catch (e) {
      try { console.warn('[UI] logout failed locally', (e as any)?.message); } catch {}
    }
  };

  const changeLocation = () => router.push({ pathname: '/settings/location' as any });
  const languageDisplay = useMemo(() => language?.name ?? 'English', [language]);

  const tenantCardBg = tenantPrimary ? tenantPrimary : card;
  const tenantCardFg = tenantPrimary ? (pickReadableTextColor(tenantPrimary) || text) : text;
  const tenantSubtle = tenantPrimary ? withAlpha(tenantCardFg, 0.86) : muted;
  const tenantBorder = tenantPrimary ? withAlpha(tenantCardFg, 0.18) : border;
  const tenantPillBg = tenantSecondary ? tenantSecondary : (tenantPrimary ? withAlpha(tenantCardFg, 0.14) : card);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!loggedIn) { router.push('/auth/login'); return; }
    try {
      setUploadingPhoto(true);
      const perm = await requestMediaPermissionsOnly();
      if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
        setUploadingPhoto(false);
        Alert.alert('Permission needed', 'Please allow photo library access to update your profile picture.');
        return;
      }
      const mediaType = (ImagePicker as any).MediaType?.Images ?? 'images';
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled) { setUploadingPhoto(false); return; }
      const asset = res.assets?.[0];
      if (!asset?.uri) { setUploadingPhoto(false); return; }
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: asset.fileName || 'avatar.jpg', folder: 'avatars' });
      const url = uploaded.url;
      await updateUserProfile({ profilePhotoUrl: url });
      setPhotoUrl(url);
      try { await AsyncStorage.setItem('profile_photo_url', url); } catch {}
      // Update cached tokens.user so all screens reflect immediately
      try {
        const t = await loadTokens();
        if (t?.user) { await saveTokens({ ...t, user: { ...t.user, profilePhotoUrl: url } } as any); }
      } catch {}
      Alert.alert('Profile updated', 'Your profile photo has been updated.');
    } catch (e: any) {
      const msg = e?.message || 'Failed to update profile photo';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingPhoto(false);
    }
  }, [loggedIn, router]);

  // Show minimal loading state while checking redirect
  if (redirecting) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {/* Fixed app bar (does not scroll) */}
      <View style={[styles.appBar, { backgroundColor: bg, borderColor: border }]}>
        <Pressable onPress={() => router.replace('/news')} style={styles.backRow} accessibilityLabel="Back to News">
          <Feather name="arrow-left" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
        </Pressable>
        <Text style={[styles.appBarTitle, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>Account</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Redesigned Profile Header Card */}
        <View style={[styles.profileCard, { backgroundColor: card, borderColor: border }]}>
          <Pressable 
            onPress={pickAndUploadAvatar} 
            disabled={!isProperLogin || uploadingPhoto} 
            accessibilityLabel="Change profile photo"
            style={styles.avatarSection}
          >
            <View style={[styles.avatarContainer, { borderColor: scheme === 'dark' ? '#334155' : '#e2e8f0' }]}>
              {photoUrl && isProperLogin ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: scheme === 'dark' ? '#1e293b' : '#f1f5f9' }]}>
                  <MaterialIcons 
                    name={isProperLogin ? 'person' : 'person-outline'} 
                    size={40} 
                    color={scheme === 'dark' ? '#64748b' : '#94a3b8'} 
                  />
                </View>
              )}
              {uploadingPhoto && (
                <View style={[styles.avatarOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              {isProperLogin && (
                <View style={[styles.editBadge, { backgroundColor: Colors.light.primary }]}>
                  <MaterialIcons name="photo-camera" size={14} color="#fff" />
                </View>
              )}
            </View>
          </Pressable>
          
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: text }]} numberOfLines={1}>
              {isProperLogin ? (name || 'User') : 'రీడర్'}
            </Text>
            <Text style={[styles.userRole, { color: muted }]} numberOfLines={1}>
              {isProperLogin ? (role || 'Reader') : 'లాగిన్ చేయలేదు'}
            </Text>
          </View>
          
          {isProperLogin ? (
            <Pressable 
              onPress={doLogout} 
              style={({ pressed }) => [
                styles.signInButton,
                styles.outlineButton,
                { borderColor: border, backgroundColor: card },
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialIcons name="logout" size={18} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
              <Text style={[styles.buttonLabel, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>Logout</Text>
            </Pressable>
          ) : (
            <Pressable 
              onPress={gotoLogin} 
              style={({ pressed }) => [
                styles.signInButton,
                styles.primaryButton,
                { backgroundColor: Colors.light.primary },
                pressed && { opacity: 0.85 }
              ]}
            >
              <Text style={[styles.buttonLabel, { color: '#fff' }]}>Sign In</Text>
            </Pressable>
          )}
        </View>

        {isTenantRole ? (
          <View style={[styles.card, { backgroundColor: tenantCardBg, borderColor: tenantBorder }]}>
            <View style={styles.tenantHeaderRow}>
              <View
                style={[
                  styles.tenantLogoWrap,
                  {
                    borderColor: withAlpha(tenantCardFg, tenantCardFg === '#ffffff' ? 0.35 : 0.18),
                    backgroundColor: withAlpha(tenantCardFg, tenantCardFg === '#ffffff' ? 0.92 : 0.08),
                  },
                ]}
              >
                {tenantLogoUrl ? (
                  <Image
                    source={{ uri: tenantLogoUrl }}
                    style={styles.tenantLogoImg}
                    resizeMode="contain"
                    onError={() => {
                      // If logo fails to load, fall back to initial
                      setTenantLogoUrl('');
                    }}
                  />
                ) : (
                  <Text style={[styles.tenantLogoFallback, { color: tenantCardFg }]}>
                    {(tenantName || 'T').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tenantName, { color: tenantCardFg }]} numberOfLines={1}>
                  {tenantName || ''}
                </Text>
              </View>
              <View style={[styles.tenantRolePill, { backgroundColor: tenantPillBg, borderColor: tenantBorder }]}>
                <Text style={[styles.tenantRolePillText, { color: tenantCardFg }]} numberOfLines={1}>
                  {role}
                </Text>
              </View>
            </View>

            {isTenantAdmin ? (
              <Pressable
                onPress={() => router.push('/tenant/dashboard')}
                accessibilityLabel="Open Tenant Dashboard"
                style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.label, { color: tenantCardFg }]}>Tenant Dashboard</Text>
                  <Text style={[styles.helper, { color: tenantSubtle }]}>Open overview cards and metrics</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={tenantCardFg} />
              </Pressable>
            ) : null}

            {isReporter ? (
              <Pressable
                onPress={() => router.push('/reporter/dashboard')}
                accessibilityLabel="Open Reporter Dashboard"
                style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.label, { color: tenantCardFg }]}>Reporter Dashboard</Text>
                  <Text style={[styles.helper, { color: tenantSubtle }]}>Post news, manage profile & ID card</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={tenantCardFg} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Location Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Location</Text>
          <Pressable onPress={changeLocation} accessibilityLabel="Change location" style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
            <View>
              <Text style={[styles.label, { color: text }]}>{location ? location : 'Not set'}</Text>
              <Text style={[styles.helper, { color: muted }]}>Used to personalize local news</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Language Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Language</Text>
          <Pressable onPress={() => setLangSheetOpen(true)} accessibilityLabel="Change language" style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
            <View>
              <Text style={[styles.label, { color: text }]}>{languageDisplay}</Text>
              <Text style={[styles.helper, { color: muted }]}>App language for headlines and UI</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Other Preferences */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Preferences</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.label, { color: text }]}>Notifications</Text>
              <Text style={[styles.helper, { color: muted }]}>Breaking news and daily digests</Text>
            </View>
            <Switch value={notify} onValueChange={setNotify} />
          </View>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.label, { color: text }]}>Video autoplay</Text>
              <Text style={[styles.helper, { color: muted }]}>Play videos automatically on Wi‑Fi</Text>
            </View>
            <Switch value={autoplay} onValueChange={setAutoplay} />
          </View>
        </View>

        {/* Appearance */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Appearance</Text>
          <Pressable onPress={() => router.push('/settings/appearance' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Theme, font size, reading mode</Text>
              <Text style={[styles.helper, { color: muted }]}>Dark/Light, comfortable reading</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Privacy & Security */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Privacy & Security</Text>
          <Pressable onPress={() => router.push('/settings/privacy' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Privacy policy, Terms & Permissions</Text>
              <Text style={[styles.helper, { color: muted }]}>Understand how we use your data</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Downloads & Storage */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Downloads & Storage</Text>
          <Pressable onPress={() => router.push('/settings/storage' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Offline news, saved articles, clear cache</Text>
              <Text style={[styles.helper, { color: muted }]}>Manage space and offline content</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Support & Feedback */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Support & Feedback</Text>
          <Pressable onPress={() => router.push('/settings/support' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Contact us, report an issue, rate us</Text>
              <Text style={[styles.helper, { color: muted }]}>We love hearing from you</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* About App */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>About</Text>
          <Pressable onPress={() => router.push('/settings/about' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Version and developer details</Text>
              <Text style={[styles.helper, { color: muted }]}>Learn more about this app</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Developer */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Developer</Text>
          <Pressable onPress={() => router.push('/settings/account-debug' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Account debug</Text>
              <Text style={[styles.helper, { color: muted }]}>Reset storage, tokens, mock mode</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Language Picker Bottom Sheet */}
        <BottomSheet
          visible={langSheetOpen}
          onClose={() => setLangSheetOpen(false)}
          snapPoints={[400]}
          initialSnapIndex={0}
          respectSafeAreaBottom={false}
          shadowEnabled={false}
          header={
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>Select language</Text>
              <Pressable onPress={() => setLangSheetOpen(false)} accessibilityLabel="Close language picker">
                <MaterialIcons name="close" size={22} color={Colors.light.primary} />
              </Pressable>
            </View>
          }
        >
          <View style={{ paddingBottom: 50 }}>
            {LANGUAGES.map((l) => {
              const active = language?.code === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={async () => {
                    await persistLanguage(l);
                    try {
                      await updatePreferences({ languageId: l.id, languageCode: l.code });
                      await afterPreferencesUpdated({ languageIdChanged: l.id, languageCode: l.code });
                    } catch {
                      // likely guest user without userId; ignore
                    }
                    setLangSheetOpen(false);
                    try { await refreshProfile(); } catch {}
                  }}
                  style={({ pressed }) => [styles.langRow, { borderBottomColor: border }, active && { backgroundColor: card }, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langNative, { color: l.color }]}>{l.nativeName}</Text>
                    <Text style={[styles.langEnglish, { color: muted }]}>{l.name}</Text>
                  </View>
                  {active ? <MaterialIcons name="check-circle" size={22} color={Colors.light.secondary} /> : <View style={{ width: 22, height: 22 }} />}
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: { 
    height: 56, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    borderBottomWidth: 1 
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { color: Colors.light.primary, fontWeight: '600' },
  appBarTitle: { 
    color: Colors.light.primary, 
    fontSize: 18, 
    fontWeight: '700', 
    letterSpacing: -0.3 
  },
  container: { 
    padding: 16, 
    gap: 14 
  },
  
  // Redesigned Profile Card
  profileCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 6,
  },
  primaryButton: {
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  outlineButton: {
    borderWidth: 1.5,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Legacy styles (kept for other components)
  profileHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 6, 
    elevation: 1 
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1 
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: Colors.light.primary, fontWeight: '800', fontSize: 20 },
  displayName: { fontSize: 18, fontWeight: '800' },
  subtleText: { marginTop: 2 },
  locationChip: { 
    marginTop: 6, 
    alignSelf: 'flex-start', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 999, 
    borderWidth: 1 
  },
  locationText: { color: Colors.light.primary, fontWeight: '600', fontSize: 12 },
  
  // Setting Cards
  card: { 
    borderRadius: 14, 
    padding: 18, 
    borderWidth: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 8, 
    elevation: 1 
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    marginBottom: 12, 
    letterSpacing: -0.2 
  },
  input: { 
    borderWidth: 1, 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    marginBottom: 10 
  },
  rowBetween: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginTop: 10 
  },
  label: { 
    fontSize: 15, 
    fontWeight: '600', 
    letterSpacing: -0.1 
  },
  helper: { 
    fontSize: 13, 
    marginTop: 3, 
    lineHeight: 18 
  },
  tenantHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 0 },
  tenantLogoWrap: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 },
  tenantLogoImg: { width: '100%', height: '100%' },
  tenantLogoFallback: { fontWeight: '900', fontSize: 18 },
  tenantName: { fontSize: 16, fontWeight: '800' },
  tenantRolePill: { maxWidth: 140, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  tenantRolePillText: { fontSize: 11, fontWeight: '800' },
  langPills: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1 },
  pillActive: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  pillText: { color: Colors.light.primary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  langRowActive: {},
  langNative: { fontSize: 18, fontWeight: '700' },
  langEnglish: { marginTop: 2 },
});
