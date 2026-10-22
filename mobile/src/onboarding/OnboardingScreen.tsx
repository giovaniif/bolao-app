import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getProfile, getTeams, socialLogin, updateProfile, usernameAvailable } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { getPendingSignup, setPendingSignup, type PendingSignup } from './pendingSignup';
import { deriveUsername, USERNAME_PATTERN } from './deriveUsername';
import { shortTeamName } from './crests';
import { TeamCrest } from './TeamCrest';

const CHECK_DELAY_MS = 400;
const FORMAT_HINT = 'Use de 3 a 30 letras, números, ponto ou _';

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

function Progress({ step }: { step: 1 | 2 }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step === 2 ? colors.primary : colors.border }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{`${step} de 2`}</Text>
    </View>
  );
}

function UsernameStep({ pending, onDone }: { pending: PendingSignup; onDone: () => void }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState(pending.suggestedUsername || deriveUsername(pending.name ?? ''));
  const clean = username.trim().toLowerCase();
  const wellFormed = USERNAME_PATTERN.test(clean);
  const checked = useDebounced(clean);
  const availability = useQuery({
    queryKey: ['username-available', checked],
    queryFn: () => usernameAvailable(checked),
    enabled: wellFormed && checked === clean,
  });
  const create = useMutation({
    mutationFn: () => socialLogin(pending.provider, pending.idToken, clean, pending.name),
    onSuccess: async (res) => {
      await signIn(res);
      onDone();
    },
  });

  const result = checked === clean ? availability.data : undefined;
  const ready = wellFormed && result?.valid === true && result.available;
  const hint = !wellFormed || result?.valid === false ? FORMAT_HINT : result ? (result.available ? 'Disponível' : 'Em uso') : '';
  const hintColor = ready ? colors.primary : result && !result.available ? colors.danger : colors.muted;

  return (
    <>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>Como você quer aparecer no bolão?</Text>
        <Text style={{ color: colors.muted, fontSize: 15 }}>É o nome que todo mundo vê na classificação. Você também entra com ele.</Text>
      </View>
      <View style={{ gap: 6 }}>
        <TextInput
          accessibilityLabel="Nome de usuário"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="joao.silva"
          placeholderTextColor="#64748b"
          style={{ backgroundColor: colors.card, borderColor: ready ? colors.primary : colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 18, fontWeight: '700' }}
        />
        {hint !== '' && <Text style={{ color: hintColor, fontSize: 13, fontWeight: '700' }}>{hint}</Text>}
      </View>
      {create.error && <Text style={{ color: colors.danger }}>{create.error.message}</Text>}
      <View style={{ flex: 1 }} />
      <PrimaryButton title="Continuar" onPress={() => create.mutate()} disabled={!ready} loading={create.isPending} />
    </>
  );
}

function TeamStep({ onDone }: { onDone: () => void }) {
  const teams = useQuery({ queryKey: ['teams'], queryFn: getTeams, staleTime: Infinity });
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      const profile = await getProfile();
      await updateProfile({ username: profile.username, display_name: profile.display_name, favorite_team: team });
    },
    onSuccess: onDone,
  });
  const term = deriveUsername(search);
  const shown = (teams.data ?? []).filter((t) => deriveUsername(t).includes(term));

  return (
    <>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>Pra qual time você torce?</Text>
      <TextInput
        accessibilityLabel="Buscar time"
        placeholder="Buscar time"
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, color: colors.text, fontSize: 16 }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }}>
        {shown.map((t) => (
          <View key={t} style={{ width: '25%', paddingHorizontal: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t}
              accessibilityState={{ selected: t === team }}
              onPress={() => setTeam(t)}
              style={{
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: t === team ? colors.primary : 'transparent',
                backgroundColor: t === team ? 'rgba(0,166,81,0.15)' : colors.card,
              }}
            >
              <TeamCrest team={t} size={36} />
              <Text numberOfLines={1} style={{ color: t === team ? colors.primary : colors.text, fontSize: 11, fontWeight: '700' }}>{shortTeamName(t)}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      {save.error && <Text style={{ color: colors.danger }}>{save.error.message}</Text>}
      <PrimaryButton title="Começar" onPress={() => save.mutate()} disabled={!team} loading={save.isPending} />
      <Pressable accessibilityRole="button" accessibilityLabel="Pular por agora" onPress={onDone} style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={{ color: colors.muted, fontWeight: '700' }}>Pular por agora</Text>
      </Pressable>
    </>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const [pending] = useState(getPendingSignup);
  const [step, setStep] = useState<1 | 2>(1);
  if (!pending) {
    return <Redirect href="/login" />;
  }

  const { next } = pending;
  function finish() {
    setPendingSignup(null);
    router.replace(next);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64, gap: 20 }} keyboardShouldPersistTaps="handled">
        <Progress step={step} />
        {step === 1 ? <UsernameStep pending={pending} onDone={() => setStep(2)} /> : <TeamStep onDone={finish} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
