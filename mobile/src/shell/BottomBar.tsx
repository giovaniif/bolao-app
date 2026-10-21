import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export type TabName = 'index' | 'palpitar' | 'rodada';

function SideTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={{ width: 84, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: active ? colors.primary : 'transparent' }} />
      <Text style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.muted }}>{label}</Text>
    </Pressable>
  );
}

export function BottomBar({ active, onNavigate }: { active: string; onNavigate: (tab: TabName) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.nav, borderTopWidth: 1, borderTopColor: colors.card, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <SideTab label="Bolão" active={active === 'index'} onPress={() => onNavigate('index')} />
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Palpitar"
          accessibilityState={{ selected: active === 'palpitar' }}
          onPress={() => onNavigate('palpitar')}
          style={{ height: 54, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
        >
          <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '900' }}>Palpitar</Text>
        </Pressable>
        <SideTab label="Rodada" active={active === 'rodada'} onPress={() => onNavigate('rodada')} />
      </View>
    </View>
  );
}
