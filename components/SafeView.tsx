import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface SafeViewProps {
  /** Current loading state */
  loading?: boolean;
  /** Error object if request failed */
  error?: Error | string | null;
  /** Whether data is empty (after loading) */
  empty?: boolean;
  /** Content to render when data loaded successfully */
  children: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error component */
  errorComponent?: ReactNode;
  /** Custom empty state component */
  emptyComponent?: ReactNode;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Message to show in error state */
  errorMessage?: string;
  /** Message to show in empty state */
  emptyMessage?: string;
  /** Skip showing empty state (show children even if empty) */
  skipEmptyCheck?: boolean;
}

/**
 * SafeView - Universal component for safe rendering with states
 * Handles: Loading, Error, Empty, Success
 * 
 * Critical for Google Play review - prevents blank screens and crashes
 * 
 * @example
 * <SafeView
 *   loading={isLoading}
 *   error={error}
 *   empty={!articles?.length}
 *   onRetry={refetch}
 *   emptyMessage="No news available"
 * >
 *   <ArticleList articles={articles} />
 * </SafeView>
 */
export default function SafeView({
  loading = false,
  error = null,
  empty = false,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  onRetry,
  errorMessage,
  emptyMessage,
  skipEmptyCheck = false,
}: SafeViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Priority: Loading > Error > Empty > Content
  
  if (loading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <LoadingState colors={colors} />
    );
  }

  if (error) {
    return errorComponent ? (
      <>{errorComponent}</>
    ) : (
      <ErrorState
        colors={colors}
        error={error}
        onRetry={onRetry}
        message={errorMessage}
      />
    );
  }

  if (empty && !skipEmptyCheck) {
    return emptyComponent ? (
      <>{emptyComponent}</>
    ) : (
      <EmptyState colors={colors} message={emptyMessage} />
    );
  }

  return <>{children}</>;
}

/**
 * Default Loading State
 */
function LoadingState({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.tint} />
      <Text style={[styles.loadingText, { color: colors.muted }]}>
        Loading...
      </Text>
    </View>
  );
}

/**
 * Default Error State with Retry
 */
function ErrorState({
  colors,
  error,
  onRetry,
  message,
}: {
  colors: typeof Colors.light;
  error: Error | string;
  onRetry?: () => void;
  message?: string;
}) {
  const errorText = message || (typeof error === 'string' ? error : error.message);
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MaterialIcons name="error-outline" size={56} color={colors.tint} />
      
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Unable to load content
      </Text>
      
      <Text style={[styles.errorMessage, { color: colors.muted }]}>
        {errorText || 'Please check your internet connection and try again.'}
      </Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.tint },
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialIcons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Default Empty State
 */
function EmptyState({
  colors,
  message,
}: {
  colors: typeof Colors.light;
  message?: string;
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MaterialIcons name="inbox" size={56} color={colors.muted} style={{ opacity: 0.5 }} />
      
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No content available
      </Text>
      
      <Text style={[styles.emptyMessage, { color: colors.muted }]}>
        {message || 'Check back later for updates.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
