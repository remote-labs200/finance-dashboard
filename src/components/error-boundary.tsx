import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

interface FallbackProps {
  error: Error;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: FallbackProps) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.five,
            paddingBottom: insets.bottom + Spacing.five,
            paddingLeft: insets.left + Spacing.five,
            paddingRight: insets.right + Spacing.five,
          },
        ]}>
        <SymbolView
          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
          size={48}
          tintColor="#FF3B30"
          style={styles.icon}
        />
        <ThemedText type="title" style={styles.title}>
          Something went wrong
        </ThemedText>
        <ThemedText type="callout" themeColor="textSecondary" style={styles.message}>
          An unexpected error occurred. Please try restarting the app. If the problem
          persists, contact support.
        </ThemedText>

        <Pressable
          onPress={resetError}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}>
          <ThemedText type="default" style={styles.buttonText}>
            Tap to Reload
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="placeholder" style={styles.errorDetails}>
          {error.message}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundary that catches rendering errors and displays a fallback
 * UI instead of crashing the app. Wrapped around the root layout in _layout.tsx.
 *
 * - Catches errors from any child component during render
 * - Logs the error (would send to crash reporting in production)
 * - Provides "Tap to Reload" to reset and recover
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    marginBottom: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: Spacing.four,
    backgroundColor: '#007AFF',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: Spacing.three,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorDetails: {
    marginTop: Spacing.six,
    textAlign: 'center',
  },
});
