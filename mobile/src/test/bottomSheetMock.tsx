import type { ReactNode } from 'react'

type ModalProps = {
  children?: ReactNode
  onDismiss?: () => void
  onChange?: (index: number) => void
  backdropComponent?: (props: Record<string, unknown>) => ReactNode
  enablePanDownToClose?: boolean
  bottomInset?: number
  accessibilityLabel?: string
}

type BackdropProps = { onPress?: () => void; accessibilityLabel?: string; pressBehavior?: string; close?: () => void }

export const bottomSheetCalls: {
  present: number
  dismiss: number
  lastProps: ModalProps | null
  panDown: () => void
  lastBackdropProps: BackdropProps | null
  firesOnDismiss: boolean
} = { present: 0, dismiss: 0, lastProps: null, panDown: () => undefined, lastBackdropProps: null, firesOnDismiss: true }

export function bottomSheetModule() {
  const React = jest.requireActual('react')
  const { Pressable, View } = jest.requireActual('react-native')

  const BottomSheetModal = React.forwardRef(function BottomSheetModal(props: ModalProps, ref: unknown) {
    const [open, setOpen] = React.useState(false)
    const latest = React.useRef(props)
    React.useEffect(() => {
      latest.current = props
    })
    const close = React.useCallback(() => {
      setOpen((wasOpen: boolean) => {
        if (wasOpen) {
          latest.current.onChange?.(-1)
          if (bottomSheetCalls.firesOnDismiss) setTimeout(() => latest.current.onDismiss?.(), 0)
        }
        return false
      })
    }, [])
    React.useImperativeHandle(
      ref,
      () => ({
        present: () => {
          bottomSheetCalls.present += 1
          setOpen(true)
          latest.current.onChange?.(0)
        },
        dismiss: () => {
          bottomSheetCalls.dismiss += 1
          close()
        },
      }),
      [close]
    )
    bottomSheetCalls.lastProps = props
    bottomSheetCalls.panDown = close
    if (!open) return null
    const Backdrop = props.backdropComponent
    return (
      <View testID="bottom-sheet-modal" accessibilityLabel={props.accessibilityLabel}>
        {Backdrop ? <Backdrop animatedIndex={{ value: 0 }} animatedPosition={{ value: 0 }} style={{}} close={close} /> : null}
        {props.children}
      </View>
    )
  })

  function BottomSheetBackdrop(props: BackdropProps) {
    const { onPress, accessibilityLabel, pressBehavior = 'close', close } = props
    bottomSheetCalls.lastBackdropProps = props
    if (pressBehavior === 'none') return <View accessibilityLabel={accessibilityLabel} />
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          onPress?.()
          if (pressBehavior === 'close') close?.()
        }}
      />
    )
  }

  function BottomSheetView({ children }: { children?: ReactNode }) {
    return <View>{children}</View>
  }

  function BottomSheetModalProvider({ children }: { children?: ReactNode }) {
    return <>{children}</>
  }

  return { __esModule: true, BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetModalProvider }
}
