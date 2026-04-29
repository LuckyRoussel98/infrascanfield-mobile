import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, FileText, Image as ImageIcon, RefreshCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getObjectDetail } from '@/api/endpoints/object';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from '@/stores/toastStore';
import type {
  ContratHeader,
  FactureHeader,
  FicheinterHeader,
  ModulePart,
  ObjectDetailResponse,
  ObjectDocument,
  ObjectLine,
  ObjectScanLog,
  ProjetHeader,
  PropalHeader,
} from '@/types/api';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatRelativeDateTime,
} from '@/utils/format';

const ALLOWED: ModulePart[] = ['facture', 'propal', 'ficheinter', 'projet', 'contrat'];

const STATUS_VARIANTS: Record<number, 'neutral' | 'warning' | 'info' | 'success'> = {
  0: 'neutral',
  1: 'info',
  2: 'success',
  3: 'success',
};

const BILLING_TYPES: ModulePart[] = ['facture', 'propal', 'contrat'];

type TabKey = 'details' | 'documents' | 'lines';

export default function ObjectDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const { t } = useTranslation();
  const scheme = useColorScheme();

  const isAllowed = ALLOWED.includes(type as ModulePart);
  const objectId = Number(id);
  const modulepart = type as ModulePart;

  const detailQuery = useQuery<ObjectDetailResponse>({
    queryKey: ['object-detail', modulepart, objectId],
    queryFn: () => getObjectDetail(modulepart, objectId),
    enabled: isAllowed && Number.isFinite(objectId) && objectId > 0,
  });

  const hasLines = BILLING_TYPES.includes(modulepart);
  const [activeTab, setActiveTab] = useState<TabKey>('details');

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

  const refLabel = detailQuery.data?.ref ?? `${type} #${id}`;
  const subtitleLabel = detailQuery.data?.header.soc_name || (type as string);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <ScreenHeader
        title={refLabel}
        subtitle={subtitleLabel}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => detailQuery.refetch()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
          >
            <RefreshCcw
              size={20}
              color={scheme === 'dark' ? '#fafafa' : '#0a0a0a'}
            />
          </Pressable>
        }
      />

      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'details', label: t('detail.tab_details') },
          { key: 'documents', label: t('detail.tab_documents') },
          ...(hasLines ? [{ key: 'lines' as const, label: t('detail.tab_lines') }] : []),
        ]}
      />

      {detailQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : detailQuery.isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-sm text-danger">{t('common.error')}</Text>
          <Pressable onPress={() => detailQuery.refetch()} className="mt-3">
            <Text className="text-sm font-semibold text-danger">{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : detailQuery.data ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
          {activeTab === 'details' ? (
            <DetailsTab data={detailQuery.data} t={t} />
          ) : activeTab === 'documents' ? (
            <DocumentsTab data={detailQuery.data} t={t} />
          ) : (
            <LinesTab data={detailQuery.data} t={t} />
          )}
        </ScrollView>
      ) : null}

      <Pressable
        onPress={onScan}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-text shadow-lg active:opacity-80 dark:bg-text-dark"
      >
        <Camera size={26} color={scheme === 'dark' ? '#0a0a0a' : '#ffffff'} />
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────

function TabBar<K extends string>({
  active,
  onChange,
  tabs,
}: {
  active: K;
  onChange: (k: K) => void;
  tabs: { key: K; label: string }[];
}) {
  return (
    <View className="flex-row border-b border-border bg-background dark:border-border-dark dark:bg-background-dark">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={`flex-1 items-center py-3 ${isActive ? 'border-b-2 border-text dark:border-text-dark' : ''}`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? 'text-text dark:text-text-dark' : 'text-text-muted dark:text-text-muted-dark'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Details tab ───────────────────────────────────────────────────────

type TFn = (key: string, options?: Record<string, unknown>) => string;

function DetailsTab({ data, t }: { data: ObjectDetailResponse; t: TFn }) {
  const statusVariant = STATUS_VARIANTS[data.header.status] ?? 'neutral';
  const statusLabel = useMemo(() => statusLabelFor(data.type, data.header.status, t), [data.type, data.header.status, t]);

  return (
    <View>
      <Section title={t('detail.section_reference')}>
        <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-text dark:text-text-dark">{data.ref}</Text>
            {statusLabel ? <StatusBadge label={statusLabel} variant={statusVariant} /> : null}
          </View>
          {data.header.soc_name ? (
            <Text className="text-sm text-text-muted dark:text-text-muted-dark">
              {data.header.soc_name}
            </Text>
          ) : null}
        </View>
      </Section>

      <Section title={t('detail.section_summary')}>
        <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <DetailFields data={data} t={t} />
        </View>
      </Section>

      {data.header.note_public ? (
        <Section title={t('detail.field_note_public')}>
          <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm text-text dark:text-text-dark">{data.header.note_public}</Text>
          </View>
        </Section>
      ) : null}

      <Section title={t('detail.scan_logs_title')}>
        {data.scan_logs.length === 0 ? (
          <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm text-text-muted dark:text-text-muted-dark">
              {t('detail.scan_logs_empty')}
            </Text>
          </View>
        ) : (
          data.scan_logs.map((log) => <ScanLogRow key={log.rowid} log={log} />)
        )}
      </Section>
    </View>
  );
}

function DetailFields({ data, t }: { data: ObjectDetailResponse; t: TFn }) {
  switch (data.type) {
    case 'facture': {
      const h = data.header as FactureHeader;
      return (
        <>
          <KV label={t('detail.field_date')} value={formatDate(h.date)} />
          <KV label={t('detail.field_due_date')} value={formatDate(h.date_lim_reglement)} />
          <KV label={t('detail.field_total_ht')} value={formatCurrency(h.total_ht)} />
          <KV label={t('detail.field_total_tva')} value={formatCurrency(h.total_tva)} />
          <KV label={t('detail.field_total_ttc')} value={formatCurrency(h.total_ttc)} />
          <KV
            label={t('detail.field_paid')}
            value={h.paid === 1 ? t('invoices.paid') : t('invoices.unpaid')}
          />
        </>
      );
    }
    case 'propal': {
      const h = data.header as PropalHeader;
      return (
        <>
          <KV label={t('detail.field_date')} value={formatDate(h.date)} />
          <KV label={t('detail.field_validity')} value={formatDate(h.fin_validite)} />
          <KV label={t('detail.field_total_ht')} value={formatCurrency(h.total_ht)} />
          <KV label={t('detail.field_total_tva')} value={formatCurrency(h.total_tva)} />
          <KV label={t('detail.field_total_ttc')} value={formatCurrency(h.total_ttc)} />
        </>
      );
    }
    case 'ficheinter': {
      const h = data.header as FicheinterHeader;
      return (
        <>
          <KV label={t('detail.field_date')} value={formatRelativeDateTime(h.date_valid ?? h.date_creation)} />
          <KV
            label={t('detail.field_duration')}
            value={h.duration > 0 ? formatDuration(h.duration) : '—'}
          />
          <KV label={t('detail.field_description')} value={h.description || '—'} multiline />
        </>
      );
    }
    case 'projet': {
      const h = data.header as ProjetHeader;
      return (
        <>
          <KV label={t('detail.field_title')} value={h.title || '—'} />
          <KV label={t('detail.field_date_start')} value={formatDate(h.date_start)} />
          <KV label={t('detail.field_date_end')} value={formatDate(h.date_end)} />
          {h.opp_amount > 0 ? (
            <KV label={t('detail.field_opp_amount')} value={formatCurrency(h.opp_amount)} />
          ) : null}
          {h.description ? (
            <KV label={t('detail.field_description')} value={h.description} multiline />
          ) : null}
        </>
      );
    }
    case 'contrat': {
      const h = data.header as ContratHeader;
      return (
        <>
          {h.ref_customer ? (
            <KV label={t('detail.field_ref_customer')} value={h.ref_customer} />
          ) : null}
          <KV label={t('detail.field_date')} value={formatDate(h.date)} />
        </>
      );
    }
    default:
      return null;
  }
}

function statusLabelFor(type: ModulePart, status: number, t: TFn): string {
  if (type === 'facture') {
    return t(`invoices.status_${status}` as never, { defaultValue: '' });
  }
  if (type === 'ficheinter') {
    return t(`interventions.status_${status}` as never, { defaultValue: '' });
  }
  return '';
}

// ─── Documents tab ─────────────────────────────────────────────────────

function DocumentsTab({ data, t }: { data: ObjectDetailResponse; t: TFn }) {
  if (data.documents.length === 0) {
    return (
      <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <Text className="text-sm text-text-muted dark:text-text-muted-dark">
          {t('detail.documents_empty')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-3 text-xs text-text-muted dark:text-text-muted-dark">
        {t('detail.documents_count', { count: data.documents.length })}
      </Text>
      {data.documents.map((doc) => (
        <DocumentRow key={doc.file_path} doc={doc} t={t} />
      ))}
    </View>
  );
}

function DocumentRow({ doc, t }: { doc: ObjectDocument; t: TFn }) {
  const isImage = doc.mime?.startsWith('image/');
  const Icon = isImage ? ImageIcon : FileText;
  const iconColor = '#6b7280';

  const onOpen = () => {
    // In-app preview is wired via a streaming endpoint in a later bloc — for now
    // just acknowledge the tap so the user gets immediate feedback.
    toast.info(`${doc.name} • ${formatBytes(doc.size)}`);
  };

  return (
    <Pressable
      onPress={onOpen}
      className="mb-2 flex-row items-center rounded-2xl border border-border bg-surface p-4 active:opacity-70 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background dark:bg-background-dark">
        <Icon size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-text dark:text-text-dark">
          {doc.name}
        </Text>
        <Text className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
          {formatBytes(doc.size)} • {doc.modified}
        </Text>
      </View>
      <Text className="ml-2 text-xs font-semibold text-text-muted dark:text-text-muted-dark">
        {t('detail.open_document')}
      </Text>
    </Pressable>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ScanLogRow({ log }: { log: ObjectScanLog }) {
  return (
    <View className="mb-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <Text numberOfLines={1} className="text-sm font-medium text-text dark:text-text-dark">
        {log.filename}
      </Text>
      <Text className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
        {formatBytes(log.filesize)} • {log.uploaded_at}
      </Text>
    </View>
  );
}

// ─── Lines tab ─────────────────────────────────────────────────────────

function LinesTab({ data, t }: { data: ObjectDetailResponse; t: TFn }) {
  if (data.lines.length === 0) {
    return (
      <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <Text className="text-sm text-text-muted dark:text-text-muted-dark">
          {t('detail.lines_empty')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {data.lines.map((line) => (
        <LineRow key={line.id} line={line} />
      ))}
    </View>
  );
}

function LineRow({ line }: { line: ObjectLine }) {
  const title = line.product_label || line.product_ref || (line.fk_product ? `#${line.fk_product}` : '—');
  return (
    <View className="mb-2 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text numberOfLines={2} className="text-sm font-semibold text-text dark:text-text-dark">
            {title}
          </Text>
          {line.description ? (
            <Text
              numberOfLines={3}
              className="mt-1 text-xs text-text-muted dark:text-text-muted-dark"
            >
              {line.description}
            </Text>
          ) : null}
        </View>
        <Text className="text-sm font-semibold text-text dark:text-text-dark">
          {formatCurrency(line.total_ttc)}
        </Text>
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-xs text-text-muted dark:text-text-muted-dark">
          {line.qty} × {formatCurrency(line.subprice)}
          {line.tva_tx > 0 ? ` • TVA ${line.tva_tx}%` : ''}
          {line.remise_percent > 0 ? ` • -${line.remise_percent}%` : ''}
        </Text>
        <Text className="text-xs text-text-muted dark:text-text-muted-dark">
          HT {formatCurrency(line.total_ht)}
        </Text>
      </View>
    </View>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────

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

function KV({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View
      className={
        multiline
          ? 'border-b border-border/40 px-1 py-2 last:border-b-0 dark:border-border-dark/40'
          : 'flex-row items-center justify-between border-b border-border/40 px-1 py-2 last:border-b-0 dark:border-border-dark/40'
      }
    >
      <Text
        className={
          multiline
            ? 'mb-1 text-xs font-medium text-text-muted dark:text-text-muted-dark'
            : 'flex-1 pr-3 text-sm text-text dark:text-text-dark'
        }
      >
        {label}
      </Text>
      {multiline ? (
        <Text className="text-sm text-text dark:text-text-dark">{value}</Text>
      ) : (
        <Text
          numberOfLines={1}
          className="max-w-[60%] text-right text-sm text-text-muted dark:text-text-muted-dark"
        >
          {value}
        </Text>
      )}
    </View>
  );
}
