import { useEffect } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

import { useToastStore } from '@/stores/toastStore';

/**
 * Root-mounted toast renderer. Listens to useToastStore and animates a small banner
 * at the top of the screen. Tap to dismiss.
 */
export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  const scheme = useColorScheme();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (current) {
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(-20, { duration: 200 });
    }
  }, [current, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!current) return null;

  const isDark = scheme === 'dark';

  const variantClass = {
    success: isDark
      ? 'bg-green-900 border-green-700'
      : 'bg-green-50 border-green-300',
    error: isDark
      ? 'bg-red-900 border-red-700'
      : 'bg-red-50 border-red-300',
    info: isDark
      ? 'bg-surface-dark border-border-dark'
      : 'bg-surface border-border',
  }[current.variant];

  const labelClass = {
    success: 'text-green-700 dark:text-green-200',
    error: 'text-red-700 dark:text-red-200',
    info: 'text-text dark:text-text-dark',
  }[current.variant];

  return (
    <SafeAreaView pointerEvents="box-none" edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
      <Animated.View style={animatedStyle} className="px-4">
        <Pressable
          onPress={dismiss}
          className={`mt-2 rounded-2xl border px-4 py-3 active:opacity-70 ${variantClass}`}
        >
          <View className="flex-row items-start gap-2">
            <Text className={`flex-1 text-sm font-medium ${labelClass}`}>{current.message}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
