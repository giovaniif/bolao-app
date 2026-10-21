import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { getProfile } from '../api/auth';
import { colors } from '../theme';
import { initials } from './initials';

function MenuItem({ label, onPress, detail, active }: { label: string; onPress: () => void; detail?: string; active?: boolean }) {
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500', flexShrink: 1 }}>{label}</Text>
      {detail && <Text style={{ color: colors.muted, fontSize: 12 }}>{detail}</Text>}
    </Pressable>
  );
}

function Dropdown({ visible, onClose, top, align, children }: { visible: boolean; onClose: () => void; top: number; align: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar menu" style={{ flex: 1 }} onPress={onClose}>
        <View style={{ position: 'absolute', top, [align]: 16, minWidth: 180, maxWidth: 300, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 4 }}>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

export function AppHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const { bolao, boloes, select } = useCurrentBolao();
  const profile = useQuery({ queryKey: ['me'], queryFn: getProfile, enabled: !!token });
  const [menu, setMenu] = useState<'bolao' | 'profile' | null>(null);
  const playable = boloes.filter((b) => b.member_status === 'active');
  const name = profile.data?.display_name ?? user?.username ?? '';
  const menuTop = insets.top + 56;

  function go(path: '/meus-boloes') {
    setMenu(null);
    router.push(path);
  }

  return (
    <View style={{ backgroundColor: colors.bg, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: colors.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '900' }}>Bolão</Text>
          {bolao && playable.length > 1 && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Trocar bolão: ${bolao.name}`} onPress={() => setMenu('bolao')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{bolao.name}</Text>
              <Text style={{ color: colors.muted }}>▾</Text>
            </Pressable>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Meu perfil" onPress={() => setMenu('profile')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{initials(name)}</Text>
        </Pressable>
      </View>
      {title && <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 10 }}>{title}</Text>}

      <Dropdown visible={menu === 'bolao'} onClose={() => setMenu(null)} top={menuTop} align="left">
        {playable.map((b) => (
          <MenuItem
            key={b.id}
            label={b.name}
            detail={`${b.member_count} pessoas`}
            active={b.id === bolao?.id}
            onPress={() => {
              setMenu(null);
              select(b.id);
            }}
          />
        ))}
      </Dropdown>
      <Dropdown visible={menu === 'profile'} onClose={() => setMenu(null)} top={menuTop} align="right">
        <MenuItem label="Meus bolões" onPress={() => go('/meus-boloes')} />
        <MenuItem
          label="Sair"
          onPress={async () => {
            setMenu(null);
            await signOut();
            router.replace('/login');
          }}
        />
      </Dropdown>
    </View>
  );
}
