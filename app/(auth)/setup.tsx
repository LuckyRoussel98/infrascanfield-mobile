import { Text, View } from 'react-native';

/**
 * Placeholder for the Dolibarr URL setup screen — implemented in Step 7.
 * Visible once the app boots ; replaced by the real form in the next step.
 */
export default function SetupScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark px-6">
      <Text className="text-2xl font-semibold text-text dark:text-text-dark mb-2">
        InfraSScanField
      </Text>
      <Text className="text-base text-text-muted dark:text-text-muted-dark text-center">
        Onboarding screen — wired in Step 7.
      </Text>
    </View>
  );
}
