import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Check, ChevronRight, LogOut, Plus, Server, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';
import { type Instance, useInstanceStore } from '@/stores/instanceStore';
import { useSyncStore } from '@/stores/syncStore';
import { secureStorage } from '@/utils/secureStorage';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const user = useAuthStore((s) => s.user);
  const license = useAuthStore((s) => s.license);
  const settings = useAuthStore((s) => s.settings);
  const logout = useAuthStore((s) => s.logout);
  const switchInstance = useAuthStore((s) => s.switchInstance);

  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeId);
  const removeInstance = useInstanceStore((s) => s.removeInstance);

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const onAddInstance = () => {
    router.push('/(auth)/setup');
  };

  const onSwitchTo = async (inst: Instance) => {
    if (inst.id === activeId) return;
    const ok = await switchInstance(inst.id);
    if (ok) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  };

  const onRemove = (inst: Instance) => {
    const isActive = inst.id === activeId;
    Alert.alert(
      'Supprimer cette instance ?',
      `${inst.label} (${inst.baseUrl})\nLe token associé sera effacé.${
        isActive ? '\n\nVous serez déconnecté.' : ''
      }`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await secureStorage.clearToken(inst.id);
            removeInstance(inst.id);
            const newActive = useInstanceStore.getState().getActive();
            if (isActive) {
              if (newActive) {
                const ok = await switchInstance(newActive.id);
                router.replace(ok ? '/(tabs)' : '/(auth)/login');
              } else {
                await logout({ callServer: false });
                router.replace('/(auth)/setup');
              }
            }
          },
        },
      ],
    );
  };

  const appVersion = (Constants.expoConfig?.version ?? '1.0.0') as string;
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';
  const syncCounts = useSyncStore((s) => s.counts);
  const online = useSyncStore((s) => s.online);
  const pendingCount = syncCounts.pending + syncCounts.sending + syncCounts.error;

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

        <View className="mb-5">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
              Instances Dolibarr
            </Text>
            <Pressable
              onPress={onAddInstance}
              hitSlop={8}
              className="flex-row items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 active:opacity-70 dark:border-border-dark dark:bg-surface-dark"
            >
              <Plus size={12} color={iconColor} />
              <Text className="text-xs font-semibold text-text dark:text-text-dark">Ajouter</Text>
            </Pressable>
          </View>
          <View className="rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
            {instances.length === 0 ? (
              <View className="px-4 py-3">
                <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                  Aucune instance configurée.
                </Text>
              </View>
            ) : (
              instances.map((inst) => (
                <InstanceRow
                  key={inst.id}
                  inst={inst}
                  active={inst.id === activeId}
                  onSwitch={() => onSwitchTo(inst)}
                  onRemove={() => onRemove(inst)}
                />
              ))
            )}
          </View>
        </View>

        <Section title="Synchronisation">
          <Pressable
            onPress={() => router.push('/sync-queue' as never)}
            className="flex-row items-center justify-between border-b border-border/40 px-4 py-3 last:border-b-0 dark:border-border-dark/40"
          >
            <View className="flex-1">
              <Text className="text-sm text-text dark:text-text-dark">File de synchro</Text>
              <Text className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
                {online ? 'En ligne' : 'Hors-ligne'}
                {pendingCount > 0 ? ` • ${pendingCount} en attente` : ' • file vide'}
              </Text>
            </View>
            <ChevronRight size={18} color={iconColor} />
          </Pressable>
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
          <Button label={t('settings.logout')} variant="danger" onPress={onLogout} />
        </View>

        <View className="mt-6 items-center opacity-60">
          <LogOut size={14} color={iconColor} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InstanceRow({
  inst,
  active,
  onSwitch,
  onRemove,
}: {
  inst: Instance;
  active: boolean;
  onSwitch: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row items-center border-b border-border/40 px-4 py-3 last:border-b-0 dark:border-border-dark/40">
      <Pressable onPress={onSwitch} className="flex-1 flex-row items-center active:opacity-70">
        <View
          className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
            active ? 'bg-text dark:bg-text-dark' : 'bg-background dark:bg-background-dark'
          }`}
        >
          {active ? (
            <Check size={16} color="#ffffff" />
          ) : (
            <Server size={16} color="#6b7280" />
          )}
        </View>
        <View className="flex-1 pr-2">
          <Text numberOfLines={1} className="text-sm font-semibold text-text dark:text-text-dark">
            {inst.label}
          </Text>
          <Text numberOfLines={1} className="text-xs text-text-muted dark:text-text-muted-dark">
            {inst.baseUrl}
          </Text>
          {inst.lastUserLogin ? (
            <Text className="mt-0.5 text-[10px] text-text-muted dark:text-text-muted-dark">
              {inst.lastUserLogin}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={8} className="ml-2 p-2 active:opacity-70">
        <Trash2 size={16} color="#ef4444" />
      </Pressable>
    </View>
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
