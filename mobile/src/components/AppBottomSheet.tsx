import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const SPRING = { damping: 80, overshootClamping: true, stiffness: 500 };

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
  closeLabel?: string;
};

export function AppBottomSheet({ open, onClose, children, testID, closeLabel = 'Fechar' }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      sheet.current?.present();
    } else if (wasOpen.current) {
      sheet.current?.dismiss();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  const handleDismiss = useCallback(() => {
    if (open) onClose();
  }, [open, onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="none"
        onPress={onClose}
        accessibilityLabel={closeLabel}
      />
    ),
    [onClose, closeLabel]
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      animationConfigs={SPRING}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.muted, width: 40 }}
      accessibilityLabel="Arraste para baixo para fechar"
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + 12 }}>
        <View testID={testID}>{children}</View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
