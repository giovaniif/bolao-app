import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { PredictScreen } from './PredictScreen'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

const MINE = [{ id: 'b-1', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 }]
const MATCHES = [
  { id: 'm-1', round: 32, home_team: 'Flamengo', away_team: 'Palmeiras', market_closes_at: future },
  { id: 'm-2', round: 32, home_team: 'Bahia', away_team: 'Santos', market_closes_at: past, home_goals: 1, away_goals: 0 },
]

function routes() {
  return [
    { path: /^\/me\/boloes$/, body: MINE },
    { path: /^\/boloes\/b-1\/matches\/rounds\/summary$/, body: { rounds: [31, 32], active: 32, pending_results: 0 } },
    { path: /^\/boloes\/b-1\/matches\/round\/32$/, body: MATCHES },
    { path: /^\/boloes\/b-1\/predictions\?round=32$/, body: [{ match_id: 'm-1', home_goals: -1, away_goals: -1 }, { match_id: 'm-2', home_goals: 2, away_goals: 1 }] },
    { method: 'POST', path: /^\/boloes\/b-1\/predictions$/, body: { message: 'palpites salvos' } },
  ]
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('PredictScreen', () => {
  it('shows the active round of the current bolão with its matches', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    expect(await screen.findByText('Flamengo')).toBeTruthy()
    expect(screen.getByText('Rodada 32')).toBeTruthy()
    expect(screen.getByText('Brasileirão 2026')).toBeTruthy()
    expect(screen.getByLabelText('Gols de Flamengo').props.children).toBe(0)
    expect(screen.getByText('Fechado')).toBeTruthy()
  })

  it('saves only the open matches', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')

    await fireEvent.press(screen.getByLabelText('Mais um gol de Flamengo'))
    await fireEvent.press(screen.getByLabelText('Mais um gol de Flamengo'))
    await fireEvent.press(screen.getByLabelText('Mais um gol de Palmeiras'))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar palpites' }))

    await waitFor(() => expect(screen.getByText('Palpites salvos!')).toBeTruthy())
    const post = calls.find((c) => c.method === 'POST')
    expect(JSON.parse(post!.body!)).toEqual({ predictions: [{ match_id: 'm-1', home_goals: 2, away_goals: 1 }] })
  })

  it('cannot change a closed match', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Bahia')
    expect(screen.queryByLabelText('Mais um gol de Bahia')).toBeNull()
  })

  it('asks a user without bolões to join one', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: [] }])
    await renderWithProviders(<PredictScreen />)
    expect(await screen.findByText('Entre em um bolão para palpitar.')).toBeTruthy()
  })
})
