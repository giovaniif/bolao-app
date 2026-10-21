import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { ProfileScreen } from './ProfileScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const ME = { id: 'u-1', username: 'ana', display_name: 'Ana Souza', favorite_team: 'Flamengo', is_admin: false }

function routes() {
  return [
    { path: /^\/me$/, body: ME },
    { path: /^\/teams$/, body: ['Flamengo', 'Palmeiras'] },
    { method: 'PUT', path: /^\/me$/, body: { ...ME, display_name: 'Ana S.', favorite_team: 'Palmeiras' } },
  ]
}

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.setItemAsync('token', 'jwt')
  await SecureStore.setItemAsync('user', JSON.stringify({ id: 'u-1', username: 'ana', isAdmin: false }))
})

describe('ProfileScreen', () => {
  it('shows the profile fields filled in', async () => {
    fakeApi(routes())
    await renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByLabelText('Nome').props.value).toBe('Ana Souza'))
    expect(screen.getByLabelText('Usuário (para login)').props.value).toBe('ana')
    expect(screen.getByRole('button', { name: 'Time do coração: Flamengo' })).toBeTruthy()
  })

  it('saves the name and the favorite team', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByLabelText('Nome').props.value).toBe('Ana Souza'))
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana S.')
    await fireEvent.press(screen.getByRole('button', { name: 'Time do coração: Flamengo' }))
    await fireEvent.press(await screen.findByRole('menuitem', { name: 'Palmeiras' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.getByText('Perfil salvo!')).toBeTruthy())
    const put = calls.find((c) => c.method === 'PUT')
    expect(JSON.parse(put!.body!)).toEqual({ username: 'ana', display_name: 'Ana S.', favorite_team: 'Palmeiras' })
  })

  it('opens the password change', async () => {
    fakeApi(routes())
    await renderWithProviders(<ProfileScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Alterar senha' }))
    expect(router.push).toHaveBeenCalledWith('/alterar-senha')
  })

  it('signs out', async () => {
    fakeApi(routes())
    await renderWithProviders(<ProfileScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'))
  })
})
