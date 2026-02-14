import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import Button from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  variant?: 'error' | 'warning' | 'info';
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  icon = 'error-outline',
  variant = 'error',
}) => {
  const colors = {
    error: { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' },
    warning: { bg: '#FEF3C7', text: '#92400E', icon: '#F59E0B' },
    info: { bg: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6' },
  };

  const variantColors = colors[variant];

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: variantColors.bg }]}>
        <MaterialIcons name={icon} size={48} color={variantColors.icon} />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      
      {onRetry && (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="primary"
          size="md"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  
  title: {
    fontSize: Typography.h3,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  
  message: {
    fontSize: Typography.bodySmall,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 320,
    lineHeight: 22,
  },
  
  button: {
    marginTop: Spacing.md,
    minWidth: 140,
  },
});

export default ErrorState;
