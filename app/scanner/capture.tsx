import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';

/**
 * Scanner capture screen — placeholder for Step 9.
 * Receives the upload context (modulepart + object_id) via query params.
 * The real implementation will use react-native-vision-camera with edge
 * detection ; for now we just acknowledge the context so the navigation
 * chain can be tested end-to-end.
 */
export default function ScannerCaptureScreen() {
  const { modulepart, object_id } = useLocalSearchParams<{
    modulepart?: string;
    object_id?: string;
  }>();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <ScreenHeader title="Scanner" subtitle={`${modulepart ?? '—'} #${object_id ?? '—'}`} onBack={() => router.back()} />
      <View className="flex-1 items-center justify-center px-6">
        <Camera size={48} color="#a3a3a3" strokeWidth={1.5} />
        <Text className="mt-4 text-base font-medium text-text dark:text-text-dark">
          Caméra à venir
        </Text>
        <Text className="mt-1 text-center text-sm text-text-muted dark:text-text-muted-dark">
          La capture document avec détection des bords est implémentée à l&apos;étape 9.
        </Text>
        <View className="mt-8 w-full">
          <Button label="Retour" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
