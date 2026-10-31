import { Stack } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../theme';

export function RootStack() {
  const { ready, token } = useAuth();
  const signedOut = ready && !token;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerBackTitle: 'Voltar',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedOut}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="criar-bolao" options={{ title: 'Criar bolão' }} />
        <Stack.Screen name="entrar" options={{ title: 'Entrar com código' }} />
        <Stack.Screen name="meus-boloes" options={{ title: 'Meus bolões' }} />
        <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
        <Stack.Screen name="alterar-senha" options={{ title: 'Alterar senha' }} />
        <Stack.Screen name="membros" options={{ title: 'Gerenciar bolão' }} />
        <Stack.Screen name="campeoes" options={{ title: 'Hall dos Campeões' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="esqueci-senha" options={{ title: 'Esqueci minha senha' }} />
      </Stack.Protected>
      <Stack.Screen name="boas-vindas" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="convite/[code]" options={{ title: 'Convite' }} />
    </Stack>
  );
}
