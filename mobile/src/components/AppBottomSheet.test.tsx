import { BackHandler, Text } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { bottomSheetCalls } from '../test/bottomSheetMock'
import { AppBottomSheet } from './AppBottomSheet'

jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('../test/bottomSheetMock').bottomSheetModule())

function Sheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AppBottomSheet open={open} onClose={onClose} testID="sheet" closeLabel="Fechar menu">
      <Text>Conteúdo</Text>
    </AppBottomSheet>
  )
}

beforeEach(() => {
  bottomSheetCalls.present = 0
  bottomSheetCalls.dismiss = 0
})

describe('AppBottomSheet', () => {
  it('presents when opened and dismisses when closed', async () => {
    const onClose = jest.fn()
    const view = await render(<Sheet open={false} onClose={onClose} />)
    expect(screen.queryByText('Conteúdo')).toBeNull()

    await view.rerender(<Sheet open onClose={onClose} />)
    expect(screen.getByText('Conteúdo')).toBeTruthy()
    expect(bottomSheetCalls.present).toBe(1)

    await view.rerender(<Sheet open={false} onClose={onClose} />)
    expect(screen.queryByText('Conteúdo')).toBeNull()
    expect(bottomSheetCalls.dismiss).toBe(1)
  })

  it('pans down to close and fits its content', async () => {
    await render(<Sheet open onClose={jest.fn()} />)
    expect(bottomSheetCalls.lastProps).toEqual(expect.objectContaining({ enablePanDownToClose: true, enableDynamicSizing: true }))
  })

  it('closes when the backdrop is tapped', async () => {
    const onClose = jest.fn()
    await render(<Sheet open onClose={onClose} />)
    await fireEvent.press(screen.getByLabelText('Fechar menu'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on the Android back button while open, and only then', async () => {
    const handlers: ((event: never) => boolean | null | undefined)[] = []
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler)
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) }
    })
    const onClose = jest.fn()
    const view = await render(<Sheet open={false} onClose={onClose} />)
    expect(handlers).toHaveLength(0)

    await view.rerender(<Sheet open onClose={onClose} />)
    let handled: boolean | null | undefined
    await act(async () => {
      handled = handlers[handlers.length - 1](undefined as never)
    })
    expect(handled).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)

    await view.rerender(<Sheet open={false} onClose={onClose} />)
    expect(handlers).toHaveLength(0)
    spy.mockRestore()
  })
})
