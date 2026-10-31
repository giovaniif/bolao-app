import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 1;

export function BottomSheet({ visible, onClose, testID, children }: { visible: boolean; onClose: () => void; testID?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [drag] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
    }
  }, [visible, drag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          onClose();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      }),
    [drag, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Fechar menu" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          {...pan.panHandlers}
          style={{
            transform: [{ translateY: drag }],
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View accessible accessibilityLabel="Arraste para baixo para fechar" style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.muted }} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
