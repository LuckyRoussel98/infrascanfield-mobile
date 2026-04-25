import { Tabs } from 'expo-router';
import { Briefcase, Cog, Home } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

export default function TabsLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#fafafa' : '#0a0a0a',
        tabBarInactiveTintColor: isDark ? '#737373' : '#a3a3a3',
        tabBarStyle: {
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
          borderTopColor: isDark ? '#262626' : '#e5e5e5',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="interventions"
        options={{
          title: t('tabs.interventions'),
          tabBarIcon: ({ color, size }) => (
            <Briefcase size={size} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Cog size={size} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
