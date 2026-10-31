import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthProvider';
import { RootStack } from '../shell/RootStack';
import { initSentry } from '../observability/sentry';

initSentry();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <RootStack />
        </BottomSheetModalProvider>
      </AuthProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
