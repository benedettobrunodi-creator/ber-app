import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuthStore } from './src/stores/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { colors } from './src/theme/colors';

// ── Keep splash screen visible until we're ready ──
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── TanStack Query client ─────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  },
});

// ── Push notification registrar (only when authenticated) ──
function PushNotificationRegistrar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      console.log('[Push] Token registrado:', expoPushToken.substring(0, 30) + '...');
    }
  }, [isAuthenticated, expoPushToken]);

  return null;
}

// ── Root component ────────────────────────────────

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_900Black,
  });

  useEffect(() => {
    async function prepare() {
      try {
        await hydrate();
      } catch (e) {
        console.warn('Hydrate error:', e);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, appReady]);

  if (!fontsLoaded || !appReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <PushNotificationRegistrar />
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
