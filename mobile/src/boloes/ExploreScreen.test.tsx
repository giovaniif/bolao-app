import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { ExploreScreen } from './ExploreScreen'
import { MyBoloesScreen } from './MyBoloesScreen'
import { StandingsScreen } from '../play/StandingsScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const PUBLIC = [
  { id: 'p-1', name: 'Galera do Futebol', requires_approval: false, max_members: 50, member_count: 12 },
  { id: 'p-2', name: 'Bolão da Firma', requires_approval: true, max_members: 30, member_count: 8 },
  { id: 'p-3', name: 'Lotado FC', requires_approval: false, max_members: 10, member_count: 10 },
]
const JOINED = [{ id: 'p-1', name: 'Galera do Futebol', status: 'active', role: 'participant', member_status: 'active', member_count: 13 }]

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.setItemAsync('token', 'jwt')
  await SecureStore.deleteItemAsync('bolao')
})

describe('ExploreScreen', () => {
  it('lists the open bolões with their places and how to join', async () => {
    fakeApi([{ path: /^\/boloes\/public$/, body: PUBLIC }])
    await renderWithProviders(<ExploreScreen />)
    expect(screen.getByText('Escolha um bolão para jogar')).toBeTruthy()
    expect(await screen.findByText('Galera do Futebol')).toBeTruthy()
    expect(screen.getByText('12 de 50 participantes')).toBeTruthy()
    expect(screen.getByText('8 de 30 participantes · aprovação do dono')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar em Galera do Futebol' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pedir para entrar em Bolão da Firma' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Lotado FC/ })).toBeNull()
    expect(screen.getByText('Lotado')).toBeTruthy()
  })

  it('searches by name after the user stops typing', async () => {
    const calls = fakeApi([
      { path: /^\/boloes\/public\?q=firma$/, body: [PUBLIC[1]] },
      { path: /^\/boloes\/public$/, body: PUBLIC },
    ])
    await renderWithProviders(<ExploreScreen />)
    await screen.findByText('Galera do Futebol')
    await fireEvent.changeText(screen.getByLabelText('Buscar bolões pelo nome'), 'firma')
    await waitFor(() => expect(screen.queryByText('Galera do Futebol')).toBeNull())
    expect(screen.getByText('Bolão da Firma')).toBeTruthy()
    expect(calls.filter((c) => c.path.startsWith('/boloes/public?q=')).map((c) => c.path)).toEqual(['/boloes/public?q=firma'])
  })

  it('says private bolões do not show when a search finds nothing', async () => {
    fakeApi([
      { path: /^\/boloes\/public\?q=xyz$/, body: [] },
      { path: /^\/boloes\/public$/, body: PUBLIC },
    ])
    await renderWithProviders(<ExploreScreen />)
    await fireEvent.changeText(screen.getByLabelText('Buscar bolões pelo nome'), 'xyz')
    expect(await screen.findByText('Nenhum bolão aberto com esse nome.')).toBeTruthy()
    expect(screen.getByText('Bolões privados não aparecem na busca. Peça o código ou o link ao dono.')).toBeTruthy()
  })

  it('joins an open bolão and opens it', async () => {
    const calls = fakeApi([
      { path: /^\/boloes\/public$/, body: PUBLIC },
      { method: 'POST', path: /^\/boloes\/p-1\/join$/, body: { bolao_id: 'p-1', status: 'active' } },
      { path: /^\/me\/boloes$/, body: JOINED },
    ])
    await renderWithProviders(<ExploreScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Entrar em Galera do Futebol' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(calls.some((c) => c.method === 'POST' && c.path === '/boloes/p-1/join')).toBe(true)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bolao', 'p-1')
  })

  it('asks to join a bolão that needs approval and says to wait', async () => {
    fakeApi([
      { path: /^\/boloes\/public$/, body: PUBLIC },
      { method: 'POST', path: /^\/boloes\/p-2\/join$/, body: { bolao_id: 'p-2', status: 'pending' } },
      { path: /^\/me\/boloes$/, body: [] },
    ])
    await renderWithProviders(<ExploreScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Pedir para entrar em Bolão da Firma' }))
    expect(await screen.findByText('Pedido enviado')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('shows why a join failed', async () => {
    fakeApi([
      { path: /^\/boloes\/public$/, body: PUBLIC },
      { method: 'POST', path: /^\/boloes\/p-1\/join$/, status: 409, body: { error: 'o bolão está cheio' } },
    ])
    await renderWithProviders(<ExploreScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Entrar em Galera do Futebol' }))
    expect(await screen.findByText('o bolão está cheio')).toBeTruthy()
  })

  it('opens the code and create screens', async () => {
    fakeApi([{ path: /^\/boloes\/public$/, body: [] }])
    await renderWithProviders(<ExploreScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Tenho um código' }))
    expect(router.push).toHaveBeenCalledWith('/entrar')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar bolão' }))
    expect(router.push).toHaveBeenCalledWith('/criar-bolao')
  })
})

describe('home without a bolão', () => {
  it('opens on Explorar instead of the standings', async () => {
    fakeApi([
      { path: /^\/me\/boloes$/, body: [] },
      { path: /^\/boloes\/public$/, body: PUBLIC },
    ])
    await renderWithProviders(<StandingsScreen />)
    expect(await screen.findByText('Escolha um bolão para jogar')).toBeTruthy()
    expect(await screen.findByText('Galera do Futebol')).toBeTruthy()
  })
})

describe('MyBoloesScreen chips', () => {
  it('switches between my bolões and Explorar', async () => {
    fakeApi([
      { path: /^\/me\/boloes$/, body: JOINED },
      { path: /^\/boloes\/public$/, body: PUBLIC },
    ])
    await renderWithProviders(<MyBoloesScreen />)
    expect(await screen.findByRole('button', { name: 'Abrir Galera do Futebol' })).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }))
    expect(await screen.findByText('Bolão da Firma')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir Galera do Futebol' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Meus bolões' }))
    expect(await screen.findByRole('button', { name: 'Abrir Galera do Futebol' })).toBeTruthy()
  })
})
