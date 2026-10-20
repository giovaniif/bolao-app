import { fireEvent, render, screen } from '@testing-library/react-native'
import { ConsentPrompt } from './ConsentPrompt'

describe('ConsentPrompt', () => {
  it('reports the choice', async () => {
    const onChoose = jest.fn()
    await render(<ConsentPrompt visible onChoose={onChoose} />)
    expect(screen.getByText(/dados de uso/)).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Recusar' }))
    expect(onChoose).toHaveBeenCalledWith('denied')
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }))
    expect(onChoose).toHaveBeenCalledWith('granted')
  })

  it('shows nothing when there is nothing to ask', async () => {
    await render(<ConsentPrompt visible={false} onChoose={jest.fn()} />)
    expect(screen.queryByText(/dados de uso/)).toBeNull()
  })
})
