import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createPost, uploadMedia, type UploadedMedia } from '@/services/api';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

async function readSelectedLanguageId(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (!raw) return 'en';
    const parsed = JSON.parse(raw);
    return String(parsed?.id || parsed?.code || 'en');
  } catch {
    return 'en';
  }
}

function buildPostContent(draft: ReturnType<typeof usePostNewsDraftStore.getState>['draft']): string {
  const lines: string[] = [];
  const subtitle = String(draft.subtitle || '').trim();
  if (subtitle) lines.push(subtitle);

  const dl = draft.dateLine;
  const dlText = String(dl?.text || '').trim();
  if (dlText) {
    lines.push(dlText);
  }

  const bullets = Array.isArray(draft.bullets) ? draft.bullets.map((b) => String(b || '').trim()).filter(Boolean) : [];
  if (bullets.length) {
    lines.push('');
    for (const b of bullets.slice(0, 5)) lines.push(`- ${b}`);
  }

  const body = String(draft.body || '').trim();
  if (body) {
    lines.push('');
    lines.push(body);
  }

  const caption = String(draft.coverCaption || '').trim();
  if (caption) {
    lines.push('');
    lines.push(`Cover caption: ${caption}`);
  }

  return lines.join('\n');
}

export default function PostNewsMediaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;
  const router = useRouter();

  const { draft, setDraft, setImageUris, resetDraft } = usePostNewsDraftStore();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const pickImage = useCallback(async (opts: { cover?: boolean }) => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
      Alert.alert('Permission needed', 'Please allow Photos / Media permission.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: !!opts.cover,
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

  const removeExtra = useCallback((uri: string) => {
    const next = (draft.imageUris || []).filter((x) => x !== uri);
    setImageUris(next);
  }, [draft.imageUris, setImageUris]);

  const canPost = useMemo(() => {
    const titleOk = String(draft.title || '').trim().length >= 3;
    const bodyOk = String(draft.body || '').trim().length >= 20;
    const coverOk = !!draft.coverImageUri;
    return titleOk && bodyOk && coverOk && !busy;
  }, [busy, draft.body, draft.coverImageUri, draft.title]);

  const onSubmit = useCallback(async () => {
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

      setProgress('Posting…');
      const languageId = draft.languageId || (await readSelectedLanguageId());
      const content = buildPostContent(draft);

      const res = await createPost({
        title: String(draft.title || '').trim(),
        content,
        languageId,
        category: 'news',
        media: uploaded,
        locationId: draft.dateLine?.locationId,
        dateLineText: draft.dateLine?.text,
      });

      Alert.alert('Posted', 'Your news was posted successfully.');
      resetDraft();
      try {
        // Prefer going back to the dashboard the user came from.
        router.back();
      } catch {
        // ignore
      }
      return res;
    } catch (e: any) {
      Alert.alert('Post failed', e?.message || 'Could not post your news');
    } finally {
      setProgress('');
      setBusy(false);
    }
  }, [draft, resetDraft, router]);

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

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <ThemedText type="defaultSemiBold" style={{ color: c.text }}>Cover image (required)</ThemedText>

            {!!draft.coverImageUri ? (
              <View style={{ marginTop: 12 }}>
                <Image source={{ uri: draft.coverImageUri }} style={[styles.coverImg, { borderColor: c.border }]} />
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
                  { borderColor: c.border, backgroundColor: c.background },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="add-photo-alternate" size={26} color={primary} />
                <ThemedText type="defaultSemiBold" style={{ color: primary }}>Choose cover image</ThemedText>
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
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
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

  pressed: { opacity: 0.85 },
});
