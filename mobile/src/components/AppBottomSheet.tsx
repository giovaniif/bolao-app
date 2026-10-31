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
  const reported = useRef(true);

  const reportClose = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    onClose();
  }, [onClose]);

  const handleChange = useCallback(
    (index: number) => {
      if (index >= 0) reported.current = false;
      else reportClose();
    },
    [reportClose]
  );

  useEffect(() => {
    if (open && !wasOpen.current) {
      sheet.current?.present();
    } else if (!open && wasOpen.current) {
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="close"
        accessibilityLabel={closeLabel}
      />
    ),
    [closeLabel]
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      animationConfigs={SPRING}
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      onDismiss={reportClose}
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
