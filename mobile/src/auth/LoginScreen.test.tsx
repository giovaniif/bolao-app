import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './SignupScreen'

const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    useLocalSearchParams: () => ({}),
    Link: ({ children }: { children: string }) => <Text>{children}</Text>,
  }
})

const mockFetch = jest.fn()

beforeEach(() => {
  mockReplace.mockReset()
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

function loginResponse() {
  return { ok: true, status: 200, text: async () => JSON.stringify({ token: 'jwt', user_id: 'u1', username: 'ana', is_admin: false, must_change_password: false }) }
}

describe('LoginScreen', () => {
  it('logs in by username, keeps the token on the device and opens the app', async () => {
    mockFetch.mockResolvedValueOnce(loginResponse())
    await renderWithProviders(<LoginScreen />)

    await fireEvent.changeText(screen.getByLabelText('Usuário'), ' ana ')
    await fireEvent.changeText(screen.getByLabelText('Senha'), '123')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: 'ana', password: '123' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'jwt')
  })

  it('shows a wrong password', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'usuário ou senha inválidos' }) })
    await renderWithProviders(<LoginScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'x')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('usuário ou senha inválidos')).toBeTruthy()
  })
})

describe('SignupScreen', () => {
  it('creates the account and opens Meus bolões', async () => {
    mockFetch.mockResolvedValueOnce(loginResponse())
    await renderWithProviders(<SignupScreen />)
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Ana Souza')
    await fireEvent.changeText(screen.getByLabelText('Nome de usuário'), 'Ana')
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@example.com')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/boloes'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: 'ana', display_name: 'Ana Souza', email: 'ana@example.com', password: 'segredo123' })
  })
})
