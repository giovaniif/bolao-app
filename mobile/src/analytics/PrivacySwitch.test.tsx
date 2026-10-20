import { fireEvent, render, screen } from '@testing-library/react-native'
import { PrivacySwitch } from './PrivacySwitch'

describe('PrivacySwitch', () => {
  it('turns usage data on and off', async () => {
    const onChange = jest.fn()
    await render(<PrivacySwitch enabled value={false} onChange={onChange} />)
    await fireEvent.press(screen.getByRole('switch', { name: 'Compartilhar dados de uso' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is hidden when analytics are off in this build', async () => {
    await render(<PrivacySwitch enabled={false} value={false} onChange={jest.fn()} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
