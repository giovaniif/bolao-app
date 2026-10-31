import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, getTeams, updateProfile } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';
import { DeleteAccount } from '../auth/DeleteAccount';
import { PrivacySwitch } from '../analytics/PrivacySwitch';
import { analyticsEnabled, hasConsent, setConsent } from '../analytics/analytics';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { colors } from '../theme';
import { TeamBadge } from '../teams/TeamBadge';

type Edits = Partial<{ username: string; display_name: string; favorite_team: string }>;

export function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const profile = useQuery({ queryKey: ['me'], queryFn: getProfile });
  const teams = useQuery({ queryKey: ['teams'], queryFn: getTeams, staleTime: Infinity });
  const [edits, setEdits] = useState<Edits>({});
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    hasConsent().then(setSharing);
  }, []);

  const form = {
    username: profile.data?.username ?? '',
    display_name: profile.data?.display_name ?? '',
    favorite_team: profile.data?.favorite_team ?? '',
    ...edits,
  };

  const save = useMutation({
    mutationFn: () => updateProfile({ username: form.username.trim(), display_name: form.display_name.trim(), favorite_team: form.favorite_team || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated);
      setEdits({});
    },
  });

  if (profile.isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <TextField label="Usuário (para login)" value={form.username} autoCapitalize="none" onChangeText={(v) => setEdits((e) => ({ ...e, username: v }))} />
      <TextField label="Nome" value={form.display_name} onChangeText={(v) => setEdits((e) => ({ ...e, display_name: v }))} />
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>Time do coração</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Time do coração: ${form.favorite_team || 'Selecione'}`}
          onPress={() => setPicking(true)}
          style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {form.favorite_team ? <TeamBadge team={form.favorite_team} size={24} /> : null}
            <Text style={{ color: form.favorite_team ? colors.text : colors.muted, fontSize: 16 }}>{form.favorite_team || 'Selecione'}</Text>
          </View>
          <Text style={{ color: colors.muted }}>▾</Text>
        </Pressable>
      </View>
      {save.isSuccess && Object.keys(edits).length === 0 && <Text style={{ color: colors.primary, textAlign: 'center' }}>Perfil salvo!</Text>}
      {save.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{save.error.message}</Text>}
      <PrimaryButton title="Salvar" onPress={() => save.mutate()} loading={save.isPending} disabled={!form.username.trim() || !form.display_name.trim()} />
      <Pressable accessibilityRole="button" accessibilityLabel="Alterar senha" onPress={() => router.push('/alterar-senha')}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Alterar senha</Text>
      </Pressable>

      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.card, gap: 16 }}>
        <PrivacySwitch
          enabled={analyticsEnabled}
          value={sharing}
          onChange={async (on) => {
            setSharing(on);
            await setConsent(on ? 'granted' : 'denied');
          }}
        />
        <PrimaryButton
          title="Sair"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
        />
        <DeleteAccount />
      </View>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable accessibilityLabel="Fechar" style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 }} onPress={() => setPicking(false)}>
          <View style={{ backgroundColor: colors.card, borderRadius: 14, maxHeight: '70%' }}>
            <ScrollView>
              {(teams.data ?? []).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t}
                  onPress={() => {
                    setEdits((e) => ({ ...e, favorite_team: t }));
                    setPicking(false);
                  }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <Text style={{ color: t === form.favorite_team ? colors.primary : colors.text, fontWeight: t === form.favorite_team ? '700' : '500' }}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
