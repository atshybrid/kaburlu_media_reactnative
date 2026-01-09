import { ThemedText } from '@/components/ThemedText';
import CategoryPicker, { type LiteCategory } from '@/components/ui/CategoryPicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createNewspaperArticle, getTenantCategories, uploadMedia, type CategoryItem, type UploadedMedia } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

async function readSelectedLanguageCode(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (!raw) return 'en';
    const parsed = JSON.parse(raw);
    return String(parsed?.code || parsed?.id || 'en');
  } catch {
    return 'en';
  }
}

function splitParagraphs(text: string): string[] {
  return String(text || '')
    .split(/\n\s*\n+/g)
    .map((s) => String(s || '').trim())
    .filter(Boolean);
}

export default function PostNewsMediaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;
  const router = useRouter();

  const { draft, setDraft, setImageUris, resetDraft, setJustPosted } = usePostNewsDraftStore();

  const [tenantId, setTenantId] = useState<string>('');
  const [tenantCategories, setTenantCategories] = useState<CategoryItem[] | null>(null);
  const [tenantCategoriesBusy, setTenantCategoriesBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [showCongrats, setShowCongrats] = useState(false);

  const congratsAnim = useMemo(() => require('../../assets/lotti/congratulation.json'), []);
  const newsIconAnim = useMemo(() => require('../../assets/lotti/News icon.json'), []);

  // Load tenantId for categories
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await loadTokens();
        const tid = String((t as any)?.session?.tenant?.id || (t as any)?.session?.tenant?._id || '').trim();
        if (alive) setTenantId(tid);
      } catch {
        if (alive) setTenantId('');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fetch tenant categories
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const tid = String(tenantId || '').trim();
      if (!tid) return;
      setTenantCategoriesBusy(true);
      try {
        // Use selected language if available; backend also provides tenantLanguageCode.
        const langCode = String(draft.languageCode || draft.languageId || 'en');
        const list = await getTenantCategories({ tenantId: tid, langCode });
        if (alive) setTenantCategories(list);
      } catch {
        if (alive) setTenantCategories([]);
      } finally {
        if (alive) setTenantCategoriesBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draft.languageCode, draft.languageId, tenantId]);

  const pickImage = useCallback(async (opts: { cover?: boolean }) => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
      Alert.alert('Permission needed', 'Please allow Photos / Media permission.');
      return;
    }

    const mediaTypeImages = (ImagePicker as any).MediaType?.Images ?? 'images';
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeImages,
      // Skip native cropper - we display in 16:9 container with cover mode
      allowsEditing: false,
      quality: 0.85,
    });

    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;

    if (opts.cover) {
      setDraft({ coverImageUri: uri });
      return;
    }

    const next = [...(draft.imageUris || []), uri];
    setImageUris(next);
  }, [draft.imageUris, setDraft, setImageUris]);

  const pickVideo = useCallback(async () => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
      Alert.alert('Permission needed', 'Please allow Photos / Media permission.');
      return;
    }

    const mediaTypeVideos = (ImagePicker as any).MediaType?.Videos ?? 'videos';
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeVideos,
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setDraft({ videoUri: uri });
  }, [setDraft]);

  const clearVideo = useCallback(() => {
    setDraft({ videoUri: undefined });
  }, [setDraft]);

  const removeExtra = useCallback((uri: string) => {
    const next = (draft.imageUris || []).filter((x) => x !== uri);
    setImageUris(next);
  }, [draft.imageUris, setImageUris]);

  const canPost = useMemo(() => {
    const titleOk = String(draft.title || '').trim().length >= 3;
    const bodyOk = String(draft.body || '').trim().length >= 20;
    const coverOk = !!draft.coverImageUri;
    const categoryOk = !!String(draft.categoryId || '').trim();
    return titleOk && bodyOk && coverOk && categoryOk && !busy;
  }, [busy, draft.body, draft.categoryId, draft.coverImageUri, draft.title]);

  const onSubmit = useCallback(async () => {
    if (!String(draft.categoryId || '').trim()) {
      Alert.alert('Category required', 'Please select a category to continue.');
      return;
    }
    if (!draft.coverImageUri) {
      Alert.alert('Cover image required', 'Please choose a cover image to continue.');
      return;
    }

    setBusy(true);
    setProgress('Uploading media…');
    try {
      const uploaded: UploadedMedia[] = [];

      const cover = await uploadMedia({ uri: draft.coverImageUri, type: 'image', folder: 'posts' });
      uploaded.push(cover);

      const extras = Array.isArray(draft.imageUris) ? draft.imageUris.slice(0, 8) : [];
      for (let i = 0; i < extras.length; i++) {
        setProgress(`Uploading image ${i + 1}/${extras.length}…`);
        const up = await uploadMedia({ uri: extras[i], type: 'image', folder: 'posts' });
        uploaded.push(up);
      }

      const videoUri = String((draft as any)?.videoUri || '').trim();
      if (videoUri) {
        setProgress('Uploading video…');
        const upVid = await uploadMedia({ uri: videoUri, type: 'video', folder: 'posts' });
        uploaded.push(upVid);
      }

      setProgress('Posting…');
      const languageCode = String(draft.languageCode || (await readSelectedLanguageCode()) || 'en');

      const paragraphs = splitParagraphs(String(draft.body || ''));
      const lead = paragraphs[0] || '';
      const content = paragraphs.slice(1).map((p) => ({ type: 'paragraph' as const, text: p }));

      const locId = String(draft.dateLine?.locationId || '').trim();
      const locType = String((draft.dateLine as any)?.locationType || '').toUpperCase();
      const location: any = {};
      if (locId) {
        if (locType === 'STATE') location.stateId = locId;
        else if (locType === 'DISTRICT') location.districtId = locId;
        else if (locType === 'MANDAL') location.mandalId = locId;
        else if (locType === 'VILLAGE') location.villageId = locId;
        else location.districtId = locId; // fallback for older drafts
      }

      const imageUrls = uploaded.filter((m) => m.type === 'image').map((m) => m.url).filter(Boolean);
      const videoUrls = uploaded.filter((m) => m.type === 'video').map((m) => m.url).filter(Boolean);
      const coverUrl = imageUrls[0];

      const res = await createNewspaperArticle({
        languageCode,
        categoryId: String(draft.categoryId || '').trim(),
        title: String(draft.title || '').trim(),
        subTitle: String(draft.subtitle || '').trim() || undefined,
        dateLine: String(draft.dateLine?.text || '').trim() || undefined,
        bulletPoints: Array.isArray(draft.bullets) ? draft.bullets.map((b) => String(b || '').trim()).filter(Boolean).slice(0, 5) : undefined,
        lead: lead || undefined,
        content: content.length ? content : undefined,
        coverImageUrl: coverUrl || undefined,
        images: imageUrls.length ? imageUrls : undefined,
        videos: videoUrls.length ? videoUrls : undefined,
        mediaUrls: (imageUrls.length || videoUrls.length) ? [...imageUrls, ...videoUrls] : undefined,
        location,
      });

      // BEST PRACTICE: Show full-screen success, then navigate
      // 1. Set flags first to prevent any modals from appearing
      setJustPosted(true);
      resetDraft();
      
      // 2. Show congrats animation
      setShowCongrats(true);
      
      // 3. After animation plays, navigate to dashboard (clear navigation stack)
      setTimeout(() => {
        setShowCongrats(false);
        // Dismiss all screens and go to reporter dashboard
        // Using dismissAll to clear navigation stack then navigate fresh
        if (router.canDismiss()) {
          router.dismissAll();
        }
        router.replace('/reporter/dashboard' as any);
      }, 2000);
      
      return res;
    } catch (e: any) {
      Alert.alert('Post failed', e?.message || 'Could not post your news');
    } finally {
      setProgress('');
      setBusy(false);
    }
  }, [draft, resetDraft, router, setJustPosted]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && styles.pressed,
          ]}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <View style={styles.appBarCenter}>
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>Post News</ThemedText>
          <ThemedText style={[styles.step, { color: c.muted }]}>Step 2 of 2</ThemedText>
        </View>

        <View style={styles.appBarRightSpacer} />
      </View>

      <Modal visible={showCongrats} transparent={false} animationType="fade">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }]}>
          <LottieView
            source={congratsAnim}
            autoPlay
            loop={false}
            style={{ width: 280, height: 280 }}
          />
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginTop: 16, fontSize: 18 }}>
            Posted successfully!
          </ThemedText>
        </View>
      </Modal>

      <Modal visible={busy && !showCongrats} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
            <LottieView source={newsIconAnim} autoPlay loop style={{ width: 160, height: 160 }} />
            <ThemedText style={{ color: c.text, marginTop: 8 }}>
              {progress || 'Posting…'}
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <CategoryPicker
              categories={tenantCategories}
              value={
                draft.categoryId
                  ? ({
                      id: draft.categoryId,
                      name: String(draft.categoryName || '').trim() || 'Category',
                      slug: draft.categorySlug,
                    } as LiteCategory)
                  : null
              }
              onChange={(item) => {
                setDraft({ categoryId: item.id, categoryName: item.name, categorySlug: item.slug });
              }}
              label="Category"
              placeholder={tenantCategoriesBusy ? 'Loading…' : 'Select Category'}
              recentKey={tenantId ? `recentCategories:tenant:${tenantId}` : 'recentCategories'}
            />
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Cover image (required)</ThemedText>
              <View style={{ backgroundColor: primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>16:9</ThemedText>
              </View>
            </View>
            <ThemedText style={{ color: c.text, fontSize: 12, marginTop: 4 }}>
              Image will display in 16:9 banner format
            </ThemedText>

            {!!draft.coverImageUri ? (
              <View style={{ marginTop: 12 }}>
                <Image source={{ uri: draft.coverImageUri }} style={[styles.coverImg, { borderColor: c.border }]} resizeMode="cover" />
                <Pressable
                  onPress={() => pickImage({ cover: true })}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    { borderColor: c.border, backgroundColor: c.background },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="image" size={18} color={primary} />
                  <ThemedText style={{ color: primary }}>Change cover</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => pickImage({ cover: true })}
                style={({ pressed }) => [
                  styles.pickCard,
                  { borderColor: primary, backgroundColor: primary + '10' },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="add-photo-alternate" size={26} color={primary} />
                <ThemedText type="defaultSemiBold" style={{ color: primary }}>Choose cover image</ThemedText>
                <ThemedText style={{ color: c.text, fontSize: 12, marginTop: 4 }}>Displayed in 16:9 banner format</ThemedText>
              </Pressable>
            )}

            <ThemedText style={{ color: c.muted, marginTop: 12 }}>Cover caption (optional)</ThemedText>
            <TextInput
              value={draft.coverCaption || ''}
              onChangeText={(t) => setDraft({ coverCaption: t })}
              placeholder="Caption…"
              placeholderTextColor={c.muted}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
            />
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Video (optional)</ThemedText>

            {draft.videoUri ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="videocam" size={20} color={primary} />
                  <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                    {String(draft.videoUri).split('/').pop() || 'Selected video'}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={clearVideo}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    { borderColor: c.border, backgroundColor: c.background },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="close" size={18} color={c.text} />
                  <ThemedText style={{ color: c.text }}>Remove video</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => void pickVideo()}
                style={({ pressed }) => [
                  styles.smallBtn,
                  { borderColor: c.border, backgroundColor: c.background, marginTop: 12 },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="upload" size={18} color={primary} />
                <ThemedText style={{ color: primary }}>Upload video</ThemedText>
              </Pressable>
            )}
          </View>

          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="defaultSemiBold" style={{ color: c.text }}>More images (optional)</ThemedText>
              <Pressable
                onPress={() => pickImage({ cover: false })}
                style={({ pressed }) => [
                  styles.smallBtn,
                  { borderColor: c.border, backgroundColor: c.background },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="add" size={18} color={primary} />
                <ThemedText style={{ color: primary }}>Add</ThemedText>
              </Pressable>
            </View>

            {(draft.imageUris || []).length ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {(draft.imageUris || []).map((uri) => (
                  <View key={uri} style={[styles.extraRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <Image source={{ uri }} style={styles.extraImg} />
                    <Pressable onPress={() => removeExtra(uri)} hitSlop={10}>
                      <MaterialIcons name="delete" size={22} color={c.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText style={{ color: c.muted, marginTop: 10 }}>No extra images.</ThemedText>
            )}
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText style={{ color: c.muted }}>{progress || (busy ? 'Working…' : '')}</ThemedText>
            {busy ? <ActivityIndicator size="small" /> : null}
          </View>

          <Pressable
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: canPost ? primary : c.border },
              pressed && canPost && styles.pressed,
            ]}
            disabled={!canPost}
            accessibilityLabel="Post"
          >
            <ThemedText type="defaultSemiBold" style={{ color: Colors.light.background }}>
              Post
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  step: { fontSize: 12, marginTop: 2 },
  appBarRightSpacer: { width: 40 },

  scroll: { padding: 14, paddingBottom: 24, gap: 12 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    marginTop: 8,
  },

  pickCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  coverImg: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },

  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  extraImg: { width: 54, height: 54, borderRadius: 10 },

  footer: {
    borderTopWidth: 1,
    padding: 12,
    gap: 10,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPad: { height: 70 },

  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: 14 },

  pressed: { opacity: 0.85 },
});
