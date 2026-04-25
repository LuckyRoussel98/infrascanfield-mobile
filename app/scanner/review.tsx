import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { RotateCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { logger } from '@/utils/logger';

/**
 * Review screen :
 *   - shows the captured/picked image
 *   - rotate 90° + retake actions
 *   - on Continue, hands the (possibly rotated) URI off to /scanner/validate
 *
 * Phase 2 will add proper crop handles and B&W filter.
 */
export default function ScannerReviewScreen() {
  const { uri, width, height, modulepart, object_id } = useLocalSearchParams<{
    uri?: string;
    width?: string;
    height?: string;
    modulepart?: string;
    object_id?: string;
  }>();
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';

  const [currentUri, setCurrentUri] = useState<string | null>(uri ?? null);
  const [busy, setBusy] = useState(false);

  if (!currentUri) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
        <ScreenHeader title={t('scanner.review_title')} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-text dark:text-text-dark">Aucune image.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onRotate = async () => {
    setBusy(true);
    try {
      const result = await ImageManipulator.manipulateAsync(currentUri, [{ rotate: 90 }], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setCurrentUri(result.uri);
    } catch (e) {
      logger.error('rotate failed', e);
    } finally {
      setBusy(false);
    }
  };

  const onRetake = () => {
    router.replace(`/scanner/capture?modulepart=${modulepart}&object_id=${object_id}` as never);
  };

  const onContinue = () => {
    router.push(
      `/scanner/validate?uri=${encodeURIComponent(currentUri)}&width=${width ?? ''}&height=${height ?? ''}&modulepart=${modulepart}&object_id=${object_id}` as never,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader title={t('scanner.review_title')} onBack={() => router.back()} />

      <View className="flex-1 items-center justify-center bg-black p-3">
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Image
            source={{ uri: currentUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        )}
      </View>

      <View className="border-t border-border bg-background p-4 dark:border-border-dark dark:bg-background-dark">
        <View className="mb-3 flex-row gap-2">
          <Pressable
            onPress={onRotate}
            disabled={busy}
            className="min-h-touch-min flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
          >
            <RotateCw size={18} color={iconColor} strokeWidth={1.75} />
            <Text className="text-sm font-semibold text-text dark:text-text-dark">
              {t('scanner.rotate')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onRetake}
            className="min-h-touch-min flex-1 items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-sm font-semibold text-text dark:text-text-dark">Refaire</Text>
          </Pressable>
        </View>
        <Button label="Continuer" variant="primary" onPress={onContinue} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}
