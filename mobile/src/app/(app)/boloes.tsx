import { Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../theme';

export default function BoloesTab() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ color: colors.muted }}>Seus bolões aparecem aqui.</Text>
      <PrimaryButton title="Sair" variant="secondary" onPress={signOut} />
    </View>
  );
}
