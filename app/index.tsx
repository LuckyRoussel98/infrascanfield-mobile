import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/stores/authStore';
import { useInstanceStore } from '@/stores/instanceStore';

/**
 * Boot router : decides where to send the user based on persisted state.
 *   - hydrated === false       -> spinner (waiting for secure-store rehydration)
 *   - no Dolibarr URL          -> /(auth)/setup
 *   - URL but no valid token   -> /(auth)/login
 *   - URL + valid token        -> /(tabs)
 */
export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const baseUrl = useInstanceStore((s) => s.getActive()?.baseUrl ?? null);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!baseUrl) {
    return <Redirect href="/(auth)/setup" />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  return <Redirect href="/(tabs)" />;
}
