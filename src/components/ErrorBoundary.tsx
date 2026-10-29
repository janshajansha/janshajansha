import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. If omitted the default EV360 error screen is shown. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // In production you could send this to a crash reporting service here
    console.error('[EV360] Uncaught error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) return children;

    if (fallback) return fallback(error, this.reset);

    return <DefaultErrorScreen error={error} onReset={this.reset} />;
  }
}

// ── Default error screen ─────────────────────────────────────────────────────
function DefaultErrorScreen({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚡</Text>
        </View>

        {/* Message */}
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app ran into an unexpected issue. Your data is safe — tap below to try again.
        </Text>

        {/* Retry */}
        <TouchableOpacity style={styles.retryBtn} onPress={onReset} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>

        {/* Error details toggle — useful during development */}
        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setShowDetails((v) => !v)}
        >
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Hide details ▲' : 'Show error details ▼'}
          </Text>
        </TouchableOpacity>

        {showDetails && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsTitle}>{error.name}</Text>
            <Text style={styles.detailsMessage}>{error.message}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.error + '18',
    borderWidth: 1.5,
    borderColor: COLORS.error + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconText:    { fontSize: 40 },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderRadius: RADIUS.full,
    marginTop: 8,
  },
  retryBtnText: {
    color: COLORS.bgDark,
    fontSize: 15,
    fontWeight: '800',
  },
  detailsToggle: { marginTop: 8 },
  detailsToggleText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + '33',
    gap: 6,
  },
  detailsTitle: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '700',
  },
  detailsMessage: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});