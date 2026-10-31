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
  it('shows one match per card, starting with the first match of the active round', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    expect(await screen.findByText('Flamengo')).toBeTruthy()
    expect(screen.getByText('Rodada 32')).toBeTruthy()
    expect(screen.getByText('Jogo 1 de 2')).toBeTruthy()
    expect(screen.getByText('Arraste para o próximo ou anterior')).toBeTruthy()
    expect(screen.getByText('Mandante')).toBeTruthy()
    expect(screen.getByText('Visitante')).toBeTruthy()
    expect(screen.getByText('Palmeiras')).toBeTruthy()
    expect(screen.queryByText('Bahia')).toBeNull()
    expect(screen.getByLabelText('Gols de Flamengo').props.children).toBe(0)
  })

  it('moves between cards with Próximo and Anterior', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')
    expect(screen.getByRole('button', { name: 'Anterior' }).props.accessibilityState).toMatchObject({ disabled: true })

    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByText('Jogo 2 de 2')).toBeTruthy()
    expect(screen.getByText('Bahia')).toBeTruthy()
    expect(screen.getByText('Resultado: 1 × 0')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Próximo' }).props.accessibilityState).toMatchObject({ disabled: true })

    await fireEvent.press(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByText('Jogo 1 de 2')).toBeTruthy()
  })

  it('cannot change a closed match', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByLabelText('Mais um gol de Bahia').props.accessibilityState).toMatchObject({ disabled: true })
    await fireEvent.press(screen.getByLabelText('Mais um gol de Bahia'))
    expect(screen.getByLabelText('Gols de Bahia').props.children).toBe(2)
  })

  it('jumps to a match from the summary', async () => {
    fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')
    await fireEvent.press(screen.getByRole('button', { name: 'Ver resumo dos jogos' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Bahia × Santos' }))
    expect(screen.getByText('Jogo 2 de 2')).toBeTruthy()
  })

  it('saves only the open matches and then shows the summary', async () => {
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
    expect(screen.getAllByText('2 × 1')).toHaveLength(2)
    expect(screen.getByText('Fechado')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Editar palpites' }))
    expect(screen.getByText('Jogo 1 de 2')).toBeTruthy()
  })

  it('asks a user without bolões to join one', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: [] }])
    await renderWithProviders(<PredictScreen />)
    expect(await screen.findByText('Entre em um bolão para palpitar.')).toBeTruthy()
  })

  it('saves a changed palpite in the background when the user moves to the next card', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')

    await fireEvent.press(screen.getByLabelText('Mais um gol de Flamengo'))
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }))

    expect(screen.getByText('Jogo 2 de 2')).toBeTruthy()
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1))
    const post = calls.find((c) => c.method === 'POST')
    expect(JSON.parse(post!.body!)).toEqual({ predictions: [{ match_id: 'm-1', home_goals: 1, away_goals: 0 }] })
    expect(await screen.findByText('Flamengo × Palmeiras salvo')).toBeTruthy()
  })

  it('does not save when the user leaves a card without changing it', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<PredictScreen />)
    await screen.findByText('Flamengo')
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Anterior' }))
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })
})
