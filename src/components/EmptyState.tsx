import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

/**
 * Centered empty-list state with optional icon + description.
 */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {Icon ? <Icon size={32} color="#a3a3a3" strokeWidth={1.5} /> : null}
      <Text className="mt-3 text-base font-medium text-text dark:text-text-dark">{title}</Text>
      {description ? (
        <Text className="mt-1 text-center text-sm text-text-muted dark:text-text-muted-dark">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
