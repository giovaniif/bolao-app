import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { LoginScreen } from './LoginScreen'
import { setLoginNotice } from '../api/session'
import { SignupScreen } from './SignupScreen'

const mockReplace = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    Link: ({ children }: { children: string }) => <Text>{children}</Text>,
  }
})

const mockFetch = jest.fn()

beforeEach(() => {
  mockParams = {}
  mockReplace.mockReset()
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

function loginResponse(mustChange = false) {
  return { ok: true, status: 200, text: async () => JSON.stringify({ token: 'jwt', user_id: 'u1', username: 'ana', is_admin: false, must_change_password: mustChange }) }
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

  it('asks for a new password when the account must change it', async () => {
    mockFetch.mockResolvedValueOnce(loginResponse(true))
    await renderWithProviders(<LoginScreen />)

    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'temporaria')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/alterar-senha'))
  })

  it('goes back to the invite after logging in', async () => {
    mockParams = { voltar: '/convite/AMIGOS22' }
    mockFetch.mockResolvedValueOnce(loginResponse())
    await renderWithProviders(<LoginScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), '123')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/convite/AMIGOS22'))
  })

  it('ignores a voltar that leaves the app', async () => {
    mockParams = { voltar: 'https://evil.example' }
    mockFetch.mockResolvedValueOnce(loginResponse())
    await renderWithProviders(<LoginScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), '123')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('shows a wrong password', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'usuário ou senha inválidos' }) })
    await renderWithProviders(<LoginScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'x')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('usuário ou senha inválidos')).toBeTruthy()
    expect(screen.getByText('Esqueci minha senha')).toBeTruthy()
  })

  it('hides the forgot password link before a failed login', async () => {
    await renderWithProviders(<LoginScreen />)
    expect(screen.queryByText('Esqueci minha senha')).toBeNull()
  })

  it('keeps the forgot password link hidden when the login fails for another reason', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'erro interno' }) })
    await renderWithProviders(<LoginScreen />)
    await fireEvent.changeText(screen.getByLabelText('Usuário'), 'ana')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'x')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('erro interno')).toBeTruthy()
    expect(screen.queryByText('Esqueci minha senha')).toBeNull()
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

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/meus-boloes'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: 'ana', display_name: 'Ana Souza', email: 'ana@example.com', password: 'segredo123' })
  })

  it('shows why the user was sent back to the login', async () => {
    setLoginNotice('Sua sessão expirou. Entre de novo.')
    await renderWithProviders(<LoginScreen />)
    expect(await screen.findByText('Sua sessão expirou. Entre de novo.')).toBeTruthy()
  })
})
