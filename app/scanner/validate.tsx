import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
import { enqueue } from '@/db/outbox';
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

function defaultFilename(modulepart: string, objectId: string, scanType: ScanType) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const prefix = scanType === 'equipment_photo' ? 'photo_eq' : 'scan';
  return `${prefix}_${modulepart}_${objectId}_${ymd}.jpg`;
}

export default function ScannerValidateScreen() {
  const { uri, modulepart, object_id, scan_type } = useLocalSearchParams<{
    uri?: string;
    modulepart?: string;
    object_id?: string;
    scan_type?: string;
  }>();
  const { t } = useTranslation();

  const scanType: ScanType = scan_type === 'equipment_photo' ? 'equipment_photo' : 'document';
  const isEquipmentPhoto = scanType === 'equipment_photo';

  const [filename, setFilename] = useState(
    defaultFilename(modulepart ?? 'scan', object_id ?? '0', scanType),
  );
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ scan_log_id: number; idempotent: boolean } | null>(null);
  const [geo, setGeo] = useState<Geolocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'fetching' | 'ok' | 'denied' | 'unavailable'>(
    'idle',
  );

  // For equipment photos, kick off a one-shot geolocation fetch on mount.
  // Failure is non-blocking — the user can still send the photo without geo.
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

  if (!uri || !modulepart || !object_id) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={t('scanner.validate_title')} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-text dark:text-text-dark">Contexte de scan manquant.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onSend = async () => {
    setUploading(true);
    setErrorMsg(null);
    try {
      // Compress to roughly 1500px wide JPEG (good doc-readable balance) before encoding base64
      const compressed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1500 } }], {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const idempotency_key = generateUuid();
      const payload: UploadRequest = {
        modulepart: modulepart as ModulePart,
        object_id: Number(object_id),
        filename: filename || defaultFilename(modulepart, object_id, scanType),
        filedata: base64,
        scan_type: scanType,
        geolocation: geo,
        scanned_at: new Date().toISOString(),
        idempotency_key,
      };

      // Enqueue locally first so the work survives a crash/network failure
      // mid-flight. The server-side llx_infrasscanfield_scan_log uniqueness
      // on idempotency_key dedups any retry that actually reached it.
      await enqueue({
        op_type: 'documents.upload',
        idempotency_key,
        payload,
      });

      try {
        const res = await uploadDocument(payload);
        const { markSent, getByIdempotencyKey } = await import('@/db/outbox');
        const row = await getByIdempotencyKey(idempotency_key);
        if (row) await markSent(row.id);
        await refreshSyncCounts();

        setDone({ scan_log_id: res.scan_log_id, idempotent: res.idempotent });
        haptic.success();
        toast.success(
          res.idempotent
            ? 'Déjà envoyé (dédup)'
            : isEquipmentPhoto
              ? 'Photo équipement envoyée ✓'
              : 'Document envoyé ✓',
        );
      } catch (e) {
        const apiErr = e as Partial<ApiError>;
        // Network/timeout/5xx → keep in outbox, sync worker will retry.
        // 4xx (auth, permission, validation) → mark error, surface to user.
        const transient =
          !apiErr.status ||
          apiErr.status === 0 ||
          apiErr.status >= 500 ||
          apiErr.status === 408 ||
          apiErr.status === 429;

        const { markError, getByIdempotencyKey } = await import('@/db/outbox');
        const row = await getByIdempotencyKey(idempotency_key);
        if (row) await markError(row.id, apiErr.message ?? String(e), transient);
        await refreshSyncCounts();

        if (transient) {
          haptic.warning();
          toast.info('Hors-ligne — sera envoyé à la reconnexion');
          setDone({ scan_log_id: 0, idempotent: false });
          // Kick the worker so the moment connectivity comes back it tries again.
          void drainOutbox();
          return;
        }

        logger.warn('upload failed (non-retryable)', apiErr);
        let msg: string;
        if (apiErr.status === 413) {
          msg = 'Fichier trop volumineux (taille max dépassée).';
        } else if (apiErr.status === 403) {
          msg = "Vous n'avez pas la permission d'uploader sur cet objet.";
        } else if (apiErr.status === 404) {
          msg = 'Objet Dolibarr introuvable.';
        } else {
          msg = apiErr.message ?? t('common.error');
        }
        setErrorMsg(msg);
        haptic.error();
        toast.error(msg, 4500);
      }
    } catch (e) {
      logger.error('onSend pre-upload error', e);
      setErrorMsg((e as Error).message ?? t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={isEquipmentPhoto ? t('equipment.title') : t('scanner.validate_title')} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-2xl font-bold text-success">✓</Text>
          <Text className="mb-1 text-base font-semibold text-text dark:text-text-dark">
            {isEquipmentPhoto ? 'Photo envoyée' : 'Document envoyé'}
          </Text>
          <Text className="mb-6 text-sm text-text-muted dark:text-text-muted-dark">
            scan_log_id : {done.scan_log_id}
            {done.idempotent ? ' (déjà existant)' : ''}
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
        subtitle={`${MODULEPART_LABEL[modulepart as ModulePart] ?? modulepart} #${object_id}`}
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View className="mb-5 overflow-hidden rounded-2xl border border-border dark:border-border-dark">
            <Image source={{ uri }} style={{ width: '100%', height: 280 }} resizeMode="contain" />
          </View>

          {isEquipmentPhoto ? <GeoBadge status={geoStatus} geo={geo} t={t} /> : null}

          <TextField
            label={t('scanner.filename_label')}
            value={filename}
            onChangeText={setFilename}
            autoCapitalize="none"
            autoCorrect={false}
            helper="Extensions autorisées : pdf, png, jpg, jpeg, webp, heic, heif"
          />

          {errorMsg ? (
            <Text className="mb-4 text-sm font-medium text-danger">{errorMsg}</Text>
          ) : null}

          <Button
            label={uploading ? 'Envoi en cours…' : t('scanner.send')}
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
