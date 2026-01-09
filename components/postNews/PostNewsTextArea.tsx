import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

interface PostNewsTextAreaProps extends TextInputProps {
  label?: string;
  minHeight?: number;
  containerStyle?: ViewStyle;
}

export const PostNewsTextArea = forwardRef<TextInput, PostNewsTextAreaProps>(
  ({ label, minHeight = 180, containerStyle, style, ...props }, ref) => {
    const scheme = useColorScheme() ?? 'light';
    const c = Colors[scheme];

    return (
      <View style={containerStyle}>
        {label ? (
          <ThemedText type="defaultSemiBold" style={{ color: c.text, marginBottom: 8 }}>
            {label}
          </ThemedText>
        ) : null}

        <TextInput
          ref={ref}
          placeholderTextColor={c.muted}
          multiline
          textAlignVertical="top"
          style={[
            styles.textArea,
            {
              borderColor: c.border,
              color: c.text,
              backgroundColor: c.background,
              minHeight,
            },
            style,
          ]}
          {...props}
        />
      </View>
    );
  }
);

PostNewsTextArea.displayName = 'PostNewsTextArea';

const styles = StyleSheet.create({
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
});

export default PostNewsTextArea;
