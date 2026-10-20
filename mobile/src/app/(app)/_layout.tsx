import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../theme';

export default function AppLayout() {
  const { ready, token } = useAuth();
  if (!ready) {
    return null;
  }
  if (!token) {
    return <Redirect href="/login" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: '#131f35', borderTopColor: colors.card },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Palpitar' }} />
      <Tabs.Screen name="boloes" options={{ title: 'Meus bolões' }} />
    </Tabs>
  );
}
