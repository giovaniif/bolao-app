import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi, type Route } from '../test/fakeApi'
import { AdminScreen } from './AdminScreen'

const MATCHES = [
  { id: 'm-1', round: 7, market_closes_at: '2026-10-24T19:00:00Z', home_team: 'Flamengo', away_team: 'Palmeiras', home_goals: 2, away_goals: 1, provider_match_id: 11, locked: false },
  { id: 'm-2', round: 7, home_team: 'Bahia', away_team: 'Santos', home_goals: 0, away_goals: 0, provider_match_id: 12, locked: true },
  { id: 'm-3', round: 7, home_team: 'Ceará', away_team: 'Vitória', locked: false },
]
const ACTIVE = { id: 'b-1', name: 'Bolão 2026', status: 'active', started_at: '2026-04-01T00:00:00Z' }
const MINE = [
  { id: 'b-1', name: 'Bolão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 9 },
  { id: 'b-2', name: 'Liga do Trabalho', status: 'active', role: 'owner', member_status: 'active', member_count: 4 },
  { id: 'b-3', name: 'Bolão 2025', status: 'finished', role: 'participant', member_status: 'active', member_count: 9 },
]
const PARTICIPANTS = [{ id: 'u-2', username: 'bruno', display_name: 'Bruno Lima', is_admin: false, amount_paid: 50, joined_at: '2026-04-01T00:00:00Z' }]

function routes(extra: Route[] = []): Route[] {
  return [
    ...extra,
    { path: /^\/me\/boloes$/, body: MINE },
    { path: /^\/boloes\/b-[12]\/matches\/rounds\/summary$/, body: { rounds: [6, 7], active: 7, pending_results: 1 } },
    { path: /^\/boloes\/b-1\/matches\/round\/7$/, body: MATCHES },
    { path: /^\/boloes\/b-2\/matches\/round\/7$/, body: [{ id: 'm-9', round: 7, home_team: 'Grêmio', away_team: 'Inter', locked: false }] },
    { path: /^\/boloes\/active$/, body: ACTIVE },
    { path: /^\/boloes\/b-1\/participants$/, body: PARTICIPANTS },
    { method: 'PUT', path: /^\/boloes\/b-1\/matches\/m-3\/results$/, body: { ...MATCHES[2], home_goals: 1, away_goals: 0, locked: true } },
    { method: 'DELETE', path: /^\/boloes\/b-1\/matches\/m-2\/lock$/, body: { ...MATCHES[1], locked: false } },
    { method: 'PUT', path: /^\/boloes\/b-2\/matches\/m-9\/results$/, body: { id: 'm-9', round: 7, home_team: 'Grêmio', away_team: 'Inter', home_goals: 1, away_goals: 0, locked: true } },
    { method: 'PUT', path: /^\/boloes\/b-1\/matches\/round\/7\/closes$/, body: MATCHES },
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
    expect(put.path).toBe('/boloes/b-1/matches/m-3/results')
    expect(JSON.parse(put.body!)).toEqual({ home_goals: 1, away_goals: 0 })
  })

  it('hands a corrected match back to the feed', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar ao automático' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/boloes/b-1/matches/m-2/lock')).toBe(true))
  })

  it('offers only the active bolões in the picker', async () => {
    fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    expect(await screen.findByRole('button', { name: 'Bolão Liga do Trabalho' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bolão Bolão 2026' }).props.accessibilityState).toEqual({ selected: true })
    expect(screen.queryByRole('button', { name: 'Bolão Bolão 2025' })).toBeNull()
  })

  it('overrides a result in another bolão', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Bolão Liga do Trabalho' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Definir resultado de Grêmio x Inter' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Mais um gol de Grêmio' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar resultado' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.path === '/boloes/b-2/matches/m-9/results')).toBe(true))
  })

  it('edits the close time of the round', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<AdminScreen />)
    const field = await screen.findByLabelText('Fechamento da rodada (dd/mm hh:mm)')
    await fireEvent.changeText(field, '25/10 16:30')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar fechamento' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.path === '/boloes/b-1/matches/round/7/closes')).toBe(true))
    const put = calls.find((c) => c.path === '/boloes/b-1/matches/round/7/closes')!
    expect(JSON.parse(put.body!)).toEqual({ market_closes_at: new Date(2026, 9, 25, 16, 30).toISOString() })
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
