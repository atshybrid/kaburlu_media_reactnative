import { ThemedText } from '@/components/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadMedia } from '@/services/api';
import { loadTokens } from '@/services/auth';
import {
    deleteReporterProfilePhoto,
    getMyProfile,
    updateReporterProfilePhoto,
    type MyProfileResponse
} from '@/services/reporters';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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

function initials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return letters || 'R';
}

function normalizeLevel(level?: string | null) {
  const l = String(level || '').toUpperCase();
  if (l === 'STATE' || l === 'DISTRICT' || l === 'MANDAL' || l === 'ASSEMBLY') return l;
  return 'OTHER';
}

const LEVEL_META: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  STATE: { label: 'State Reporter', icon: 'public', color: '#6366f1' },
  DISTRICT: { label: 'District Reporter', icon: 'location-city', color: '#f59e0b' },
  MANDAL: { label: 'Mandal Reporter', icon: 'apartment', color: '#10b981' },
  ASSEMBLY: { label: 'Assembly Reporter', icon: 'how-to-vote', color: '#ec4899' },
  OTHER: { label: 'Reporter', icon: 'person-pin', color: '#8b5cf6' },
};

const KYC_STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  APPROVED: { label: 'Verified', color: '#10b981', icon: 'verified-user' },
  SUBMITTED: { label: 'Under Review', color: '#f59e0b', icon: 'pending' },
  PENDING: { label: 'Pending', color: '#8b5cf6', icon: 'hourglass-empty' },
  REJECTED: { label: 'Rejected', color: '#ef4444', icon: 'cancel' },
};

/* ─────────────────────────────  Main Screen  ───────────────────────────── */

export default function ReporterProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);

  const [photoUpdating, setPhotoUpdating] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  const primary = brandPrimary || c.tint;
  const reporter = profile?.reporter;
  const tenantId = reporter?.tenantId;
  const reporterId = reporter?.id;

  const levelKey = normalizeLevel(reporter?.level);
  const levelMeta = LEVEL_META[levelKey] || LEVEL_META.OTHER;
  const kycMeta = KYC_STATUS_META[reporter?.kycStatus || ''] || KYC_STATUS_META.PENDING;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setPhotoMessage(null);

    try {
      const t = await loadTokens();
      const session: any = (t as any)?.session;
      const ds = session?.domainSettings;
      const colors = ds?.data?.theme?.colors;
      const pColor = colors?.primary || colors?.accent;
      if (isValidHexColor(pColor)) setBrandPrimary(String(pColor));

      const data = await getMyProfile();
      setProfile(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
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

  const onPickPhoto = useCallback(async () => {
    if (!tenantId || !reporterId) {
      setPhotoMessage('Session expired. Please login again.');
      return;
    }

    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Denied', 'Please allow access to your photo library to update your profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setPhotoUpdating(true);
      setPhotoMessage(null);

      const selectedUri = result.assets[0].uri;
      const filename = result.assets[0].fileName || `profile_${Date.now()}.jpg`;

      try {
        // Upload to storage service using api.ts uploadMedia (tries multiple strategies)
        const uploadResult = await uploadMedia({
          uri: selectedUri,
          type: 'image',
          name: filename,
          folder: 'profiles',
        });

        // Update reporter profile with the new photo URL
        await updateReporterProfilePhoto(tenantId, reporterId, uploadResult.url);

        // Update local state
        setProfile((prev) =>
          prev ? { ...prev, reporter: { ...prev.reporter, profilePhotoUrl: uploadResult.url } } : prev
        );
        setPhotoMessage('Photo updated successfully');
      } catch (uploadErr: any) {
        setPhotoMessage(uploadErr?.message || 'Failed to upload photo');
      }
    } catch (e: any) {
      setPhotoMessage(e?.message || 'Failed to update photo');
    } finally {
      setPhotoUpdating(false);
    }
  }, [tenantId, reporterId]);

  const onDeletePhoto = useCallback(async () => {
    if (!tenantId || !reporterId) {
      setPhotoMessage('Session expired. Please login again.');
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPhotoUpdating(true);
            setPhotoMessage(null);
            try {
              await deleteReporterProfilePhoto(tenantId, reporterId);
              setProfile((prev) =>
                prev ? { ...prev, reporter: { ...prev.reporter, profilePhotoUrl: undefined } } : prev
              );
              setPhotoMessage('Photo removed');
            } catch (e: any) {
              setPhotoMessage(e?.message || 'Failed to remove photo');
            } finally {
              setPhotoUpdating(false);
            }
          },
        },
      ]
    );
  }, [tenantId, reporterId]);

  /* ─────────────────────────────  Render  ───────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
        <ProfileSkeleton scheme={scheme} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={styles.errorCenter}>
          <View style={[styles.errorIcon, { backgroundColor: alphaBg('#ef4444', 0.1, c.background) }]}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          </View>
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 12 }}>
            {error}
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} tintColor={primary} />}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[levelMeta.color, alphaBg(levelMeta.color, 0.8, levelMeta.color)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerContent}>
            {/* Profile Photo */}
            <Pressable
              onPress={onPickPhoto}
              disabled={photoUpdating}
              style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.9 }]}
            >
              {reporter?.profilePhotoUrl ? (
                <Image source={{ uri: reporter.profilePhotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <ThemedText type="title" style={{ color: '#fff', fontSize: 32 }}>
                    {initials(reporter?.fullName)}
                  </ThemedText>
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: primary }]}>
                {photoUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialIcons name="camera-alt" size={16} color="#fff" />
                )}
              </View>
            </Pressable>

            <ThemedText type="title" style={styles.headerName} numberOfLines={1}>
              {reporter?.fullName || 'Reporter'}
            </ThemedText>
            <ThemedText style={styles.headerRole}>
              {reporter?.designation?.name || levelMeta.label}
            </ThemedText>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <MaterialIcons name={levelMeta.icon} size={12} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.badgeText}>{levelMeta.label.split(' ')[0]}</ThemedText>
              </View>
              {reporter?.active && (
                <View style={styles.badge}>
                  <MaterialIcons name="check-circle" size={12} color="rgba(255,255,255,0.9)" />
                  <ThemedText style={styles.badgeText}>Active</ThemedText>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Photo Actions */}
          {reporter?.profilePhotoUrl && (
            <View style={[styles.photoActions, { borderColor: c.border }]}>
              <Pressable
                onPress={onPickPhoto}
                disabled={photoUpdating}
                style={({ pressed }) => [styles.photoBtn, { borderColor: c.border }, pressed && { opacity: 0.9 }]}
              >
                <MaterialIcons name="edit" size={18} color={primary} />
                <ThemedText style={{ color: primary, fontWeight: '500', marginLeft: 6 }}>Change Photo</ThemedText>
              </Pressable>
              <Pressable
                onPress={onDeletePhoto}
                disabled={photoUpdating}
                style={({ pressed }) => [styles.photoBtn, { borderColor: c.border }, pressed && { opacity: 0.9 }]}
              >
                <MaterialIcons name="delete" size={18} color="#ef4444" />
                <ThemedText style={{ color: '#ef4444', fontWeight: '500', marginLeft: 6 }}>Remove</ThemedText>
              </Pressable>
            </View>
          )}

          {photoMessage && (
            <View style={[styles.messageBanner, { backgroundColor: alphaBg(photoMessage.includes('success') || photoMessage === 'Photo removed' ? '#10b981' : '#ef4444', 0.1, c.background) }]}>
              <MaterialIcons
                name={photoMessage.includes('success') || photoMessage === 'Photo removed' ? 'check-circle' : 'error'}
                size={18}
                color={photoMessage.includes('success') || photoMessage === 'Photo removed' ? '#10b981' : '#ef4444'}
              />
              <ThemedText style={{ color: photoMessage.includes('success') || photoMessage === 'Photo removed' ? '#10b981' : '#ef4444', flex: 1, marginLeft: 8 }}>
                {photoMessage}
              </ThemedText>
            </View>
          )}

          {/* ── Profile Details ── */}
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: c.text }]}>
            Profile Details
          </ThemedText>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <DetailRow icon="person" label="Full Name" value={reporter?.fullName || '—'} c={c} />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <DetailRow icon="phone" label="Mobile Number" value={reporter?.mobileNumber || '—'} c={c} />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <DetailRow icon="work" label="Designation" value={reporter?.designation?.name || '—'} c={c} />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <DetailRow icon={levelMeta.icon} label="Level" value={levelMeta.label} c={c} />
          </View>

          {/* ── Account Status ── */}
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: c.text }]}>
            Account Status
          </ThemedText>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Pressable
              onPress={() => router.push('/reporter/kyc' as any)}
              style={({ pressed }) => [styles.statusRow, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.statusIcon, { backgroundColor: alphaBg(kycMeta.color, 0.12, c.background) }]}>
                <MaterialIcons name={kycMeta.icon} size={20} color={kycMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>KYC Verification</ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                  {reporter?.kycStatus === 'APPROVED' ? 'Documents verified' : 'Complete verification'}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: alphaBg(kycMeta.color, 0.1, c.background) }]}>
                <ThemedText style={{ color: kycMeta.color, fontSize: 11, fontWeight: '600' }}>
                  {kycMeta.label}
                </ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={c.muted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, { backgroundColor: alphaBg(reporter?.subscriptionActive ? '#10b981' : '#f59e0b', 0.12, c.background) }]}>
                <MaterialIcons name="card-membership" size={20} color={reporter?.subscriptionActive ? '#10b981' : '#f59e0b'} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Subscription</ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                  Monthly subscription status
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: alphaBg(reporter?.subscriptionActive ? '#10b981' : '#f59e0b', 0.1, c.background) }]}>
                <ThemedText style={{ color: reporter?.subscriptionActive ? '#10b981' : '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                  {reporter?.subscriptionActive ? 'Active' : 'Inactive'}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, { backgroundColor: alphaBg(reporter?.active ? '#10b981' : '#ef4444', 0.12, c.background) }]}>
                <MaterialIcons name={reporter?.active ? 'check-circle' : 'block'} size={20} color={reporter?.active ? '#10b981' : '#ef4444'} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Account Status</ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }}>
                  Your reporter account status
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: alphaBg(reporter?.active ? '#10b981' : '#ef4444', 0.1, c.background) }]}>
                <ThemedText style={{ color: reporter?.active ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: '600' }}>
                  {reporter?.active ? 'Active' : 'Inactive'}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────  Sub-Components  ───────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  c,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  c: typeof Colors.light;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: alphaBg('#6366f1', 0.12, c.background) }]}>
        <MaterialIcons name={icon} size={18} color="#6366f1" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={{ color: c.muted, fontSize: 11 }}>{label}</ThemedText>
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>{value}</ThemedText>
      </View>
    </View>
  );
}

function ProfileSkeleton({ scheme, onBack }: { scheme: 'light' | 'dark'; onBack: () => void }) {
  const c = Colors[scheme];
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={[styles.header, { backgroundColor: c.muted }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <Skeleton width={88} height={88} borderRadius={44} style={{ marginBottom: 12 }} />
          <Skeleton width={180} height={24} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width={120} height={18} borderRadius={4} />
        </View>
      </View>
      <View style={[styles.content, { paddingTop: 20 }]}>
        <Skeleton width="100%" height={200} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={200} borderRadius={12} />
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────  Styles  ───────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingTop: 48, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerContent: { alignItems: 'center', marginTop: 24 },

  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

  headerName: { color: '#fff', fontSize: 22, marginTop: 12, textAlign: 'center' },
  headerRole: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 15, marginBottom: 12, marginTop: 8 },

  photoActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },

  messageBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16 },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  divider: { height: 1, marginHorizontal: 16 },

  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  statusRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
});
