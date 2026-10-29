// react-native-gesture-handler MUST be the very first import in the app.
// Nothing can come before it — not even the error handler.
import 'react-native-gesture-handler';

import { setupGlobalErrorHandler } from './src/utils/globalErrorHandler';
// Activate the global crash handler as early as possible (after gesture-handler).
setupGlobalErrorHandler();

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,              // Never auto-retry — a 401 retry hits the server again for nothing
      staleTime: 1000 * 60 * 2,  // 2 minutes
      gcTime: 1000 * 60 * 10,    // 10 minutes
      refetchOnWindowFocus: false,
      throwOnError: false,       // Don't throw to error boundary; let screens handle errors inline
    },
    mutations: {
      retry: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#0F172A" />
        <RootNavigator />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}