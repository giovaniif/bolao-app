import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../theme';
import { AnalyticsGate } from '../../analytics/AnalyticsGate';
import { PushGate } from '../../notifications/PushGate';
import { AppHeader } from '../../shell/AppHeader';
import { BottomBar, type TabName } from '../../shell/BottomBar';

const TITLES: Record<TabName, string> = { index: 'Classificação', palpitar: 'Palpites', rodada: '' };

export default function AppLayout() {
  const { ready, token } = useAuth();
  if (!ready) {
    return null;
  }
  if (!token) {
    return <Redirect href="/login" />;
  }
  return (
    <>
      <Tabs
        tabBar={({ state, navigateToTab }) => (
          <BottomBar
            active={state.routes[state.index].name}
            onNavigate={(tab) => {
              const route = state.routes.find((r) => r.name === tab);
              if (route) {
                navigateToTab(route.key);
              }
            }}
          />
        )}
        screenOptions={({ route }) => ({
          header: () => <AppHeader title={TITLES[route.name as TabName] || undefined} />,
          sceneStyle: { backgroundColor: colors.bg },
        })}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="palpitar" />
        <Tabs.Screen name="rodada" />
      </Tabs>
      <AnalyticsGate />
      <PushGate />
    </>
  );
}
