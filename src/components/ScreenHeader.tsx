import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View, useColorScheme } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

/**
 * Page header with optional back chevron and right slot (eg refresh button).
 * Used by detail screens — list/dashboard screens use a built-in title block.
 */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === 'dark' ? '#fafafa' : '#0a0a0a';

  return (
    <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3 dark:border-border-dark dark:bg-background-dark">
      <View className="flex-1 flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            className="mr-2 h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
          >
            <ChevronLeft size={26} color={iconColor} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="text-lg font-semibold text-text dark:text-text-dark"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              className="text-xs text-text-muted dark:text-text-muted-dark"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}
