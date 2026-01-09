import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface CoverImagePickerProps {
  uri?: string | null;
  onPick: () => void;
  onClear?: () => void;
  aspectRatio?: number;
  label?: string;
  hint?: string;
  style?: ViewStyle;
}

export function CoverImagePicker({
  uri,
  onPick,
  onClear,
  aspectRatio = 16 / 9,
  label = 'Cover image',
  hint = 'Image will display in 16:9 banner format',
  style,
}: CoverImagePickerProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  return (
    <View style={style}>
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
          {label}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: primary }]}>
          <ThemedText style={styles.badgeText}>
            {aspectRatio === 16 / 9 ? '16:9' : `${aspectRatio}`}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{hint}</ThemedText>

      {uri ? (
        <View style={{ marginTop: 12 }}>
          <Image
            source={{ uri }}
            style={[
              styles.coverImg,
              { borderColor: c.border, aspectRatio },
            ]}
            resizeMode="cover"
          />
          <Pressable
            onPress={onPick}
            style={({ pressed }) => [
              styles.changeBtn,
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
          onPress={onPick}
          style={({ pressed }) => [
            styles.pickCard,
            { borderColor: primary, backgroundColor: primary + '10' },
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons name="add-photo-alternate" size={26} color={primary} />
          <ThemedText type="defaultSemiBold" style={{ color: primary }}>
            Choose cover image
          </ThemedText>
          <ThemedText style={{ color: c.text, fontSize: 12, marginTop: 4 }}>{hint}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

interface ExtraImageListProps {
  uris: string[];
  onAdd: () => void;
  onRemove: (uri: string) => void;
  maxCount?: number;
  style?: ViewStyle;
}

export function ExtraImageList({
  uris,
  onAdd,
  onRemove,
  maxCount = 8,
  style,
}: ExtraImageListProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  const canAdd = uris.length < maxCount;

  return (
    <View style={style}>
      <View style={styles.rowBetween}>
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
          More images (optional)
        </ThemedText>
        <Pressable
          onPress={onAdd}
          disabled={!canAdd}
          style={({ pressed }) => [
            styles.addBtn,
            { borderColor: c.border, backgroundColor: c.background },
            pressed && canAdd && styles.pressed,
            !canAdd && { opacity: 0.5 },
          ]}
        >
          <MaterialIcons name="add" size={18} color={primary} />
          <ThemedText style={{ color: primary }}>Add</ThemedText>
        </Pressable>
      </View>

      {uris.length ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          {uris.map((uri) => (
            <View
              key={uri}
              style={[
                styles.extraRow,
                { borderColor: c.border, backgroundColor: c.background },
              ]}
            >
              <Image source={{ uri }} style={styles.extraImg} />
              <Pressable onPress={() => onRemove(uri)} hitSlop={10}>
                <MaterialIcons name="delete" size={22} color={c.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <ThemedText style={{ color: c.muted, marginTop: 10 }}>No extra images.</ThemedText>
      )}
    </View>
  );
}

interface VideoPickerProps {
  uri?: string | null;
  onPick: () => void;
  onClear: () => void;
  style?: ViewStyle;
}

export function VideoPicker({ uri, onPick, onClear, style }: VideoPickerProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  return (
    <View style={style}>
      <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
        Video (optional)
      </ThemedText>

      {uri ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="videocam" size={20} color={primary} />
            <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>
              {String(uri).split('/').pop() || 'Selected video'}
            </ThemedText>
          </View>
          <Pressable
            onPress={onClear}
            style={({ pressed }) => [
              styles.removeBtn,
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
          onPress={onPick}
          style={({ pressed }) => [
            styles.uploadBtn,
            { borderColor: c.border, backgroundColor: c.background },
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons name="upload" size={18} color={primary} />
          <ThemedText style={{ color: primary }}>Upload video</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  coverImg: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  extraImg: {
    width: 54,
    height: 54,
    borderRadius: 10,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  pressed: { opacity: 0.85 },
});

export default CoverImagePicker;
