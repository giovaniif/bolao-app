import type { ReactNode } from 'react'

type ModalProps = {
  children?: ReactNode
  onDismiss?: () => void
  backdropComponent?: (props: Record<string, unknown>) => ReactNode
  enablePanDownToClose?: boolean
  bottomInset?: number
  accessibilityLabel?: string
}

type BackdropProps = { onPress?: () => void; accessibilityLabel?: string }

export const bottomSheetCalls: { present: number; dismiss: number; lastProps: ModalProps | null } = { present: 0, dismiss: 0, lastProps: null }

export function bottomSheetModule() {
  const React = jest.requireActual('react')
  const { Pressable, View } = jest.requireActual('react-native')

  const BottomSheetModal = React.forwardRef(function BottomSheetModal(props: ModalProps, ref: unknown) {
    const [open, setOpen] = React.useState(false)
    const onDismiss = props.onDismiss
    React.useImperativeHandle(
      ref,
      () => ({
        present: () => {
          bottomSheetCalls.present += 1
          setOpen(true)
        },
        dismiss: () => {
          bottomSheetCalls.dismiss += 1
          setOpen(false)
          onDismiss?.()
        },
      }),
      [onDismiss]
    )
    bottomSheetCalls.lastProps = props
    if (!open) return null
    const Backdrop = props.backdropComponent
    return (
      <View testID="bottom-sheet-modal" accessibilityLabel={props.accessibilityLabel}>
        {Backdrop ? <Backdrop animatedIndex={{ value: 0 }} animatedPosition={{ value: 0 }} style={{}} /> : null}
        {props.children}
      </View>
    )
  })

  function BottomSheetBackdrop({ onPress, accessibilityLabel }: BackdropProps) {
    return <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
  }

  function BottomSheetView({ children }: { children?: ReactNode }) {
    return <View>{children}</View>
  }

  function BottomSheetModalProvider({ children }: { children?: ReactNode }) {
    return <>{children}</>
  }

  return { __esModule: true, BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetModalProvider }
}
