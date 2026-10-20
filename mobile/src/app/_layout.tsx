import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthProvider';
import { colors } from '../theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerBackTitle: 'Voltar',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
          <Stack.Screen name="criar-bolao" options={{ title: 'Criar bolão' }} />
          <Stack.Screen name="entrar" options={{ title: 'Entrar com código' }} />
          <Stack.Screen name="membros" options={{ title: 'Participantes' }} />
          <Stack.Screen name="convite/[code]" options={{ title: 'Convite' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
