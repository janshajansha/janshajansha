/**
 * globalErrorHandler.ts  (minimal, build-safe version)
 * ────────────────────────────────────────────────────
 * Surfaces the real error behind a silent release-APK crash as an on-screen
 * Alert, so you can screenshot it. No external requires — cannot break the
 * bundle. Call setupGlobalErrorHandler() once at the very top of App.tsx.
 */
import { Alert } from 'react-native';

export function setupGlobalErrorHandler() {
  const ErrorUtils = (global as any).ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;

  const previous = ErrorUtils.getGlobalHandler?.();

  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    const name    = error?.name ?? 'Error';
    const message = error?.message ?? String(error);
    const stack   = (error?.stack ?? '').split('\n').slice(0, 8).join('\n');

    Alert.alert(
      isFatal ? 'CRASH (fatal)' : 'CRASH',
      `${name}: ${message}\n\n${stack}`,
      [{ text: 'Copy-worthy — screenshot this' }]
    );

    // Preserve default behavior
    previous?.(error, isFatal);
  });
}