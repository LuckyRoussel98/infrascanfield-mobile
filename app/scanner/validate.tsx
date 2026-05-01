import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadDocument } from '@/api/endpoints/documents';
import type { ApiError } from '@/api/client';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { enqueue, getByIdempotencyKey, markError, markSent } from '@/db/outbox';
import { drainOutbox, refreshSyncCounts } from '@/features/sync/worker';
import { toast } from '@/stores/toastStore';
import type { Geolocation, ModulePart, ScanType, UploadRequest } from '@/types/api';
import { generateUuid } from '@/utils/format';
import { getCurrentPosition } from '@/utils/geolocation';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';

const MODULEPART_LABEL: Record<ModulePart, string> = {
  facture: 'Facture',
  propal: 'Devis',
  ficheinter: 'Intervention',
  projet: 'Projet',
  contrat: 'Contrat',
};

function defaultBaseFilename(modulepart: string, objectId: string, scanType: ScanType) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const prefix = scanType === 'equipment_photo' ? 'photo_eq' : 'scan';
  return `${prefix}_${modulepart}_${objectId}_${ymd}`;
}

/** Insert `_pN` before the extension when uploading a multi-page set. */
function pageFilename(base: string, pageIndex: number, totalPages: number): string {
  const cleaned = base.replace(/\.(jpe?g|png|webp|heic|heif|pdf)$/i, '');
  const suffix = totalPages > 1 ? `_p${String(pageIndex + 1).padStart(2, '0')}` : '';
  return `${cleaned}${suffix}.jpg`;
}

interface SendState {
  total: number;
  done: number;
  errors: { page: number; message: string }[];
  queued: number;
}

export default function ScannerValidateScreen() {
  const { uri, pages, modulepart, object_id, scan_type } = useLocalSearchParams<{
    uri?: string;
    pages?: string;
    modulepart?: string;
    object_id?: string;
    scan_type?: string;
  }>();
  const { t } = useTranslation();

  const scanType: ScanType = scan_type === 'equipment_photo' ? 'equipment_photo' : 'document';
  const isEquipmentPhoto = scanType === 'equipment_photo';

  // The capture screen passes `pages` (JSON array of URIs); the legacy review
  // screen still passes a single `uri`. Accept either.
  const pageUris: string[] = useMemo(() => {
    if (pages) {
      try {
        const parsed = JSON.parse(pages);
        if (Array.isArray(parsed)) return parsed.filter((p): p is string => typeof p === 'string');
      } catch {
        logger.warn('validate: failed to parse pages query param');
      }
    }
    return uri ? [uri] : [];
  }, [pages, uri]);

  const [filename, setFilename] = useState(() =>
    defaultBaseFilename(modulepart ?? 'scan', object_id ?? '0', scanType),
  );
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState | null>(null);
  const [done, setDone] = useState<{ pagesSent: number; pagesQueued: number } | null>(null);
  const [geo, setGeo] = useState<Geolocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'fetching' | 'ok' | 'denied' | 'unavailable'>(
    'idle',
  );

  // For equipment photos, kick off a one-shot geolocation fetch on mount.
  useEffect(() => {
    if (!isEquipmentPhoto) return;
    let cancelled = false;
    setGeoStatus('fetching');
    (async () => {
      const res = await getCurrentPosition();
      if (cancelled) return;
      if (res.ok) {
        setGeo(res.coords);
        setGeoStatus('ok');
      } else if (res.reason === 'permission_denied') {
        setGeoStatus('denied');
      } else {
        setGeoStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEquipmentPhoto]);

  if (pageUris.length === 0 || !modulepart || !object_id) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={t('scanner.validate_title')} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-text dark:text-text-dark">Contexte de scan manquant.</Text>
        </View>
      </SafeAreaView>
    );
  }

  /** Process a single page: compress, base64-encode, enqueue, attempt send. */
  const sendOnePage = async (
    pageUri: string,
    pageIndex: number,
    totalPages: number,
  ): Promise<'sent' | 'queued' | { error: string }> => {
    const compressed = await ImageManipulator.manipulateAsync(
      pageUri,
      [{ resize: { width: 1500 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const idempotency_key = generateUuid();
    const payload: UploadRequest = {
      modulepart: modulepart as ModulePart,
      object_id: Number(object_id),
      filename: pageFilename(filename, pageIndex, totalPages),
      filedata: base64,
      scan_type: scanType,
      geolocation: geo,
      scanned_at: new Date().toISOString(),
      idempotency_key,
    };

    await enqueue({ op_type: 'documents.upload', idempotency_key, payload });

    try {
      await uploadDocument(payload);
      const row = await getByIdempotencyKey(idempotency_key);
      if (row) await markSent(row.id);
      return 'sent';
    } catch (e) {
      const apiErr = e as Partial<ApiError>;
      const transient =
        !apiErr.status ||
        apiErr.status === 0 ||
        apiErr.status >= 500 ||
        apiErr.status === 408 ||
        apiErr.status === 429;
      const row = await getByIdempotencyKey(idempotency_key);
      if (row) await markError(row.id, apiErr.message ?? String(e), transient);
      if (transient) return 'queued';
      const fallback =
        apiErr.status === 413
          ? 'Fichier trop volumineux.'
          : apiErr.status === 403
            ? "Permission refusée."
            : apiErr.status === 404
              ? 'Objet introuvable.'
              : (apiErr.message ?? t('common.error'));
      return { error: fallback };
    }
  };

  const onSend = async () => {
    setUploading(true);
    setErrorMsg(null);
    const total = pageUris.length;
    const initial: SendState = { total, done: 0, errors: [], queued: 0 };
    setSendState(initial);

    let cumulative = initial;
    for (let i = 0; i < pageUris.length; i++) {
      try {
        const pageUri = pageUris[i];
        if (!pageUri) continue;
        const result = await sendOnePage(pageUri, i, total);
        if (result === 'sent') {
          cumulative = { ...cumulative, done: cumulative.done + 1 };
        } else if (result === 'queued') {
          cumulative = { ...cumulative, queued: cumulative.queued + 1 };
        } else {
          cumulative = {
            ...cumulative,
            errors: [...cumulative.errors, { page: i + 1, message: result.error }],
          };
        }
        setSendState(cumulative);
      } catch (e) {
        logger.error(`page ${i + 1} pre-upload error`, e);
        cumulative = {
          ...cumulative,
          errors: [...cumulative.errors, { page: i + 1, message: (e as Error).message }],
        };
        setSendState(cumulative);
      }
    }

    await refreshSyncCounts();

    const { done: sent, queued, errors } = cumulative;
    if (errors.length === total) {
      haptic.error();
      setErrorMsg(`Échec : ${errors.map((e) => `p${e.page} (${e.message})`).join(', ')}`);
      toast.error('Aucune page envoyée');
    } else {
      if (queued > 0) haptic.warning();
      else haptic.success();

      const summary =
        queued > 0
          ? `${sent}/${total} envoyées, ${queued} en file (reconnexion)`
          : isEquipmentPhoto
            ? 'Photo équipement envoyée ✓'
            : total > 1
              ? `${sent} pages envoyées ✓`
              : 'Document envoyé ✓';
      toast.success(summary);
      setDone({ pagesSent: sent, pagesQueued: queued });
      if (queued > 0) void drainOutbox();
    }

    setUploading(false);
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={isEquipmentPhoto ? t('equipment.title') : t('scanner.validate_title')} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-2xl font-bold text-success">✓</Text>
          <Text className="mb-1 text-base font-semibold text-text dark:text-text-dark">
            {isEquipmentPhoto
              ? 'Photo envoyée'
              : pageUris.length > 1
                ? `${pageUris.length} pages traitées`
                : 'Document envoyé'}
          </Text>
          <Text className="mb-6 text-sm text-text-muted dark:text-text-muted-dark">
            {done.pagesSent} envoyée{done.pagesSent > 1 ? 's' : ''}
            {done.pagesQueued > 0 ? ` • ${done.pagesQueued} en file` : ''}
          </Text>
          <Button
            label="OK"
            variant="primary"
            onPress={() => router.replace(`/object/${modulepart}/${object_id}` as never)}
          />
          <View className="h-3" />
          <Button
            label={isEquipmentPhoto ? 'Photographier autre' : 'Scanner autre'}
            variant="secondary"
            onPress={() =>
              router.replace(
                `/scanner/capture?modulepart=${modulepart}&object_id=${object_id}&scan_type=${scanType}` as never,
              )
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEquipmentPhoto ? t('equipment.title') : t('scanner.validate_title')}
        subtitle={`${MODULEPART_LABEL[modulepart as ModulePart] ?? modulepart} #${object_id} • ${pageUris.length} page${pageUris.length > 1 ? 's' : ''}`}
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <PagePreview pageUris={pageUris} />

          {isEquipmentPhoto ? <GeoBadge status={geoStatus} geo={geo} t={t} /> : null}

          <TextField
            label={t('scanner.filename_label')}
            value={filename}
            onChangeText={setFilename}
            autoCapitalize="none"
            autoCorrect={false}
            helper={
              pageUris.length > 1
                ? `Suffixe automatique _p01, _p02… ajouté pour chaque page`
                : 'Extensions autorisées : pdf, png, jpg, jpeg, webp, heic, heif'
            }
          />

          {errorMsg ? (
            <Text className="mb-4 text-sm font-medium text-danger">{errorMsg}</Text>
          ) : null}

          <Button
            label={
              uploading
                ? sendState
                  ? `Envoi page ${sendState.done + sendState.queued + sendState.errors.length + 1}/${sendState.total}…`
                  : 'Envoi…'
                : pageUris.length > 1
                  ? `Envoyer ${pageUris.length} pages`
                  : t('scanner.send')
            }
            variant="primary"
            onPress={onSend}
            loading={uploading}
          />

          {uploading ? (
            <View className="mt-3 flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm text-text-muted dark:text-text-muted-dark">
                Compression et envoi…
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PagePreview({ pageUris }: { pageUris: string[] }) {
  if (pageUris.length === 1) {
    return (
      <View className="mb-5 overflow-hidden rounded-2xl border border-border dark:border-border-dark">
        <Image source={{ uri: pageUris[0] }} style={{ width: '100%', height: 280 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      className="mb-5"
    >
      {pageUris.map((u, i) => (
        <View
          key={`${u}-${i}`}
          className="overflow-hidden rounded-2xl border border-border dark:border-border-dark"
          style={{ width: 140, height: 200 }}
        >
          <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5">
            <Text className="text-[10px] font-semibold text-white">p{i + 1}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function GeoBadge({
  status,
  geo,
  t,
}: {
  status: 'idle' | 'fetching' | 'ok' | 'denied' | 'unavailable';
  geo: Geolocation | null;
  t: (k: string) => string;
}) {
  let body: string;
  let tone: 'muted' | 'success' | 'warning';
  if (status === 'fetching') {
    body = t('equipment.geo_fetching');
    tone = 'muted';
  } else if (status === 'ok' && geo) {
    body = `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} (±${Math.round(geo.accuracy)} m)`;
    tone = 'success';
  } else if (status === 'denied') {
    body = t('equipment.geo_denied');
    tone = 'warning';
  } else if (status === 'unavailable') {
    body = t('equipment.geo_unavailable');
    tone = 'warning';
  } else {
    body = t('equipment.geo_idle');
    tone = 'muted';
  }
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-text-muted dark:text-text-muted-dark';
  return (
    <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark">
      <MapPin size={16} color="#6b7280" />
      <Text className={`flex-1 text-xs ${toneClass}`}>{body}</Text>
    </View>
  );
}
