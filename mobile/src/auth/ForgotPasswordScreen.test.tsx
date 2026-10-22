import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '../test/render'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { LoginScreen } from './LoginScreen'

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useLocalSearchParams: () => ({}),
    Link: ({ children, href }: { children: string; href: string }) => <Text testID={`link:${href}`}>{children}</Text>,
  }
})

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

describe('ForgotPasswordScreen', () => {
  it('is linked from the login screen after a wrong password', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'usuário ou senha inválidos' }) })
    await renderWithProviders(<LoginScreen />)
    expect(screen.queryByTestId('link:/esqueci-senha')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'x')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByTestId('link:/esqueci-senha')).toHaveTextContent('Esqueci minha senha')
  })

  it('sends the login and says to check the email', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' })
    await renderWithProviders(<ForgotPasswordScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário ou e-mail'), ' ana@example.com ')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/Se existir uma conta com e-mail/)).toBeTruthy()
    expect(mockFetch.mock.calls[0][0]).toContain('/auth/forgot-password')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ login: 'ana@example.com' })
  })

  it('shows a network error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'falhou' }) })
    await renderWithProviders(<ForgotPasswordScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário ou e-mail'), 'ana')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar link' }))
    await waitFor(() => expect(screen.getByText('falhou')).toBeTruthy())
  })

  it('waits for a login before sending', async () => {
    await renderWithProviders(<ForgotPasswordScreen />)
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeDisabled()
  })
})
