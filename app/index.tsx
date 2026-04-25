import { Redirect } from 'expo-router';

/**
 * Root entry — redirect to the onboarding stack until auth is implemented in Step 7.
 * The auth store will later inject the right destination based on token presence.
 */
export default function Index() {
  return <Redirect href="/(auth)/setup" />;
}
