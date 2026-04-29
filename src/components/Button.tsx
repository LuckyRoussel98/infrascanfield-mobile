import {
  ActivityIndicator,
  Pressable,
  Text,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';

import { haptic } from '@/utils/haptics';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  fullWidth?: boolean;
  /** Set to false to skip haptic on press (default: true). */
  haptics?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  haptics = true,
  disabled,
  className,
  onPress,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = (event: GestureResponderEvent) => {
    if (haptics) {
      if (variant === 'danger') haptic.warning();
      else haptic.tap();
    }
    onPress?.(event);
  };

  const base = 'min-h-touch-min items-center justify-center rounded-2xl px-6 py-4 active:opacity-70';
  const width = fullWidth ? 'w-full' : 'self-start';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-text dark:bg-text-dark',
    secondary: 'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark',
    ghost: 'bg-transparent',
    danger: 'bg-danger',
  };

  const labelColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'text-background dark:text-background-dark',
    secondary: 'text-text dark:text-text-dark',
    ghost: 'text-text dark:text-text-dark',
    danger: 'text-white',
  };

  const disabledClass = isDisabled ? 'opacity-50' : '';

  return (
    <Pressable
      disabled={isDisabled}
      onPress={handlePress}
      className={`${base} ${width} ${variants[variant]} ${disabledClass} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#ffffff' : '#0a0a0a'} />
      ) : (
        <Text className={`text-base font-semibold ${labelColors[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
