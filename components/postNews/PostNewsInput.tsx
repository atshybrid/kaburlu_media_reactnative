import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

interface PostNewsInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  containerStyle?: ViewStyle;
}

export const PostNewsInput = forwardRef<TextInput, PostNewsInputProps>(
  ({ label, error, leftIcon, rightIcon, containerStyle, style, ...props }, ref) => {
    const scheme = useColorScheme() ?? 'light';
    const c = Colors[scheme];
    const primary = c.tint;

    const hasError = !!error;

    return (
      <View style={containerStyle}>
        {label ? (
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginBottom: 8 }}>
            {label}
          </ThemedText>
        ) : null}

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: hasError ? '#e53935' : c.border,
              backgroundColor: c.background,
            },
            (leftIcon || rightIcon) && { flexDirection: 'row', alignItems: 'center' },
          ]}
        >
          {leftIcon ? (
            <MaterialIcons
              name={leftIcon}
              size={18}
              color={hasError ? '#e53935' : primary}
              style={{ marginLeft: 12 }}
            />
          ) : null}

          <TextInput
            ref={ref}
            placeholderTextColor={c.muted}
            style={[
              styles.input,
              { color: c.text },
              leftIcon && { paddingLeft: 8 },
              rightIcon && { paddingRight: 8 },
              style,
            ]}
            {...props}
          />

          {rightIcon ? (
            <MaterialIcons
              name={rightIcon}
              size={18}
              color={c.muted}
              style={{ marginRight: 12 }}
            />
          ) : null}
        </View>

        {hasError ? (
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={16} color="#e53935" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}
      </View>
    );
  }
);

PostNewsInput.displayName = 'PostNewsInput';

const styles = StyleSheet.create({
  inputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 14,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
  },
});

export default PostNewsInput;
