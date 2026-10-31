import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { StandingsScreen } from './StandingsScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const MINE = [{ id: 'b-1', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 3 }]
const OVERALL = [
  { id: 'u-1', username: 'ana', display_name: 'Ana', favorite_team: 'Flamengo', total_points: 120, exact_scores: 6, correct_results: 14 },
  { id: 'u-2', username: 'bia', display_name: 'Bia', total_points: 98, exact_scores: 4, correct_results: 12 },
]
const ROUND_3 = [{ id: 'u-2', username: 'bia', display_name: 'Bia', total_points: 21, exact_scores: 1, correct_results: 3 }]

function routes() {
  return [
    { path: /^\/me\/boloes$/, body: MINE },
    { path: /^\/boloes\/b-1\/matches\/rounds\/summary$/, body: { rounds: [1, 2, 3], active: 3, pending_results: 0 } },
    { path: /^\/boloes\/b-1\/classification\?round=3$/, body: ROUND_3 },
    { path: /^\/boloes\/b-1\/classification$/, body: OVERALL },
  ]
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('StandingsScreen', () => {
  it('lists the overall standings with rank, team and stats', async () => {
    fakeApi(routes())
    await renderWithProviders(<StandingsScreen />)
    expect(await screen.findByText('Ana')).toBeTruthy()
    expect(screen.getByText('1º')).toBeTruthy()
    expect(screen.getByText('2º')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('Flamengo')).toBeTruthy()
    expect(screen.getByText('6 placares · 14 resultados')).toBeTruthy()
    expect(screen.queryByText('Firma')).toBeNull()
  })

  it('starts on Geral and switches to one round', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<StandingsScreen />)
    await screen.findByText('Ana')
    expect(screen.getByRole('button', { name: 'Geral' }).props.accessibilityState).toEqual({ selected: true })

    await fireEvent.press(await screen.findByRole('button', { name: 'Rodada 3' }))

    expect(await screen.findByText('21')).toBeTruthy()
    expect(screen.queryByText('Ana')).toBeNull()
    expect(calls.some((c) => c.path === '/boloes/b-1/classification?round=3')).toBe(true)
  })

  it('links to the Hall dos Campeões with the latest champion when a bolão has finished', async () => {
    const finished = { id: 'b-0', name: 'Brasileirão 2025', status: 'finished', role: 'participant', member_status: 'active', member_count: 3, started_at: '2025-03-01T00:00:00Z', finished_at: '2025-12-01T00:00:00Z' }
    fakeApi([
      { path: /^\/me\/boloes$/, body: [...MINE, finished] },
      { path: /^\/boloes\/b-0\/classification$/, body: [{ id: 'u-9', username: 'maria', display_name: 'Maria Silva', total_points: 1240, exact_scores: 21, correct_results: 40, rounds_won: 7 }] },
      ...routes().slice(1),
    ])
    await renderWithProviders(<StandingsScreen />)
    expect(await screen.findByText('Último: Maria Silva · 2025')).toBeTruthy()
    await fireEvent.press(screen.getByRole('link', { name: /Hall dos Campeões/ }))
    expect(router.push).toHaveBeenCalledWith('/campeoes')
  })

  it('shows the Hall dos Campeões card to every member, even before a bolão has finished', async () => {
    fakeApi(routes())
    await renderWithProviders(<StandingsScreen />)
    await screen.findByText('Ana')
    expect(screen.getByText('Campeões das temporadas encerradas')).toBeTruthy()
    await fireEvent.press(screen.getByRole('link', { name: /Hall dos Campeões/ }))
    expect(router.push).toHaveBeenCalledWith('/campeoes')
  })

  it('refetches the standings on pull to refresh', async () => {
    const calls = fakeApi(routes())
    await renderWithProviders(<StandingsScreen />)
    await screen.findByText('Ana')
    const before = calls.filter((c) => c.path === '/boloes/b-1/classification').length

    const control = screen.getByTestId('standings-list').props.refreshControl
    expect(control.props.refreshing).toBe(false)
    await act(async () => {
      await control.props.onRefresh()
    })

    await waitFor(() => expect(calls.filter((c) => c.path === '/boloes/b-1/classification').length).toBe(before + 1))
    expect(screen.getByTestId('standings-list').props.refreshControl.props.refreshing).toBe(false)
  })
})
