import { fireEvent, render, screen } from '@testing-library/react-native'
import { BottomBar } from './BottomBar'

describe('BottomBar', () => {
  it('shows Bolão, the Palpitar pill and Rodada', async () => {
    await render(<BottomBar active="index" onNavigate={jest.fn()} />)
    expect(screen.getByRole('tab', { name: 'Bolão' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Palpitar' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Rodada' })).toBeTruthy()
  })

  it('marks the active tab as selected', async () => {
    await render(<BottomBar active="rodada" onNavigate={jest.fn()} />)
    expect(screen.getByRole('tab', { name: 'Rodada' }).props.accessibilityState).toEqual({ selected: true })
    expect(screen.getByRole('tab', { name: 'Bolão' }).props.accessibilityState).toEqual({ selected: false })
  })

  it('navigates to the tab the user presses', async () => {
    const onNavigate = jest.fn()
    await render(<BottomBar active="index" onNavigate={onNavigate} />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Palpitar' }))
    expect(onNavigate).toHaveBeenCalledWith('palpitar')
  })
})
