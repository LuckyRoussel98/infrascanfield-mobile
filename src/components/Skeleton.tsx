import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  className?: string;
  style?: ViewStyle;
}

/**
 * Pulsing placeholder block. Stack/compose them to mimic the shape of
 * the content being loaded. Animation is driven on the UI thread so it
 * stays smooth even while the JS thread is busy hydrating data.
 */
export function Skeleton({ width = '100%', height = 16, className, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: 8 },
        style,
        animatedStyle,
      ]}
      className={`bg-text-muted/20 dark:bg-text-muted-dark/20 ${className ?? ''}`}
    />
  );
}

/**
 * Repeats a card-shaped skeleton to mimic the ObjectCard list rows shown
 * by interventions/invoices/proposals/projects/contracts screens.
 */
export function ObjectCardSkeleton() {
  return (
    <View className="mb-2 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Skeleton width="40%" height={16} />
          <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="55%" height={11} style={{ marginTop: 6 }} />
        </View>
        <View className="items-end" style={{ gap: 6 }}>
          <Skeleton width={70} height={16} />
          <Skeleton width={50} height={14} />
        </View>
      </View>
    </View>
  );
}

/**
 * Renders N ObjectCard skeletons. Default count = 5.
 */
export function ObjectCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ObjectCardSkeleton key={i} />
      ))}
    </>
  );
}
