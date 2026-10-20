import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';

export function EnterCodeScreen() {
  const [code, setCode] = useState('');
  const router = useRouter();
  const clean = code.trim().toUpperCase();
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <TextField label="Código do bolão" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="AMIGOS22" />
      <PrimaryButton title="Continuar" disabled={clean.length < 4} onPress={() => router.push(`/convite/${clean}`)} />
    </View>
  );
}
