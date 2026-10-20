import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router, setParams } from '../test/routerMock'
import { MyBoloesScreen } from './MyBoloesScreen'
import { CreateBolaoScreen } from './CreateBolaoScreen'
import { InviteScreen } from './InviteScreen'
import { MembersScreen } from './MembersScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const MINE = [
  { id: 'b-1', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
  { id: 'b-2', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 5 },
  { id: 'b-3', name: 'Família', status: 'active', role: 'participant', member_status: 'pending', member_count: 8 },
]
const RULES = {
  match: [{ key: 'correct_draw', points: 12, text: 'Acertar que vai dar empate, sem acertar o placar' }],
  round: [{ key: 'round_total_goals', points: 10, text: 'Acertar o total de gols da rodada inteira' }],
  exact_score_variety_bonus: [],
  notes: ['Quem não palpitar um jogo fica com 0 x 0 nele quando o jogo começa.'],
}

beforeEach(async () => {
  jest.clearAllMocks()
  setParams({})
  await SecureStore.setItemAsync('token', 'jwt')
  await SecureStore.deleteItemAsync('bolao')
})

describe('MyBoloesScreen', () => {
  it('lists my bolões and makes the one I tap the current bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }])
    await renderWithProviders(<MyBoloesScreen />)
    expect(await screen.findByText('Firma')).toBeTruthy()
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir Firma' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bolao', 'b-2')
  })

  it('lets the owner manage the bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }])
    await renderWithProviders(<MyBoloesScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Gerenciar Firma' }))
    expect(router.push).toHaveBeenCalledWith({ pathname: '/membros', params: { id: 'b-2' } })
  })
})

describe('CreateBolaoScreen', () => {
  it('shows the rules and creates the bolão on the championship', async () => {
    const calls = fakeApi([
      { path: /^\/me\/boloes$/, body: MINE },
      { path: /^\/competitions$/, body: [{ id: 'c-bsa', name: 'Brasileirão Série A 2026' }] },
      { path: /^\/rules$/, body: RULES },
      { method: 'POST', path: /^\/me\/boloes$/, body: { id: 'b-new', name: 'Amigos' } },
      { method: 'PATCH', path: /^\/boloes\/b-new$/, body: {} },
    ])
    await renderWithProviders(<CreateBolaoScreen />)
    await fireEvent.changeText(screen.getByLabelText('Nome do bolão'), 'Amigos')
    expect(await screen.findByText('Acertar que vai dar empate, sem acertar o placar')).toBeTruthy()
    await fireEvent.press(screen.getByRole('switch', { name: 'Público' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Criar bolão' }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(JSON.parse(calls.find((c) => c.method === 'POST')!.body!)).toEqual({ name: 'Amigos', competition_id: 'c-bsa' })
    expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!)).toEqual({ name: 'Amigos', visibility: 'public', requires_approval: true })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bolao', 'b-new')
  })
})

describe('InviteScreen', () => {
  it('sends a request to join', async () => {
    setParams({ code: 'AMIGOS22' })
    const calls = fakeApi([
      { path: /^\/invites\/AMIGOS22$/, body: { name: 'Amigos', member_count: 12, max_members: 50, joins: 'request' } },
      { method: 'POST', path: /^\/invites\/AMIGOS22\/join$/, body: { bolao_id: 'b-9', status: 'pending' } },
      { path: /^\/me\/boloes$/, body: MINE },
    ])
    await renderWithProviders(<InviteScreen />)
    expect(await screen.findByText('Amigos')).toBeTruthy()
    expect(screen.getByText('12 de 50 participantes')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Pedir para entrar' }))
    expect(await screen.findByText('Pedido enviado. Você entra quando o dono aprovar.')).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST')).toBe(true)
  })
})

describe('MembersScreen', () => {
  it('shows the code and approves a request', async () => {
    setParams({ id: 'b-2' })
    const calls = fakeApi([
      { path: /^\/me\/boloes$/, body: MINE },
      { path: /^\/boloes\/b-2\/invite$/, body: { code: 'FIRMA234' } },
      {
        path: /^\/boloes\/b-2\/members$/,
        body: [
          { id: 'u-1', username: 'ana', display_name: 'Ana', role: 'owner', status: 'active', amount_paid: 0 },
          { id: 'u-2', username: 'caio', display_name: 'Caio', role: 'participant', status: 'pending', amount_paid: 0 },
        ],
      },
      { method: 'POST', path: /^\/boloes\/b-2\/members\/u-2\/approve$/, body: { status: 'active' } },
    ])
    await renderWithProviders(<MembersScreen />)
    expect(await screen.findByText('FIRMA234')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Aprovar Caio' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/approve'))).toBe(true))
  })
})
