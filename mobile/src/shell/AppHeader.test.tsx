import { fireEvent, screen } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { AppHeader } from './AppHeader'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const MINE = [
  { id: 'b-1', name: 'Bolão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
  { id: 'b-2', name: 'Bolão da Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 7 },
]

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.setItemAsync('token', 'jwt')
  await SecureStore.setItemAsync('user', JSON.stringify({ id: 'u-1', username: 'ana', isAdmin: false }))
  await SecureStore.deleteItemAsync('bolao')
})

describe('AppHeader', () => {
  it('shows the brand, the page title and the current bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    expect(screen.getByText('Bolão')).toBeTruthy()
    expect(screen.getByText('Palpites')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Trocar bolão: Bolão 2026' })).toBeTruthy()
  })

  it('switches to another bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Trocar bolão: Bolão 2026' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Bolão da Firma' }))
    expect(await screen.findByRole('button', { name: 'Trocar bolão: Bolão da Firma' })).toBeTruthy()
  })

  it('hides the switcher with only one bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: [MINE[0]] }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    expect(await screen.findByText('AS')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Trocar bolão/ })).toBeNull()
  })

  it('opens Meus bolões from the profile menu', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Meus bolões' }))
    expect(router.push).toHaveBeenCalledWith('/meus-boloes')
  })

  it('signs out from the profile menu', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Sair' }))
    expect(router.replace).toHaveBeenCalledWith('/login')
    expect(await SecureStore.getItemAsync('token')).toBeNull()
  })
})

describe('AppHeader profile menu', () => {
  it('opens Perfil', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Perfil' }))
    expect(router.push).toHaveBeenCalledWith('/perfil')
  })
})
