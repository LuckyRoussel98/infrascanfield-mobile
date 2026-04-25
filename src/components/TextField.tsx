import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string | null;
}

/**
 * Form field with label + helper/error text.
 * Inputs use a thicker border + larger padding for fast field tap targets.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, helper, error, className, placeholderTextColor, ...rest },
  ref,
) {
  return (
    <View className="mb-4 w-full">
      {label ? (
        <Text className="mb-2 text-sm font-medium text-text dark:text-text-dark">{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? '#a3a3a3'}
        className={`min-h-touch-min rounded-2xl border bg-surface px-4 py-3 text-base text-text dark:bg-surface-dark dark:text-text-dark ${
          error
            ? 'border-danger'
            : 'border-border dark:border-border-dark'
        } ${className ?? ''}`}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 text-sm text-danger">{error}</Text>
      ) : helper ? (
        <Text className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">{helper}</Text>
      ) : null}
    </View>
  );
});
