import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { logger } from '@/utils/logger';

/**
 * Phase 1 scanner — pragmatic approach :
 *   - opens the system camera (expo-image-picker.launchCameraAsync) for capture
 *   - or pulls an existing image from the gallery
 *   - hands off to /scanner/review with the local URI
 *
 * Real document edge detection (live overlay) lands in Phase 2 with
 * react-native-vision-camera + a dev build. For now, the user crops/rotates on
 * the review screen.
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

  const handleResult = (uri: string, width: number, height: number) => {
    router.replace(
      `/scanner/review?uri=${encodeURIComponent(uri)}&width=${width}&height=${height}&modulepart=${modulepart}&object_id=${object_id}&scan_type=${scan_type ?? 'document'}` as never,
    );
  };

  const onTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
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
    const asset = res.assets[0];
    handleResult(asset.uri, asset.width, asset.height);
  };

  const onPickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission galerie refusée', "Autorisez l'accès à la galerie dans les réglages système.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ['images'],
      exif: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    handleResult(asset.uri, asset.width, asset.height);
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEquipmentPhoto ? t('equipment.title') : t('scanner.title')}
        subtitle={`${modulepart ?? '—'} #${object_id ?? '—'}`}
        onBack={() => router.back()}
      />

      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          onPress={onTakePhoto}
          className="mb-4 h-32 w-32 items-center justify-center rounded-full bg-text active:opacity-80 dark:bg-text-dark"
        >
          <Camera size={48} color={scheme === 'dark' ? '#0a0a0a' : '#ffffff'} strokeWidth={1.75} />
        </Pressable>
        <Text className="mb-2 text-base font-medium text-text dark:text-text-dark">
          {isEquipmentPhoto ? t('equipment.capture') : t('scanner.capture')}
        </Text>
        <Text className="mb-10 text-center text-sm text-text-muted dark:text-text-muted-dark">
          {isEquipmentPhoto ? t('equipment.instruction') : t('scanner.instruction')}
        </Text>

        <View className="w-full">
          <Button label="Prendre une photo" variant="primary" onPress={onTakePhoto} />
          <View className="h-3" />
          <Pressable
            onPress={onPickFromGallery}
            className="min-h-touch-min flex-row items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 dark:border-border-dark"
          >
            <ImageIcon size={18} color={iconColor} strokeWidth={1.75} />
            <Text className="text-base font-semibold text-text dark:text-text-dark">
              Choisir dans la galerie
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
