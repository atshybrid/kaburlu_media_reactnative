import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface PostNewsButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function PostNewsButton({
  label,
  onPress,
  icon,
  iconPosition = 'left',
  variant = 'secondary',
  disabled,
  style,
  fullWidth,
}: PostNewsButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: primary,
          borderColor: primary,
          textColor: c.background,
          iconColor: c.background,
        };
      case 'secondary':
        return {
          backgroundColor: c.card,
          borderColor: c.border,
          textColor: c.text,
          iconColor: primary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: primary,
          textColor: primary,
          iconColor: primary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: primary,
          iconColor: primary,
        };
      default:
        return {
          backgroundColor: c.card,
          borderColor: c.border,
          textColor: c.text,
          iconColor: primary,
        };
    }
  };

  const colors = getStyles();
  const showIconLeft = icon && iconPosition === 'left';
  const showIconRight = icon && iconPosition === 'right';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
        fullWidth && { flex: 1 },
        pressed && !disabled && styles.pressed,
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {showIconLeft ? (
        <MaterialIcons name={icon!} size={18} color={colors.iconColor} />
      ) : null}
      <ThemedText style={{ color: colors.textColor }}>{label}</ThemedText>
      {showIconRight ? (
        <MaterialIcons name={icon!} size={18} color={colors.iconColor} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.85 },
});

export default PostNewsButton;
