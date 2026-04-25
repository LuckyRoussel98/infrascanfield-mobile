import { Text, View } from 'react-native';

interface StatusBadgeProps {
  label: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * Compact status pill. The ONLY place we allow color accents besides the
 * minimalist B&W palette — used to convey metier status at a glance.
 */
export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  const variants: Record<NonNullable<StatusBadgeProps['variant']>, string> = {
    neutral:
      'bg-surface dark:bg-surface-dark border-border dark:border-border-dark text-text dark:text-text-dark',
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    danger: 'bg-danger/10 border-danger/30 text-danger',
    info: 'bg-info/10 border-info/30 text-info',
  };

  return (
    <View className={`self-start rounded-full border px-2.5 py-0.5 ${variants[variant]}`}>
      <Text className={`text-xs font-medium ${variants[variant]}`}>{label}</Text>
    </View>
  );
}
