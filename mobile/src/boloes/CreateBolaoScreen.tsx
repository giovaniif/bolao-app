import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBolao, getCompetitions, getRules } from '../api/boloes';
import { bolaoKeys, useCurrentBolao } from '../bolao/useCurrentBolao';
import { TextField } from '../components/TextField';
import { Toggle } from '../components/Toggle';
import { PrimaryButton } from '../components/PrimaryButton';
import { RulesList } from './RulesList';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

export function CreateBolaoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { select } = useCurrentBolao();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [approval, setApproval] = useState(true);
  const competitions = useQuery({ queryKey: ['competitions'], queryFn: getCompetitions, staleTime: Infinity });
  const rules = useQuery({ queryKey: ['rules'], queryFn: getRules, staleTime: Infinity });
  const competition = competitions.data?.[0];
  const create = useMutation({
    mutationFn: () => createBolao(name.trim(), isPublic ? 'public' : 'private', approval, competition?.id),
    onSuccess: async (bolao) => {
      track('bolao_created', { visibility: isPublic ? 'public' : 'private', requires_approval: approval });
      await queryClient.invalidateQueries({ queryKey: bolaoKeys.mine });
      await select(bolao.id);
      router.replace('/');
    },
  });
  const valid = name.trim().length >= 3 && name.trim().length <= 100;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <TextField label="Nome do bolão" value={name} onChangeText={setName} placeholder="Bolão da firma" maxLength={100} />
      {competition && <Text style={{ color: colors.muted, fontSize: 13 }}>Campeonato: {competition.name}. Os jogos e resultados entram sozinhos, a partir da próxima rodada.</Text>}
      <Toggle label="Público" hint="Aparece em Explorar para qualquer pessoa." value={isPublic} onChange={setIsPublic} />
      <Toggle label="Aprovar quem pede para entrar" hint="Quem entra pelo código espera sua aprovação. Seus links entram direto." value={approval} onChange={setApproval} />
      <Text style={{ color: colors.text, fontWeight: '800', marginTop: 8 }}>Regras (iguais em todos os bolões)</Text>
      {rules.data && <RulesList rules={rules.data} />}
      {create.error && <Text style={{ color: colors.danger }}>{create.error.message}</Text>}
      <PrimaryButton title="Criar bolão" onPress={() => create.mutate()} disabled={!valid} loading={create.isPending} />
    </ScrollView>
  );
}
