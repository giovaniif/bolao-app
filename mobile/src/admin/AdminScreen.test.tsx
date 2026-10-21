import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi, type Route } from '../test/fakeApi'
import { AdminScreen } from './AdminScreen'

const MATCHES = [
  { id: 'm-1', round: 7, home_team: 'Flamengo', away_team: 'Palmeiras', home_goals: 2, away_goals: 1, provider_match_id: 11, locked: false },
  { id: 'm-2', round: 7, home_team: 'Bahia', away_team: 'Santos', home_goals: 0, away_goals: 0, provider_match_id: 12, locked: true },
  { id: 'm-3', round: 7, home_team: 'Ceará', away_team: 'Vitória', locked: false },
]
const ACTIVE = { id: 'b-1', name: 'Bolão 2026', status: 'active', started_at: '2026-04-01T00:00:00Z' }
const PARTICIPANTS = [{ id: 'u-2', username: 'bruno', display_name: 'Bruno Lima', is_admin: false, amount_paid: 50, joined_at: '2026-04-01T00:00:00Z' }]

function routes(extra: Route[] = []): Route[] {
  return [
    ...extra,
    { path: /^\/matches\/rounds\/summary$/, body: { rounds: [6, 7], active: 7, pending_results: 1 } },
    { path: /^\/matches\/round\/7$/, body: MATCHES },
    { path: /^\/boloes\/active$/, body: ACTIVE },
    { path: /^\/boloes\/b-1\/participants$/, body: PARTICIPANTS },
    { method: 'PUT', path: /^\/matches\/m-3\/results$/, body: { ...MATCHES[2], home_goals: 1, away_goals: 0, locked: true } },
    { method: 'DELETE', path: /^\/matches\/m-2\/lock$/, body: { ...MATCHES[1], locked: false } },
    { method: 'PUT', path: /^\/boloes\/b-1\/participants\/u-2$/, body: { message: 'ok' } },
  ]
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('AdminScreen', () => {
  it('lists the matches of the active round with their feed state', async () => {
    fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    expect(await screen.findByText('Flamengo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rodada 7' }).props.accessibilityState).toEqual({ selected: true })
    expect(screen.getAllByText('Automático')).toHaveLength(1)
    expect(screen.getByText('Corrigido')).toBeTruthy()
  })

  it('sets the result of a match', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Definir resultado de Ceará x Vitória' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Mais um gol de Ceará' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar resultado' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT')!
    expect(JSON.parse(put.body!)).toEqual({ home_goals: 1, away_goals: 0 })
  })

  it('hands a corrected match back to the feed', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar ao automático' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/matches/m-2/lock')).toBe(true))
  })

  it('edits the amount a participant paid', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('tab', { name: 'Participantes' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar valor pago de Bruno Lima' }))
    await fireEvent.changeText(screen.getByLabelText('Valor pago'), '70')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar valor' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    expect(JSON.parse(calls.find((c) => c.method === 'PUT')!.body!)).toEqual({ amount_paid: 70 })
  })

  it('finishes the bolão after a confirmation, forcing when matches lack results', async () => {
    const calls = fakeApi(routes([
      { method: 'POST', path: /^\/boloes\/active\/finish$/, status: 409, body: { error: 'jogos sem resultado', rounds: [7], count: 1 } },
    ]))
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('tab', { name: 'Bolão' }))
    expect(await screen.findByText('Bolão 2026')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar bolão' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar finalização' }))
    expect(await screen.findByText('Há jogos sem resultado definido.')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar mesmo assim' }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2))
    expect(JSON.parse(calls.filter((c) => c.method === 'POST')[1].body!)).toEqual({ force: true })
  })
})
