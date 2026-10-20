import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton } from '../components/PrimaryButton';
import { DeleteAccount } from '../auth/DeleteAccount';
import { PrivacySwitch } from '../analytics/PrivacySwitch';
import { analyticsEnabled, hasConsent, setConsent } from '../analytics/analytics';
import { useEffect, useState } from 'react';
import { colors } from '../theme';

const ROLE: Record<string, string> = { owner: 'Dono', admin: 'Admin', participant: 'Participante' };

export function MyBoloesScreen() {
  const router = useRouter();
  const { boloes, bolao: current, select } = useCurrentBolao();
  const { signOut } = useAuth();
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    hasConsent().then(setSharing);
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Criar bolão" onPress={() => router.push('/criar-bolao')} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Entrar com código" variant="secondary" onPress={() => router.push('/entrar')} />
        </View>
      </View>
      {boloes.length === 0 && <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>Você ainda não participa de nenhum bolão.</Text>}
      {boloes.map((b) => {
        const pending = b.member_status === 'pending';
        const manages = b.role === 'owner' || b.role === 'admin';
        return (
          <View key={b.id} style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: b.id === current?.id ? colors.primary : 'transparent' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${b.name}`}
              disabled={pending}
              onPress={async () => {
                await select(b.id);
                router.replace('/');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, opacity: pending ? 0.7 : 1 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{b.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{b.member_count} participantes</Text>
              </View>
              <Text style={{ color: pending ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>{pending ? 'Aguardando aprovação' : ROLE[b.role]}</Text>
            </Pressable>
            {manages && b.status === 'active' && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Gerenciar ${b.name}`} onPress={() => router.push({ pathname: '/membros', params: { id: b.id } })} style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Convidar e gerenciar</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <View style={{ marginTop: 24, gap: 12 }}>
        <PrivacySwitch
          enabled={analyticsEnabled}
          value={sharing}
          onChange={async (on) => {
            setSharing(on);
            await setConsent(on ? 'granted' : 'denied');
          }}
        />
        <PrimaryButton title="Sair" variant="secondary" onPress={signOut} />
        <DeleteAccount />
      </View>
    </ScrollView>
  );
}
