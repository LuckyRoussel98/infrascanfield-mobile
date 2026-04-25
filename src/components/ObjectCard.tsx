import { Pressable, Text, View } from 'react-native';

import { StatusBadge } from './StatusBadge';

export interface ObjectCardProps {
  ref: string;
  title?: string;
  subtitle?: string;
  rightLabel?: string;
  statusLabel?: string;
  statusVariant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  onPress?: () => void;
}

/**
 * Generic card row used by lists (interventions, invoices, proposals).
 *  - ref      : object reference (eg "FA2604-0042")
 *  - title    : second line, eg the thirdparty name
 *  - subtitle : muted third line, eg date or description
 *  - rightLabel : right-aligned amount/duration/etc.
 *  - statusLabel + variant : optional status pill
 */
export function ObjectCard({
  ref,
  title,
  subtitle,
  rightLabel,
  statusLabel,
  statusVariant,
  onPress,
}: ObjectCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-2xl border border-border bg-surface p-4 active:opacity-70 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-text dark:text-text-dark"
          >
            {ref}
          </Text>
          {title ? (
            <Text
              numberOfLines={1}
              className="mt-0.5 text-sm text-text dark:text-text-dark"
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              numberOfLines={2}
              className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          {rightLabel ? (
            <Text className="text-base font-semibold text-text dark:text-text-dark">
              {rightLabel}
            </Text>
          ) : null}
          {statusLabel ? <StatusBadge label={statusLabel} variant={statusVariant} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
