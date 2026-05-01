import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, FileText, ImageIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View, useColorScheme } from 'react-native';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';

/**
 * Capture entry point.
 *
 * For `scan_type=document`, hands off to the native Google ML Kit Document
 * Scanner via `react-native-document-scanner-plugin`. The scanner does
 * everything we used to fake on the review screen — edge detection,
 * auto-capture, 4-corner manual crop, B&W/grayscale filter, multi-page
 * stacking — and returns one or more cropped, processed JPEG file URIs.
 *
 * For `scan_type=equipment_photo`, the user wants a single geo-tagged
 * snapshot, not a document scan, so we keep the simpler `expo-image-picker`
 * camera launcher and let `validate.tsx` handle the geolocation overlay.
 *
 * NB: ML Kit Document Scanner is bundled in Google Play Services and
 * therefore only works in EAS dev/preview/production builds — not in the
 * Expo Go binary, which doesn't ship custom native code.
 */
export default function ScannerCaptureScreen() {
  const { modulepart, object_id, scan_type } = useLocalSearchParams<{
    modulepart?: string;
    object_id?: string;
    scan_type?: string;
  }>();
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';

  const isEquipmentPhoto = scan_type === 'equipment_photo';

  useEffect(() => {
    if (!modulepart || !object_id) {
      logger.warn('scanner/capture invoked without context');
    }
  }, [modulepart, object_id]);

  const goToValidate = (pages: string[]) => {
    if (pages.length === 0) return;
    router.replace(
      `/scanner/validate?pages=${encodeURIComponent(JSON.stringify(pages))}&modulepart=${modulepart}&object_id=${object_id}&scan_type=${scan_type ?? 'document'}` as never,
    );
  };

  const onScanDocument = async () => {
    haptic.light();
    try {
      const result = await DocumentScanner.scanDocument({
        // Cap to keep payloads bounded; the user can still split a long doc
        // across multiple scans.
        maxNumDocuments: 24,
        croppedImageQuality: 85,
        responseType: ResponseType.ImageFilePath,
      });
      if (
        result.status !== ScanDocumentResponseStatus.Success ||
        !result.scannedImages?.length
      ) {
        return;
      }
      haptic.medium();
      goToValidate(result.scannedImages);
    } catch (e) {
      logger.error('document scanner failed', e);
      haptic.error();
      Alert.alert(
        'Scanner indisponible',
        "Le module de scan natif n'est pas chargé. Cette fonction nécessite une build EAS (pas Expo Go).",
      );
    }
  };

  const onTakeEquipmentPhoto = async () => {
    haptic.light();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      haptic.error();
      Alert.alert('Permission caméra refusée', "Autorisez l'accès à l'appareil photo dans les réglages système.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ['images'],
      exif: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    haptic.medium();
    goToValidate([res.assets[0].uri]);
  };

  const onPickFromGallery = async () => {
    haptic.light();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      haptic.error();
      Alert.alert('Permission galerie refusée', "Autorisez l'accès à la galerie dans les réglages système.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: !isEquipmentPhoto,
      selectionLimit: isEquipmentPhoto ? 1 : 24,
      quality: 0.85,
      mediaTypes: ['images'],
      exif: false,
    });
    if (res.canceled || !res.assets?.length) return;
    haptic.medium();
    goToValidate(res.assets.map((a) => a.uri));
  };

  const onPrimary = isEquipmentPhoto ? onTakeEquipmentPhoto : onScanDocument;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEquipmentPhoto ? t('equipment.title') : t('scanner.title')}
        subtitle={`${modulepart ?? '—'} #${object_id ?? '—'}`}
        onBack={() => router.back()}
      />

      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          onPress={onPrimary}
          className="mb-4 h-32 w-32 items-center justify-center rounded-full bg-text active:opacity-80 dark:bg-text-dark"
        >
          {isEquipmentPhoto ? (
            <Camera size={48} color={scheme === 'dark' ? '#0a0a0a' : '#ffffff'} strokeWidth={1.75} />
          ) : (
            <FileText size={48} color={scheme === 'dark' ? '#0a0a0a' : '#ffffff'} strokeWidth={1.75} />
          )}
        </Pressable>
        <Text className="mb-2 text-base font-medium text-text dark:text-text-dark">
          {isEquipmentPhoto ? t('equipment.capture') : t('scanner.capture')}
        </Text>
        <Text className="mb-10 text-center text-sm text-text-muted dark:text-text-muted-dark">
          {isEquipmentPhoto ? t('equipment.instruction') : t('scanner.instruction')}
        </Text>

        <View className="w-full">
          <Button
            label={isEquipmentPhoto ? 'Prendre une photo' : 'Scanner un document'}
            variant="primary"
            onPress={onPrimary}
          />
          <View className="h-3" />
          <Pressable
            onPress={onPickFromGallery}
            className="min-h-touch-min flex-row items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 dark:border-border-dark"
          >
            <ImageIcon size={18} color={iconColor} strokeWidth={1.75} />
            <Text className="text-base font-semibold text-text dark:text-text-dark">
              {isEquipmentPhoto ? 'Choisir dans la galerie' : 'Importer des images'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
