import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { useAuthStore } from '../store/authStore';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG MODE
// Set to true to surface every step as an on-screen alert while testing.
// Set back to false (or remove the alerts) once push is working.
// ─────────────────────────────────────────────────────────────────────────────
const PUSH_DEBUG = false;

function debug(msg: string) {
  if (PUSH_DEBUG) {
    Alert.alert('Push Debug', msg);
  }
  console.log('[PUSH]', msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Foreground notification behaviour
// ─────────────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// registerForPushNotifications — with loud debugging
// ─────────────────────────────────────────────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {

  if (!Device.isDevice) {
    debug('FAIL: Not a physical device. Push needs a real phone.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7FBF31',
    });
  }

  // Permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    debug('FAIL: Notification permission not granted. Status = ' + finalStatus);
    return null;
  }

  // Get the token
  let token: string;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    if (!projectId) {
      debug('FAIL: No projectId found in app config. Check extra.eas.projectId in app.json.');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenResponse.data;
    debug('GOT TOKEN: ' + token);
  } catch (err: any) {
    debug('FAIL getting token: ' + (err?.message ?? String(err)));
    return null;
  }

  // Send to backend
  const authToken = useAuthStore.getState().token;
  if (!authToken) {
    debug('FAIL: No auth token. User not logged in when registering. Token NOT sent to backend.');
    return token;
  }

  try {
    const { default: apiClient } = await import('../store/apiClient');
    const res = await apiClient.post(
      '/notifications/device',
      {
        push_token: token,
        platform:   Platform.OS,
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    debug('SUCCESS: token sent to backend. Response: ' + JSON.stringify(res?.data ?? res?.status ?? 'ok'));
  } catch (err: any) {
    const status  = err?.response?.status;
    const data    = err?.response?.data;
    debug(
      'FAIL sending to backend. HTTP ' + (status ?? '?') +
      ' — ' + (data ? JSON.stringify(data) : (err?.message ?? String(err)))
    );
  }

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// usePushNotifications hook
// ─────────────────────────────────────────────────────────────────────────────
export function usePushNotifications(
  onNotificationTap?: (data: Record<string, any>) => void
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tapListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    tapListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data ?? {};
        onNotificationTap?.(data as Record<string, any>);
      }
    );
    return () => {
      tapListener.current?.remove();
    };
  }, [onNotificationTap]);
}