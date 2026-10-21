import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthProvider';
import { colors } from '../theme';
import { initSentry } from '../observability/sentry';

initSentry();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          <Stack.Screen name="esqueci-senha" options={{ title: 'Esqueci minha senha' }} />
          <Stack.Screen name="criar-bolao" options={{ title: 'Criar bolão' }} />
          <Stack.Screen name="entrar" options={{ title: 'Entrar com código' }} />
          <Stack.Screen name="meus-boloes" options={{ title: 'Meus bolões' }} />
          <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
          <Stack.Screen name="admin" options={{ title: 'Admin' }} />
          <Stack.Screen name="alterar-senha" options={{ title: 'Alterar senha' }} />
          <Stack.Screen name="membros" options={{ title: 'Gerenciar bolão' }} />
          <Stack.Screen name="campeoes" options={{ title: 'Hall dos Campeões' }} />
          <Stack.Screen name="convite/[code]" options={{ title: 'Convite' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
