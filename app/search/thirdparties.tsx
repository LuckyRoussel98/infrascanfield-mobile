import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchThirdparties } from '@/api/endpoints/thirdparties';
import { EmptyState } from '@/components/EmptyState';
import { ObjectCard } from '@/components/ObjectCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchBar } from '@/components/SearchBar';
import { StatusFilter } from '@/components/StatusFilter';
import type { ThirdpartyRow } from '@/types/api';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'customer', label: 'Clients' },
  { value: 'supplier', label: 'Fournisseurs' },
];

export default function ThirdpartiesSearchScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState<string>('');

  // Debounced search-as-you-type (350 ms) to avoid hammering the server while typing.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  const enabled = debouncedSearch.length >= 2;

  const query = useQuery({
    queryKey: ['thirdparties', 'search', debouncedSearch, type],
    queryFn: () =>
      searchThirdparties({
        q: debouncedSearch,
        type: (type || '') as 'customer' | 'supplier' | '',
        page: 0,
        limit: 50,
      }),
    enabled,
  });

  const items = query.data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <ScreenHeader title="Rechercher un tiers" onBack={() => router.back()} />
      <View className="border-b border-border bg-background px-4 py-3 dark:border-border-dark dark:bg-background-dark">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Nom, code, email, téléphone..."
        />
        <View className="mt-3 -mx-4 px-4">
          <StatusFilter options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>
        {!enabled ? (
          <Text className="mt-2 text-xs text-text-muted dark:text-text-muted-dark">
            Saisissez au moins 2 caractères pour lancer la recherche.
          </Text>
        ) : null}
      </View>

      {!enabled ? (
        <EmptyState icon={Building2} title="Recherche tiers" description="Saisissez ≥ 2 caractères." />
      ) : query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <EmptyState icon={Building2} title="Erreur" />
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun résultat" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }: { item: ThirdpartyRow }) => {
            const subtitleParts = [item.code_client || item.code_supplier, [item.zip, item.town].filter(Boolean).join(' ')]
              .filter((p): p is string => !!p && p.length > 0);
            return (
              <ObjectCard
                ref={item.name}
                title={item.email || item.phone || ''}
                subtitle={subtitleParts.join(' · ')}
                statusLabel={
                  item.is_customer && item.is_supplier
                    ? 'Client + Fourn.'
                    : item.is_customer
                      ? 'Client'
                      : item.is_supplier
                        ? 'Fournisseur'
                        : undefined
                }
                statusVariant="info"
                onPress={() => {}}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
