import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getInterventionsAssigned } from '@/api/endpoints/interventions';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import type { ModulePart } from '@/types/api';
import { formatDuration, formatRelativeDateTime } from '@/utils/format';

const ALLOWED: ModulePart[] = ['facture', 'propal', 'ficheinter', 'projet', 'contrat'];
const STATUS_VARIANTS: Record<number, 'neutral' | 'warning' | 'info' | 'success'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
  3: 'success',
};

export default function ObjectDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const { t } = useTranslation();
  const scheme = useColorScheme();

  const isAllowed = ALLOWED.includes(type as ModulePart);
  const objectId = Number(id);

  // Phase 1 : we only have a real detail endpoint for interventions (via the
  // /interventions/assigned list — we filter client-side). Other modulepart
  // types render a placeholder page with the scan FAB available.
  const interventionQuery = useQuery({
    queryKey: ['intervention-detail', objectId],
    queryFn: async () => {
      const all = await getInterventionsAssigned({ limit: 100 });
      return all.items.find((i) => i.id === objectId) ?? null;
    },
    enabled: isAllowed && type === 'ficheinter' && Number.isFinite(objectId) && objectId > 0,
  });

  const onScan = () => {
    router.push(`/scanner/capture?modulepart=${type}&object_id=${id}` as never);
  };

  if (!isAllowed) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title="—" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-text dark:text-text-dark">Unsupported object type</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <ScreenHeader
        title={interventionQuery.data?.ref ?? `${type} #${id}`}
        subtitle={interventionQuery.data?.soc_name ?? type}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        {type === 'ficheinter' ? (
          interventionQuery.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator />
            </View>
          ) : interventionQuery.data ? (
            <View>
              <Section title="Référence">
                <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-xl font-semibold text-text dark:text-text-dark">
                      {interventionQuery.data.ref}
                    </Text>
                    <StatusBadge
                      label={t(`interventions.status_${interventionQuery.data.status}` as never, { defaultValue: '' })}
                      variant={STATUS_VARIANTS[interventionQuery.data.status] ?? 'neutral'}
                    />
                  </View>
                  <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                    {interventionQuery.data.soc_name}
                  </Text>
                </View>
              </Section>

              <Section title="Détails">
                <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                  <KV label="Date" value={formatRelativeDateTime(interventionQuery.data.date_valid ?? interventionQuery.data.date_creation)} />
                  <KV label="Durée" value={interventionQuery.data.duration > 0 ? formatDuration(interventionQuery.data.duration) : '—'} />
                  <KV label="Description" value={interventionQuery.data.description || '—'} multiline />
                </View>
              </Section>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                Intervention introuvable.
              </Text>
            </View>
          )
        ) : (
          // Other modulepart types — Phase 2 will wire dedicated endpoints.
          <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm text-text dark:text-text-dark">
              Détail {type} #{id} — la page complète arrive en Phase 2.
            </Text>
            <Text className="mt-2 text-xs text-text-muted dark:text-text-muted-dark">
              Vous pouvez quand même scanner un document depuis ici.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Scan FAB */}
      <Pressable
        onPress={onScan}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-text shadow-lg active:opacity-80 dark:bg-text-dark"
      >
        <Camera size={26} color={scheme === 'dark' ? '#0a0a0a' : '#ffffff'} />
      </Pressable>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
        {title}
      </Text>
      {children}
    </View>
  );
}

function KV({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View className={multiline ? 'border-b border-border/40 px-1 py-2 last:border-b-0 dark:border-border-dark/40' : 'flex-row items-center justify-between border-b border-border/40 py-2 px-1 last:border-b-0 dark:border-border-dark/40'}>
      <Text className={multiline ? 'mb-1 text-xs font-medium text-text-muted dark:text-text-muted-dark' : 'flex-1 pr-3 text-sm text-text dark:text-text-dark'}>{label}</Text>
      {multiline ? (
        <Text className="text-sm text-text dark:text-text-dark">{value}</Text>
      ) : (
        <Text numberOfLines={1} className="max-w-[60%] text-right text-sm text-text-muted dark:text-text-muted-dark">{value}</Text>
      )}
    </View>
  );
}
