import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDashboard } from '@/api/endpoints/dashboard';
import { ObjectCard } from '@/components/ObjectCard';
import { ObjectCardSkeletonList } from '@/components/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import type { InterventionRow, InvoiceRow, ProposalRow } from '@/types/api';
import { formatCurrency, formatDate, formatDuration, formatRelativeDateTime } from '@/utils/format';

const INTERVENTION_STATUS_VARIANTS: Record<number, 'neutral' | 'warning' | 'info' | 'success'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
  3: 'success',
};
const INVOICE_STATUS_VARIANTS: Record<number, 'neutral' | 'info' | 'success' | 'danger'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
  3: 'danger',
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const goToObject = (modulepart: string, id: number) => {
    router.push(`/object/${modulepart}/${id}` as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        <View className="mb-6">
          <Text className="text-2xl font-bold text-text dark:text-text-dark">
            {t('tabs.dashboard')}
          </Text>
          <Text className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
            {user?.firstname || user?.lastname
              ? `${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim()
              : (user?.login ?? '')}
          </Text>
        </View>

        {query.isLoading ? (
          <View>
            <Text className="mb-2 text-base font-semibold text-text dark:text-text-dark">
              {t('dashboard.interventions_today')}
            </Text>
            <ObjectCardSkeletonList count={3} />
          </View>
        ) : query.isError ? (
          <View className="rounded-2xl border border-danger/30 bg-danger/10 p-4">
            <Text className="text-sm text-danger">{t('common.error')}</Text>
            <Pressable onPress={() => query.refetch()} className="mt-2 self-start">
              <Text className="text-sm font-semibold text-danger">{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : query.data ? (
          <View>
            <Section
              title={t('dashboard.interventions_today')}
              extra={
                query.data.interventions_pending_count > 0
                  ? t('dashboard.interventions_pending', { count: query.data.interventions_pending_count })
                  : undefined
              }
            >
              {query.data.interventions_today.length === 0 ? (
                <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                  {t('dashboard.empty_today')}
                </Text>
              ) : (
                query.data.interventions_today.map((row: InterventionRow) => (
                  <ObjectCard
                    key={row.id}
                    ref={row.ref}
                    title={row.soc_name}
                    subtitle={row.description || formatRelativeDateTime(row.date_valid ?? row.date_creation)}
                    rightLabel={row.duration > 0 ? formatDuration(row.duration) : undefined}
                    statusLabel={t(`interventions.status_${row.status}` as never, { defaultValue: '' })}
                    statusVariant={INTERVENTION_STATUS_VARIANTS[row.status] ?? 'neutral'}
                    onPress={() => goToObject('ficheinter', row.id)}
                  />
                ))
              )}
            </Section>

            <Section title={t('dashboard.invoices_recent')}>
              {query.data.invoices_recent.length === 0 ? (
                <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                  {t('invoices.empty')}
                </Text>
              ) : (
                query.data.invoices_recent.map((row: InvoiceRow) => (
                  <ObjectCard
                    key={row.id}
                    ref={row.ref}
                    title={row.soc_name}
                    subtitle={formatDate(row.date)}
                    rightLabel={formatCurrency(row.total_ttc)}
                    statusLabel={
                      row.paid === 1
                        ? t('invoices.paid')
                        : t(`invoices.status_${row.status}` as never, { defaultValue: '' })
                    }
                    statusVariant={
                      row.paid === 1 ? 'success' : (INVOICE_STATUS_VARIANTS[row.status] ?? 'neutral')
                    }
                    onPress={() => goToObject('facture', row.id)}
                  />
                ))
              )}
            </Section>

            <Section title={t('dashboard.proposals_to_sign')}>
              {query.data.proposals_to_sign.length === 0 ? (
                <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                  {t('invoices.empty')}
                </Text>
              ) : (
                query.data.proposals_to_sign.map((row: ProposalRow) => (
                  <ObjectCard
                    key={row.id}
                    ref={row.ref}
                    title={row.soc_name}
                    subtitle={`${formatDate(row.date)}${row.date_end ? ` → ${formatDate(row.date_end)}` : ''}`}
                    rightLabel={formatCurrency(row.total_ttc)}
                    onPress={() => goToObject('propal', row.id)}
                  />
                ))
              )}
            </Section>

            <Text className="mt-2 mb-4 text-xs text-text-muted dark:text-text-muted-dark">
              {t('dashboard.recent_scans', { count: query.data.scan_recent_count })}
            </Text>

            {/* Quick links to other entity types not in the tab bar */}
            <Section title="Plus">
              <View className="flex-row flex-wrap gap-2">
                <QuickLink label="Projets" onPress={() => router.push('/list/projects' as never)} />
                <QuickLink label="Contrats" onPress={() => router.push('/list/contracts' as never)} />
                <QuickLink label="Rechercher un tiers" onPress={() => router.push('/search/thirdparties' as never)} />
              </View>
            </Section>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface px-4 py-3 active:opacity-70 dark:border-border-dark dark:bg-surface-dark"
    >
      <Text className="text-sm font-medium text-text dark:text-text-dark">{label}</Text>
    </Pressable>
  );
}

function Section({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-text dark:text-text-dark">{title}</Text>
        {extra ? (
          <Text className="text-xs text-text-muted dark:text-text-muted-dark">{extra}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
