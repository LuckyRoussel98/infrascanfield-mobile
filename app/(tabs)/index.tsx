import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';

/**
 * Dashboard placeholder — wired in Step 8.
 * For now we render the logged-in user info and a logout button so we can validate
 * the full onboarding -> auth -> protected route chain end-to-end.
 */
export default function DashboardScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="mb-2 text-2xl font-semibold text-text dark:text-text-dark">
          {t('tabs.dashboard')}
        </Text>
        <Text className="mb-6 text-base text-text-muted dark:text-text-muted-dark">
          Hello {user?.firstname || user?.login || ''} - real dashboard wired in Step 8.
        </Text>
        <Button
          label={t('settings.logout')}
          variant="secondary"
          onPress={onLogout}
          fullWidth={false}
        />
      </View>
    </SafeAreaView>
  );
}
