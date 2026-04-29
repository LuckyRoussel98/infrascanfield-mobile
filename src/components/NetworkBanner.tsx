import { CloudOff, UploadCloud } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSyncStore } from '@/stores/syncStore';

const BANNER_HEIGHT = 26;

/**
 * Slim status banner shown when the device is offline (or when the sync
 * worker is draining the outbox). Floats at the top of the screen, just
 * below the OS status bar. When connectivity is healthy and there's
 * nothing to sync, it collapses to zero height (no layout impact, no
 * pointer events — the content underneath is fully usable).
 *
 * Mounted globally from app/_layout.tsx so it overlays every screen
 * without each route having to wire it.
 */
export function NetworkBanner() {
  const online = useSyncStore((s) => s.online);
  const draining = useSyncStore((s) => s.draining);
  const counts = useSyncStore((s) => s.counts);
  const insets = useSafeAreaInsets();
  const pending = counts.pending + counts.sending + counts.error;

  const visible = !online || (draining && pending > 0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-BANNER_HEIGHT);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
    translateY.value = withTiming(visible ? 0 : -BANNER_HEIGHT, { duration: 220 });
  }, [visible, opacity, translateY]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const palette = online ? 'bg-info/15 border-info/40' : 'bg-warning/15 border-warning/40';
  const textColor = online ? 'text-info' : 'text-warning';
  const iconColor = online ? '#0284c7' : '#b45309';

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrapper, { top: insets.top }, wrapperStyle]}
      className={`border-b ${palette}`}
    >
      <View
        style={{ height: BANNER_HEIGHT }}
        className="flex-row items-center justify-center gap-2 px-3"
      >
        {online ? (
          <UploadCloud size={14} color={iconColor} />
        ) : (
          <CloudOff size={14} color={iconColor} />
        )}
        <Text className={`text-[11px] font-medium ${textColor}`}>
          {online
            ? `Synchronisation… ${pending} restant${pending > 1 ? 's' : ''}`
            : pending > 0
              ? `Hors-ligne — ${pending} en attente`
              : 'Hors-ligne'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 8,
  },
});
