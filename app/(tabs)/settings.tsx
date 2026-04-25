import Constants from 'expo-constants';
import { router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';
import { useInstanceStore } from '@/stores/instanceStore';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const user = useAuthStore((s) => s.user);
  const license = useAuthStore((s) => s.license);
  const settings = useAuthStore((s) => s.settings);
  const logout = useAuthStore((s) => s.logout);
  const instanceUrl = useInstanceStore((s) => s.baseUrl);
  const clearInstance = useInstanceStore((s) => s.clear);

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const onSwitchInstance = async () => {
    await logout();
    clearInstance();
    router.replace('/(auth)/setup');
  };

  const appVersion = (Constants.expoConfig?.version ?? '1.0.0') as string;
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <View className="border-b border-border bg-background px-4 py-3 dark:border-border-dark dark:bg-background-dark">
        <Text className="text-2xl font-bold text-text dark:text-text-dark">
          {t('settings.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Section title="Compte">
          <KV label="Utilisateur" value={user ? `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() || user.login : '—'} />
          <KV label="Email" value={user?.email || '—'} />
          <KV label="Admin" value={user?.admin ? 'Oui' : 'Non'} />
        </Section>

        <Section title="Instance">
          <KV label="URL" value={instanceUrl ?? '—'} />
        </Section>

        <Section title="Module">
          <KV label="Licence" value={license?.valid ? `${license.mode === 'stub' ? 'Mode dev (stub)' : 'Valide'}` : '—'} />
          <KV label="Utilisateurs actifs" value={license?.current_users != null ? String(license.current_users) : '—'} />
          <KV label="Token (jours)" value={settings ? String(settings.token_lifetime_days) : '—'} />
          <KV label="Upload max (Mo)" value={settings ? String(settings.max_upload_size_mb) : '—'} />
          <KV label="DPI par défaut" value={settings ? String(settings.default_scan_dpi) : '—'} />
        </Section>

        <Section title={t('settings.about')}>
          <KV label={t('settings.version', { version: appVersion })} value="" />
        </Section>

        <View className="mt-4 gap-3">
          <Button
            label={t('settings.logout')}
            variant="danger"
            onPress={onLogout}
            // Logout icon — tinted via NativeWind on the button label is enough for now.
            // We pass a custom React node via children if needed in Phase 2.
          />
          <Button label="Changer d'instance" variant="secondary" onPress={onSwitchInstance} />
        </View>

        <View className="mt-6 items-center opacity-60">
          <LogOut size={14} color={iconColor} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
        {title}
      </Text>
      <View className="rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
        {children}
      </View>
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3 last:border-b-0 dark:border-border-dark/40">
      <Text className="flex-1 pr-3 text-sm text-text dark:text-text-dark">{label}</Text>
      {value ? (
        <Text numberOfLines={1} className="max-w-[60%] text-sm text-text-muted dark:text-text-muted-dark">
          {value}
        </Text>
      ) : null}
    </View>
  );
}
