import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi, type Route } from '../test/fakeApi'
import { RoundScreen } from './RoundScreen'

const past = new Date(Date.now() - 86_400_000).toISOString()
const future = new Date(Date.now() + 86_400_000).toISOString()

const MINE = [{ id: 'b-1', name: 'Bolão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 3 }]
const MEMBERS = [
  { id: 'u-ana', username: 'ana', display_name: 'Ana Souza', role: 'owner', status: 'active' },
  { id: 'u-bruno', username: 'bruno', display_name: 'Bruno Lima', role: 'participant', status: 'active' },
  { id: 'u-carla', username: 'carla', display_name: 'Carla Dias', role: 'participant', status: 'active' },
  { id: 'u-eva', username: 'eva', display_name: 'Eva Martins', role: 'participant', status: 'pending' },
]
const PARTIALS = [
  { id: 'm-1', home_team: 'Flamengo', away_team: 'Palmeiras', partial_home: 2, partial_away: 1 },
  { id: 'm-2', home_team: 'Bahia', away_team: 'Santos' },
]
const MATCHES = [
  { id: 'm-1', round: 5, home_team: 'Flamengo', away_team: 'Palmeiras', market_closes_at: past, home_goals: 2, away_goals: 1 },
  { id: 'm-2', round: 5, home_team: 'Bahia', away_team: 'Santos', market_closes_at: past },
]

function routes(overrides: Route[] = []): Route[] {
  return [
    ...overrides,
    { path: /^\/me\/boloes$/, body: MINE },
    { path: /^\/boloes\/b-1\/matches\/rounds\/summary$/, body: { rounds: [4, 5], active: 5, pending_results: 0 } },
    { path: /^\/boloes\/b-1\/members$/, body: MEMBERS },
    { path: /^\/boloes\/b-1\/parciais\/round\/5$/, body: PARTIALS },
    { path: /^\/boloes\/b-1\/parciais\/round\/5\/classification$/, body: [{ id: 'u-ana', display_name: 'Ana Souza', total_points: 12, exact_scores: 1, correct_results: 1 }] },
    { path: /^\/boloes\/b-1\/matches\/round\/5$/, body: MATCHES },
    { path: /^\/boloes\/b-1\/predictions\/round\/5\/user\/u-bruno$/, body: [{ id: 'p-1', user_id: 'u-bruno', match_id: 'm-1', home_goals: 3, away_goals: 0 }] },
    { method: 'PUT', path: /^\/parciais\/match\/m-\d$/, body: {} },
    { method: 'DELETE', path: /^\/parciais\/match\/m-\d$/, body: null, status: 204 },
  ]
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('RoundScreen', () => {
  it('shows the round, the player count and the partial scores', async () => {
    fakeApi(routes())
    await renderWithProviders(<RoundScreen />)
    expect(await screen.findByText('3 jogadores')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rodada 4' })).toBeTruthy()
    expect(await screen.findByText('2 × 1')).toBeTruthy()
    expect(screen.getByText('– × –')).toBeTruthy()
    expect(screen.getByText('Classificação baseada nas parciais')).toBeTruthy()
    expect(screen.getByText('1. Ana Souza')).toBeTruthy()
    expect(screen.getByText('12 pts')).toBeTruthy()
  })

  it('saves a partial the user entered and skips untouched matches', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<RoundScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar parciais' }))
    await fireEvent.press(screen.getByLabelText('Mais um gol de Bahia'))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar parciais' }))

    await waitFor(() => expect(screen.getByText('Parciais salvos!')).toBeTruthy())
    const puts = calls.filter((c) => c.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0].path).toBe('/parciais/match/m-2')
    expect(JSON.parse(puts[0].body!)).toEqual({ home_goals: 1, away_goals: 0 })
  })

  it('clears a saved partial', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<RoundScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar parciais' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar parcial de Flamengo x Palmeiras' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/parciais/match/m-1')).toBe(true))
  })

  it('shows the predictions of a player in Galera after the market closes', async () => {
    fakeApi(routes())
    await renderWithProviders(<RoundScreen />)
    await fireEvent.press(await screen.findByRole('tab', { name: 'Galera' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Bruno Lima' }))
    expect(await screen.findByText('Palpites de Bruno Lima')).toBeTruthy()
    expect(await screen.findByText('3 × 0')).toBeTruthy()
    expect(screen.getByText('Resultado: 2 × 1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Eva Martins' })).toBeNull()
  })

  it('hides the predictions while the market is open', async () => {
    fakeApi(routes([{ path: /^\/boloes\/b-1\/matches\/round\/5$/, body: MATCHES.map((m) => ({ ...m, market_closes_at: future })) }]))
    await renderWithProviders(<RoundScreen />)
    await fireEvent.press(await screen.findByRole('tab', { name: 'Galera' }))
    expect(await screen.findByText(/O mercado desta rodada ainda não fechou/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bruno Lima' })).toBeNull()
  })
})
