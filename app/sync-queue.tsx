import { useFocusEffect, router } from 'expo-router';
import { CheckCircle2, CloudOff, RefreshCcw, Trash2, UploadCloud } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { clearAll, deleteRow, listAll, resetForRetry, type OutboxRow } from '@/db/outbox';
import { manualDrain, refreshSyncCounts } from '@/features/sync/worker';
import { toast } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';

export default function SyncQueueScreen() {
  const scheme = useColorScheme();
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';
  const online = useSyncStore((s) => s.online);
  const draining = useSyncStore((s) => s.draining);

  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listAll();
      setRows(all);
      await refreshSyncCounts();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onSendNow = async () => {
    if (!online) {
      toast.error('Hors-ligne — impossible d\'envoyer maintenant');
      return;
    }
    await manualDrain();
    await reload();
  };

  const onRetryRow = async (row: OutboxRow) => {
    await resetForRetry(row.id);
    if (online) await manualDrain();
    await reload();
  };

  const onDeleteRow = async (row: OutboxRow) => {
    await deleteRow(row.id);
    await reload();
  };

  const onClearAll = () => {
    Alert.alert('Vider la file', 'Supprimer toutes les opérations (envoyées et en attente) ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          await clearAll();
          await reload();
        },
      },
    ]);
  };

  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'sending');
  const errors = rows.filter((r) => r.status === 'error');
  const sent = rows.filter((r) => r.status === 'sent');

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <ScreenHeader
        title="File de synchronisation"
        subtitle={online ? 'En ligne' : 'Hors-ligne'}
        onBack={() => router.back()}
        right={
          <Pressable onPress={reload} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
            <RefreshCcw size={18} color={iconColor} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
          {online ? (
            <UploadCloud size={20} color={iconColor} />
          ) : (
            <CloudOff size={20} color={iconColor} />
          )}
          <View className="flex-1">
            <Text className="text-sm font-medium text-text dark:text-text-dark">
              {pending.length} en attente • {errors.length} en erreur • {sent.length} envoyé
              {sent.length === 1 ? '' : 's'}
            </Text>
            <Text className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
              {draining ? 'Synchronisation en cours…' : online ? 'Connecté' : 'En attente de connexion'}
            </Text>
          </View>
        </View>

        <View className="mb-4 flex-row gap-2">
          <View className="flex-1">
            <Button
              label={draining ? 'Envoi…' : 'Envoyer maintenant'}
              variant="primary"
              onPress={onSendNow}
              loading={draining}
              disabled={!online || pending.length + errors.length === 0}
            />
          </View>
          <Pressable
            onPress={onClearAll}
            className="min-h-touch-min items-center justify-center rounded-2xl border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <Trash2 size={18} color={iconColor} />
          </Pressable>
        </View>

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center rounded-2xl border border-border bg-surface p-8 dark:border-border-dark dark:bg-surface-dark">
            <CheckCircle2 size={32} color="#10b981" />
            <Text className="mt-3 text-sm text-text-muted dark:text-text-muted-dark">
              File vide — tout est synchronisé.
            </Text>
          </View>
        ) : (
          <>
            {pending.length > 0 ? (
              <SectionHeader title="En attente" count={pending.length} />
            ) : null}
            {pending.map((r) => (
              <OutboxRowItem key={r.id} row={r} onRetry={onRetryRow} onDelete={onDeleteRow} />
            ))}

            {errors.length > 0 ? (
              <SectionHeader title="En erreur" count={errors.length} />
            ) : null}
            {errors.map((r) => (
              <OutboxRowItem key={r.id} row={r} onRetry={onRetryRow} onDelete={onDeleteRow} />
            ))}

            {sent.length > 0 ? (
              <SectionHeader title="Récemment envoyés" count={sent.length} />
            ) : null}
            {sent.map((r) => (
              <OutboxRowItem key={r.id} row={r} onRetry={onRetryRow} onDelete={onDeleteRow} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
      {title} ({count})
    </Text>
  );
}

function OutboxRowItem({
  row,
  onRetry,
  onDelete,
}: {
  row: OutboxRow;
  onRetry: (r: OutboxRow) => void;
  onDelete: (r: OutboxRow) => void;
}) {
  const summary = summarizeRow(row);
  const tone =
    row.status === 'sent'
      ? 'text-success'
      : row.status === 'error'
        ? 'text-danger'
        : 'text-text-muted dark:text-text-muted-dark';

  return (
    <View className="mb-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-medium text-text dark:text-text-dark">
            {summary.title}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
            {summary.subtitle}
          </Text>
          <Text className={`mt-1 text-xs font-semibold ${tone}`}>
            {labelFor(row.status)}
            {row.retry_count > 0 ? ` • tentative ${row.retry_count + 1}` : ''}
          </Text>
          {row.last_error ? (
            <Text numberOfLines={2} className="mt-1 text-xs text-danger">
              {row.last_error}
            </Text>
          ) : null}
        </View>
      </View>
      {row.status !== 'sending' ? (
        <View className="mt-2 flex-row gap-2">
          {row.status === 'error' || row.status === 'pending' ? (
            <Pressable
              onPress={() => onRetry(row)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 active:opacity-70 dark:border-border-dark dark:bg-background-dark"
            >
              <Text className="text-xs font-semibold text-text dark:text-text-dark">Réessayer</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onDelete(row)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 active:opacity-70 dark:border-border-dark dark:bg-background-dark"
          >
            <Text className="text-xs font-semibold text-text dark:text-text-dark">Supprimer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function summarizeRow(row: OutboxRow): { title: string; subtitle: string } {
  try {
    const p = JSON.parse(row.payload) as {
      modulepart?: string;
      object_id?: number;
      filename?: string;
      scan_type?: string;
    };
    return {
      title: p.filename ?? row.op_type,
      subtitle: `${p.modulepart ?? '?'} #${p.object_id ?? '?'} • ${p.scan_type ?? 'document'}`,
    };
  } catch {
    return { title: row.op_type, subtitle: row.idempotency_key };
  }
}

function labelFor(status: OutboxRow['status']): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'sending':
      return 'Envoi en cours…';
    case 'sent':
      return 'Envoyé ✓';
    case 'error':
      return 'Erreur (retries épuisés)';
  }
}
