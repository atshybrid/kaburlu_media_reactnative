import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import Button from './Button';

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  illustration,
}) => {
  return (
    <View style={styles.container}>
      {illustration || (
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon} size={64} color="#9CA3AF" />
        </View>
      )}
      
      <Text style={styles.title}>{title}</Text>
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="outline"
          size="md"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F3F4F6',
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
  
  description: {
    fontSize: Typography.bodySmall,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  
  button: {
    marginTop: Spacing.md,
  },
});

export default EmptyState;
