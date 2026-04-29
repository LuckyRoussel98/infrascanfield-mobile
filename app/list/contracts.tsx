import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FileSignature } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getContractsAccessible } from '@/api/endpoints/contracts';
import { EmptyState } from '@/components/EmptyState';
import { ObjectCard } from '@/components/ObjectCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchBar } from '@/components/SearchBar';
import { StatusFilter } from '@/components/StatusFilter';
import type { ContractRow } from '@/types/api';
import { formatDate } from '@/utils/format';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: '0', label: 'Brouillon' },
  { value: '1', label: 'Validé' },
  { value: '2', label: 'Fermé' },
];

const STATUS_VARIANTS: Record<number, 'neutral' | 'info' | 'success'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
};

export default function ContractsScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState<string>('');

  const query = useInfiniteQuery({
    queryKey: ['contracts', 'accessible', status, submittedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getContractsAccessible({
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
      <ScreenHeader title="Contrats" onBack={() => router.back()} />
      <View className="border-b border-border bg-background px-4 py-3 dark:border-border-dark dark:bg-background-dark">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Réf, client..."
          onSubmit={() => setSubmittedSearch(search.trim())}
        />
        <View className="mt-3 -mx-4 px-4">
          <StatusFilter options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </View>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <EmptyState icon={FileSignature} title={t('common.error')} />
      ) : items.length === 0 ? (
        <EmptyState icon={FileSignature} title="Aucun contrat" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator />
              </View>
            ) : null
          }
          renderItem={({ item }: { item: ContractRow }) => (
            <ObjectCard
              ref={item.ref}
              title={item.soc_name}
              subtitle={`${item.ref_customer ? `${item.ref_customer} · ` : ''}${formatDate(item.date)}`}
              statusLabel={STATUS_OPTIONS.find((o) => o.value === String(item.status))?.label}
              statusVariant={STATUS_VARIANTS[item.status] ?? 'neutral'}
              onPress={() => router.push(`/object/contrat/${item.id}` as never)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
