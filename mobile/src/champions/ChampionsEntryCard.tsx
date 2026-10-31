import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../theme';
import type { Season } from './season';

export function ChampionsEntryCard({ latest }: { latest?: Season }) {
  const router = useRouter();
  const champion = latest?.champion?.display_name;
  const subtitle = latest && champion ? `Último: ${champion} · ${latest.year}` : 'Campeões das temporadas encerradas';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Hall dos Campeões. ${subtitle}`}
      onPress={() => router.push('/campeoes')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.35)',
        backgroundColor: 'rgba(255,215,0,0.08)',
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.2)' }}>
        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Hall dos Campeões</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text>
      </View>
      <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '600' }}>›</Text>
    </Pressable>
  );
}
