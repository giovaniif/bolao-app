import { Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import type { Consent } from './analytics';

export function ConsentPrompt({ visible, onChoose }: { visible: boolean; onChoose: (consent: Consent) => void }) {
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 96, backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text }}>Podemos usar dados de uso, sem seu nome ou e-mail, para melhorar o app? Você pode mudar isso em Meus bolões.</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Recusar" variant="secondary" onPress={() => onChoose('denied')} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Aceitar" onPress={() => onChoose('granted')} />
        </View>
      </View>
    </View>
  );
}
