import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { OnboardingScreen } from './OnboardingScreen'
import { setPendingSignup } from './pendingSignup'
import { deriveUsername } from './deriveUsername'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const TEAMS = ['Athletico-PR', 'Atlético-MG', 'Flamengo', 'Palmeiras', 'São Paulo']
const LOGIN = { token: 'jwt', user_id: 'u1', username: 'ana.souza', is_admin: false, must_change_password: false }
const PROFILE = { id: 'u1', username: 'ana.souza', display_name: 'Ana Souza', is_admin: false }

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.deleteItemAsync('token')
  setPendingSignup({ provider: 'apple', idToken: 'apple-token', suggestedUsername: 'ana.souza', name: 'Ana Souza', next: '/meus-boloes' })
})

function step1Routes(available = true) {
  return [
    { path: /^\/auth\/username-available\?username=ana\.souza$/, body: { valid: true, available } },
    { path: /^\/auth\/username-available\?username=ana$/, body: { valid: true, available: true } },
    { method: 'POST', path: /^\/auth\/social$/, status: 201, body: LOGIN },
    { path: /^\/teams$/, body: TEAMS },
    { path: /^\/me$/, body: PROFILE },
    { method: 'PUT', path: /^\/me$/, body: { ...PROFILE, favorite_team: 'Flamengo' } },
  ]
}

describe('OnboardingScreen', () => {
  it('prefills the suggested username and says it is available', async () => {
    fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    expect(screen.getByText('Como você quer aparecer no bolão?')).toBeTruthy()
    expect(screen.getByText('1 de 2')).toBeTruthy()
    expect(screen.getByLabelText('Nome de usuário').props.value).toBe('ana.souza')
    expect(await screen.findByText('Disponível')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('says a taken username is in use and blocks Continuar', async () => {
    fakeApi(step1Routes(false))
    await renderWithProviders(<OnboardingScreen />)
    expect(await screen.findByText('Em uso')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('explains the username format without calling the API', async () => {
    const calls = fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    await fireEvent.changeText(screen.getByLabelText('Nome de usuário'), 'a!')
    expect(await screen.findByText('Use de 3 a 30 letras, números, ponto ou _')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(calls.some((c) => c.path.includes('username=a!'))).toBe(false)
  })

  it('creates the account, saves the team and enters the app', async () => {
    const calls = fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    await screen.findByText('Disponível')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Pra qual time você torce?')).toBeTruthy()
    expect(screen.getByText('2 de 2')).toBeTruthy()
    const social = calls.find((c) => c.method === 'POST' && c.path === '/auth/social')!
    expect(JSON.parse(social.body!)).toEqual({ provider: 'apple', id_token: 'apple-token', username: 'ana.souza', name: 'Ana Souza' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'jwt')

    await fireEvent.changeText(screen.getByLabelText('Buscar time'), 'fla')
    expect(screen.queryByRole('button', { name: 'Palmeiras' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Flamengo' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Começar' }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/meus-boloes'))
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/me')!
    expect(JSON.parse(put.body!)).toEqual({ username: 'ana.souza', display_name: 'Ana Souza', favorite_team: 'Flamengo' })
  })

  it('lets the user skip the team', async () => {
    const calls = fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    await screen.findByText('Disponível')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Pular por agora' }))
    expect(router.replace).toHaveBeenCalledWith('/meus-boloes')
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('derives the username from the name when the API suggests none', async () => {
    setPendingSignup({ provider: 'apple', idToken: 'apple-token', suggestedUsername: '', name: 'Ana', next: '/' })
    fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    expect(screen.getByLabelText('Nome de usuário').props.value).toBe('ana')
  })
})

describe('deriveUsername', () => {
  it('lowercases, drops accents and joins words with a dot', () => {
    expect(deriveUsername('João  da Silva')).toBe('joao.da.silva')
    expect(deriveUsername("Ana O'Brien-Souza")).toBe('ana.obriensouza')
    expect(deriveUsername('')).toBe('')
  })
})

describe('team step badges', () => {
  it('shows a generic initials badge for each team', async () => {
    fakeApi(step1Routes())
    await renderWithProviders(<OnboardingScreen />)
    await screen.findByText('Disponível')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Pra qual time você torce?')

    expect(await screen.findByTestId('badge:Flamengo')).toBeTruthy()
    expect(screen.getByText('FLA')).toBeTruthy()
  })
})
