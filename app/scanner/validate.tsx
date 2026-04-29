import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { toast } from '@/stores/toastStore';
import type { ModulePart } from '@/types/api';
import { generateUuid } from '@/utils/format';
import { logger } from '@/utils/logger';

const MODULEPART_LABEL: Record<ModulePart, string> = {
  facture: 'Facture',
  propal: 'Devis',
  ficheinter: 'Intervention',
  projet: 'Projet',
  contrat: 'Contrat',
};

function defaultFilename(modulepart: string, objectId: string) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `scan_${modulepart}_${objectId}_${ymd}.jpg`;
}

export default function ScannerValidateScreen() {
  const { uri, modulepart, object_id } = useLocalSearchParams<{
    uri?: string;
    modulepart?: string;
    object_id?: string;
  }>();
  const { t } = useTranslation();

  const [filename, setFilename] = useState(defaultFilename(modulepart ?? 'scan', object_id ?? '0'));
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ scan_log_id: number; idempotent: boolean } | null>(null);

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
      const res = await uploadDocument({
        modulepart: modulepart as ModulePart,
        object_id: Number(object_id),
        filename: filename || defaultFilename(modulepart, object_id),
        filedata: base64,
        scan_type: 'document',
        scanned_at: new Date().toISOString(),
        idempotency_key,
      });

      setDone({ scan_log_id: res.scan_log_id, idempotent: res.idempotent });
      toast.success(res.idempotent ? 'Déjà envoyé (dédup)' : 'Document envoyé ✓');
    } catch (e) {
      const apiErr = e as Partial<ApiError>;
      logger.warn('upload failed', apiErr);
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
      toast.error(msg, 4500);
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={t('scanner.validate_title')} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-2xl font-bold text-success">✓</Text>
          <Text className="mb-1 text-base font-semibold text-text dark:text-text-dark">
            Document envoyé
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
            label="Scanner autre"
            variant="secondary"
            onPress={() =>
              router.replace(`/scanner/capture?modulepart=${modulepart}&object_id=${object_id}` as never)
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader
        title={t('scanner.validate_title')}
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
