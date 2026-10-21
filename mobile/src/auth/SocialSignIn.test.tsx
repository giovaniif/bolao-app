import { Platform } from 'react-native'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { SocialSignIn } from './SocialSignIn'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

let mockConfig = { googleWebClientId: '', googleIosClientId: '' }
jest.mock('./socialConfig', () => ({
  socialConfig: () => mockConfig,
}))

const mockAppleAvailable = jest.fn()
const mockAppleSignIn = jest.fn()
jest.mock('expo-apple-authentication', () => {
  const { Pressable: MockPressable, Text: MockText } = jest.requireActual('react-native')
  return {
    isAvailableAsync: () => mockAppleAvailable(),
    signInAsync: (options: unknown) => mockAppleSignIn(options),
    AppleAuthenticationScope: { EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <MockPressable accessibilityRole="button" accessibilityLabel="Continuar com a Apple" onPress={onPress}>
        <MockText>Continuar com a Apple</MockText>
      </MockPressable>
    ),
  }
})

const mockGoogleConfigure = jest.fn()
const mockGoogleSignIn = jest.fn()
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (options: unknown) => mockGoogleConfigure(options),
    hasPlayServices: async () => true,
    signIn: () => mockGoogleSignIn(),
  },
}))

const mockFetch = jest.fn()

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) }
}

const loginBody = { token: 'jwt', user_id: 'u1', username: 'ana', is_admin: false, must_change_password: false }

beforeEach(() => {
  mockConfig = { googleWebClientId: '', googleIosClientId: '' }
  mockReplace.mockReset()
  mockFetch.mockReset()
  mockAppleAvailable.mockReset().mockResolvedValue(false)
  mockAppleSignIn.mockReset()
  mockGoogleConfigure.mockReset()
  mockGoogleSignIn.mockReset()
  Platform.OS = 'ios'
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

describe('SocialSignIn', () => {
  it('shows nothing when Apple is unavailable and Google is not configured', async () => {
    await renderWithProviders(<SocialSignIn next="/" />)
    await waitFor(() => expect(mockAppleAvailable).toHaveBeenCalled())
    expect(screen.queryByText('ou')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continuar com o Google' })).toBeNull()
  })

  it('signs in with Apple on iOS and opens the next screen', async () => {
    mockAppleAvailable.mockResolvedValue(true)
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token' })
    mockFetch.mockResolvedValueOnce(respond(200, loginBody))
    await renderWithProviders(<SocialSignIn next="/convite/AMIGOS22" />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/convite/AMIGOS22'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ provider: 'apple', id_token: 'apple-token' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'jwt')
  })

  it('hides Apple on Android', async () => {
    Platform.OS = 'android'
    mockAppleAvailable.mockResolvedValue(true)
    mockConfig = { googleWebClientId: 'web-id', googleIosClientId: '' }
    await renderWithProviders(<SocialSignIn next="/" />)

    expect(await screen.findByRole('button', { name: 'Continuar com o Google' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continuar com a Apple' })).toBeNull()
  })

  it('needs the iOS client id to show Google on iOS', async () => {
    mockConfig = { googleWebClientId: 'web-id', googleIosClientId: '' }
    await renderWithProviders(<SocialSignIn next="/" />)
    await waitFor(() => expect(mockAppleAvailable).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Continuar com o Google' })).toBeNull()
  })

  it('asks for a username on the first Google login and creates the account', async () => {
    mockConfig = { googleWebClientId: 'web-id', googleIosClientId: 'ios-id' }
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } })
    mockFetch
      .mockResolvedValueOnce(respond(409, { needs_username: true, error: 'escolha um nome de usuário' }))
      .mockResolvedValueOnce(respond(201, loginBody))
    await renderWithProviders(<SocialSignIn next="/meus-boloes" />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await fireEvent.changeText(await screen.findByLabelText('Nome de usuário'), 'Ana')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/meus-boloes'))
    expect(mockGoogleConfigure).toHaveBeenCalledWith(expect.objectContaining({ webClientId: 'web-id', iosClientId: 'ios-id' }))
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ provider: 'google', id_token: 'google-token', username: 'ana' })
  })

  it('does nothing when the user cancels Google', async () => {
    mockConfig = { googleWebClientId: 'web-id', googleIosClientId: 'ios-id' }
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled', data: null })
    await renderWithProviders(<SocialSignIn next="/" />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))

    await waitFor(() => expect(mockGoogleSignIn).toHaveBeenCalled())
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows the API error', async () => {
    mockAppleAvailable.mockResolvedValue(true)
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token' })
    mockFetch.mockResolvedValueOnce(respond(401, { error: 'login inválido, tente novamente' }))
    await renderWithProviders(<SocialSignIn next="/" />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))

    expect(await screen.findByText('login inválido, tente novamente')).toBeTruthy()
  })
})

