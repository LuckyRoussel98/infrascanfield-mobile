import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getInvoicesAccessible } from '@/api/endpoints/invoices';
import { EmptyState } from '@/components/EmptyState';
import { ObjectCard } from '@/components/ObjectCard';
import { SearchBar } from '@/components/SearchBar';
import { ObjectCardSkeletonList } from '@/components/Skeleton';
import { StatusFilter } from '@/components/StatusFilter';
import type { InvoiceRow } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: '0', label: 'Brouillon' },
  { value: '1', label: 'Validée' },
  { value: '2', label: 'Payée' },
  { value: '3', label: 'Abandonnée' },
];

const STATUS_VARIANTS: Record<number, 'neutral' | 'info' | 'success' | 'danger'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
  3: 'danger',
};

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState<string>('');

  const query = useInfiniteQuery({
    queryKey: ['invoices', 'accessible', status, submittedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getInvoicesAccessible({
        page: pageParam as number,
        limit: PAGE_SIZE,
        status: status || undefined,
        q: submittedSearch || undefined,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <View className="border-b border-border bg-background px-4 pt-3 dark:border-border-dark dark:bg-background-dark">
        <Text className="text-2xl font-bold text-text dark:text-text-dark">Factures</Text>
        <View className="mt-3">
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Réf, client..."
            onSubmit={() => setSubmittedSearch(search.trim())}
          />
        </View>
        <View className="mt-3 -mx-4 px-4 pb-2">
          <StatusFilter options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </View>
      </View>

      {query.isLoading ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <ObjectCardSkeletonList count={6} />
        </ScrollView>
      ) : query.isError ? (
        <EmptyState icon={Receipt} title={t('common.error')} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune facture"
          description={submittedSearch || status ? 'Aucun résultat pour ces filtres.' : undefined}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator />
              </View>
            ) : null
          }
          renderItem={({ item }: { item: InvoiceRow }) => (
            <ObjectCard
              ref={item.ref}
              title={item.soc_name}
              subtitle={formatDate(item.date)}
              rightLabel={formatCurrency(item.total_ttc)}
              statusLabel={
                item.paid === 1
                  ? 'Payée'
                  : STATUS_OPTIONS.find((o) => o.value === String(item.status))?.label
              }
              statusVariant={item.paid === 1 ? 'success' : (STATUS_VARIANTS[item.status] ?? 'neutral')}
              onPress={() => router.push(`/object/facture/${item.id}` as never)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
