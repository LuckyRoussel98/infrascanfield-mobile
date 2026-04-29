import { Search, X } from 'lucide-react-native';
import { Pressable, TextInput, View, useColorScheme } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

/**
 * Standard search bar with leading magnifier icon and trailing clear button.
 * Submit on keyboard return triggers onSubmit (used to debounce-then-fetch by parents
 * that want explicit search trigger, instead of "search-as-you-type").
 */
export function SearchBar({ value, onChangeText, placeholder, onSubmit }: SearchBarProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === 'dark' ? '#a3a3a3' : '#737373';

  return (
    <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-1 dark:border-border-dark dark:bg-surface-dark">
      <Search size={18} color={iconColor} />
      <TextInput
        className="min-h-touch-min flex-1 px-1 text-base text-text dark:text-text-dark"
        placeholder={placeholder ?? 'Rechercher...'}
        placeholderTextColor={iconColor}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={12}
          className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
        >
          <X size={16} color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}
