import { Pressable, ScrollView, Text } from 'react-native';

export interface StatusOption {
  /** Empty string '' = "all" sentinel. */
  value: string;
  label: string;
}

interface StatusFilterProps {
  options: StatusOption[];
  value: string;
  onChange: (v: string) => void;
}

/**
 * Horizontal scrollable list of pills for status filtering.
 * Tap a pill to select ; the active pill is filled with the text color.
 */
export function StatusFilter({ options, value, onChange }: StatusFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value || '__all'}
            onPress={() => onChange(opt.value)}
            className={`rounded-full border px-3 py-1.5 active:opacity-70 ${
              active
                ? 'border-text bg-text dark:border-text-dark dark:bg-text-dark'
                : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                active
                  ? 'text-background dark:text-background-dark'
                  : 'text-text dark:text-text-dark'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
