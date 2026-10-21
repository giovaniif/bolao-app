import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInviteLink,
  getInviteCode,
  getMembers,
  leaveBolao,
  removeMember,
  reviewRequest,
  rotateInviteCode,
  setMemberRole,
  updateBolaoSettings,
  type Member,
} from '../api/boloes';
import type { MyBolao } from '../api/play';
import { bolaoKeys, useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { Toggle } from '../components/Toggle';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

const INVITE_HOST = process.env.EXPO_PUBLIC_INVITE_URL ?? 'https://bolao.giovani.app';
const ROLE_LABEL: Record<Member['role'], string> = { owner: 'Dono', admin: 'Admin', participant: 'Participante' };

type Role = MyBolao['role'];

function canRemove(actor: Role, target: Member) {
  if (target.role === 'owner') {
    return false;
  }
  if (actor === 'owner') {
    return true;
  }
  return actor === 'admin' && target.role === 'participant';
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, marginTop: 8 }}>{children}</Text>;
}

function RoleChip({ label, text, selected, onPress }: { label: string; text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      disabled={selected}
      onPress={onPress}
      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? '#00a65133' : 'transparent' }}
    >
      <Text style={{ color: selected ? colors.primary : colors.muted, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}

function Settings({ bolao }: { bolao: MyBolao }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(bolao.name);
  const [isPublic, setIsPublic] = useState(bolao.visibility === 'public');
  const [approval, setApproval] = useState(bolao.requires_approval ?? true);
  const save = useMutation({
    mutationFn: () => updateBolaoSettings(bolao.id, { name: name.trim(), visibility: isPublic ? 'public' : 'private', requires_approval: approval }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bolaoKeys.mine }),
  });
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle>CONFIGURAÇÕES</SectionTitle>
      <TextField label="Nome do bolão" value={name} onChangeText={setName} />
      <Toggle label="Aparece na lista pública" hint="Qualquer pessoa encontra o bolão e pede para entrar." value={isPublic} onChange={setIsPublic} />
      <Toggle label="Pedidos precisam de aprovação" hint="Quem entra pelo código espera um admin aprovar." value={approval} onChange={setApproval} />
      {save.isSuccess && <Text style={{ color: colors.primary, textAlign: 'center' }}>Configurações salvas!</Text>}
      {save.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{save.error.message}</Text>}
      <PrimaryButton title="Salvar configurações" onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 3} />
    </View>
  );
}

export function MembersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { boloes } = useCurrentBolao();
  const bolao = boloes.find((b) => b.id === id);
  const myRole: Role = bolao?.role ?? 'participant';
  const manages = myRole === 'owner' || myRole === 'admin';
  const [confirming, setConfirming] = useState<string | null>(null);

  const members = useQuery({ queryKey: ['members', id], queryFn: () => getMembers(id), enabled: !!id });
  const code = useQuery({ queryKey: ['invite', id], queryFn: () => getInviteCode(id), enabled: !!id && manages });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['members', id] });
  const review = useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'approve' | 'reject' }) => reviewRequest(id, userId, decision),
    onSuccess: refresh,
  });
  const role = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: 'admin' | 'participant' }) => setMemberRole(id, userId, next),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(id, userId),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  const rotate = useMutation({
    mutationFn: () => rotateInviteCode(id),
    onSuccess: (res) => queryClient.setQueryData(['invite', id], res),
  });
  const leave = useMutation({
    mutationFn: () => leaveBolao(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bolaoKeys.mine });
      router.replace('/meus-boloes');
    },
  });
  const link = useMutation({
    mutationFn: () => createInviteLink(id),
    onSuccess: async (res) => {
      track('invite_link_created');
      await Share.share({ message: `Entra no meu bolão: ${INVITE_HOST}/convite/${res.token}` });
    },
  });
  const pending = (members.data ?? []).filter((m) => m.status === 'pending');
  const active = (members.data ?? []).filter((m) => m.status === 'active');
  const error = role.error ?? remove.error ?? review.error ?? rotate.error ?? leave.error;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {manages && (
        <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Código do bolão</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: 4 }}>{code.data?.code ?? '········'}</Text>
          <PrimaryButton title="Compartilhar link de convite" onPress={() => link.mutate()} loading={link.isPending} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>O link entra direto, sem aprovação, e vale por 7 dias.</Text>
          {myRole === 'owner' && (
            <Pressable accessibilityRole="button" accessibilityLabel="Gerar novo código" onPress={() => rotate.mutate()} disabled={rotate.isPending}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Gerar novo código</Text>
            </Pressable>
          )}
        </View>
      )}

      {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error.message}</Text>}

      {manages && pending.length > 0 && <SectionTitle>PEDIDOS PARA ENTRAR</SectionTitle>}
      {manages &&
        pending.map((m) => (
          <View key={m.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#ffd70066' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{m.display_name}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={`Recusar ${m.display_name}`} variant="secondary" onPress={() => review.mutate({ userId: m.id, decision: 'reject' })} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={`Aprovar ${m.display_name}`} onPress={() => review.mutate({ userId: m.id, decision: 'approve' })} />
              </View>
            </View>
          </View>
        ))}

      <SectionTitle>{`${active.length} PARTICIPANTES`}</SectionTitle>
      {active.map((m) => {
        const removable = canRemove(myRole, m);
        const editsRole = myRole === 'owner' && m.role !== 'owner';
        return (
          <View key={m.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>{m.display_name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>@{m.username}</Text>
              </View>
              {editsRole ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <RoleChip label={`Tornar ${m.display_name} participante`} text="Participante" selected={m.role === 'participant'} onPress={() => role.mutate({ userId: m.id, next: 'participant' })} />
                  <RoleChip label={`Tornar ${m.display_name} admin`} text="Admin" selected={m.role === 'admin'} onPress={() => role.mutate({ userId: m.id, next: 'admin' })} />
                </View>
              ) : (
                <Text style={{ color: m.role === 'owner' ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>{ROLE_LABEL[m.role]}</Text>
              )}
            </View>
            {removable &&
              (confirming === m.id ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setConfirming(null)} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar remoção de ${m.display_name}`}
                    onPress={() => remove.mutate(m.id)}
                    style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.danger }}
                  >
                    <Text style={{ color: colors.bg, fontWeight: '800' }}>Remover</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${m.display_name}`} onPress={() => setConfirming(m.id)}>
                  <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>Remover</Text>
                </Pressable>
              ))}
          </View>
        );
      })}

      {myRole === 'owner' && bolao && <Settings key={bolao.id} bolao={bolao} />}

      {bolao && myRole !== 'owner' && (
        <View style={{ marginTop: 16, gap: 8 }}>
          {confirming === 'leave' ? (
            <>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>Você sai do bolão e deixa de aparecer na classificação.</Text>
              <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setConfirming(null)} />
              <Pressable accessibilityRole="button" accessibilityLabel="Confirmar saída" onPress={() => leave.mutate()} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.danger }}>
                <Text style={{ color: colors.bg, fontWeight: '800' }}>Sair do bolão</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Sair do bolão" onPress={() => setConfirming('leave')} style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Sair do bolão</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
