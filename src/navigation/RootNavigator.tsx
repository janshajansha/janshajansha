import React, { useEffect, useRef, useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../types';
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import TechnicianNavigator from './TechnicianNavigator';
import { usePushNotifications } from '../utils/pushNotifications';
import { COLORS } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isLoading, isAuthenticated, loadAndValidateAuth, isTechnician } = useAuthStore();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Ref to the navigation container so the push-tap handler can navigate
  // from outside the component tree (a notification tap fires globally).
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // ── Handle a tapped push notification ────────────────────────────────
  // When the backend sends a push with data { request_id }, tapping it should
  // open that request. We route to the correct stack based on the user's role.
  const handleNotificationTap = useCallback(
    (data: Record<string, any>) => {
      const requestId = data?.request_id;
      if (!requestId || !navigationRef.isReady()) return;

      if (isTechnician()) {
        // Technician stack -> technician request detail
        navigationRef.navigate('TechnicianTabs', {
          screen: 'TechRequestDetail',
          params: { requestId },
        } as any);
      } else {
        // Customer stack -> customer request detail
        navigationRef.navigate('CustomerTabs', {
          screen: 'Requests',
          params: {
            screen: 'RequestDetail',
            params: { requestId },
          },
        } as any);
      }
    },
    [isTechnician, navigationRef]
  );

  // ── Register for push + listen for taps ──────────────────────────────
  // Registers the device token once the user is authenticated (inside the
  // hook), and wires the tap handler above.
  usePushNotifications(handleNotificationTap);

  // ── Initial startup validation ──────────────────────────────────────
  // Called once on launch. isInitial=true shows the splash during the first
  // token check.
  useEffect(() => {
    loadAndValidateAuth(true);
  }, []);

  // ── Foreground re-validation ─────────────────────────────────────────
  // Re-validate the token when returning from background. Passing isInitial
  // = false (default) means this does NOT set isLoading=true, so it does NOT
  // unmount the navigator - critical, otherwise permission dialogs (location,
  // notifications) that briefly background the app would reset the user to the
  // default screen on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';
      const isNowActive = nextState === 'active';

      if (wasBackground && isNowActive && isAuthenticated) {
        loadAndValidateAuth(false);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : isTechnician() ? (
          <Stack.Screen name="TechnicianTabs" component={TechnicianNavigator} />
        ) : (
          <Stack.Screen name="CustomerTabs" component={CustomerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});