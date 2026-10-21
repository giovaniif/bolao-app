import { fireEvent, screen } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { ChampionsScreen } from './ChampionsScreen'

const MINE = [
  { id: 'b-2025', name: 'Brasileirão 2025', status: 'finished', role: 'participant', member_status: 'active', member_count: 4, started_at: '2025-03-01T00:00:00Z', finished_at: '2025-12-01T00:00:00Z' },
  { id: 'b-2024', name: 'Brasileirão 2024', status: 'finished', role: 'participant', member_status: 'active', member_count: 2, started_at: '2024-03-01T00:00:00Z', finished_at: '2024-12-01T00:00:00Z' },
  { id: 'b-2026', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 4, started_at: '2026-03-01T00:00:00Z' },
]

function person(id: string, name: string, points: number, team?: string) {
  return { id, username: id, display_name: name, favorite_team: team, total_points: points, exact_scores: 21, correct_results: 40, rounds_won: 7 }
}

const RANKING_2025 = [
  person('maria', 'Maria Silva', 1240, 'Flamengo'),
  person('joao', 'João', 1200, 'Palmeiras'),
  person('ana', 'Ana', 1100),
  person('bia', 'Bia', 900),
]
const RANKING_2024 = [person('joao', 'João', 800), person('maria', 'Maria Silva', 700)]

function routes(boloes: unknown[] = MINE) {
  return [
    { path: /^\/me\/boloes$/, body: boloes },
    { path: /^\/boloes\/b-2025\/classification$/, body: RANKING_2025 },
    { path: /^\/boloes\/b-2024\/classification$/, body: RANKING_2024 },
    { path: /^\/boloes\/b-2025\/matches\/rounds\/summary$/, body: { rounds: Array.from({ length: 38 }, (_, i) => i + 1), active: 38, pending_results: 0 } },
    { path: /^\/boloes\/b-2024\/matches\/rounds\/summary$/, body: { rounds: [1, 2], active: 2, pending_results: 0 } },
  ]
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('ChampionsScreen', () => {
  it('shows the latest champion with the podium and the final standings', async () => {
    fakeApi(routes())
    await renderWithProviders(<ChampionsScreen />)
    expect(await screen.findByText('CAMPEÃO 2025')).toBeTruthy()
    expect(screen.getByText('Maria Silva')).toBeTruthy()
    expect(screen.getByText('Flamengo · venceu por 40 pontos')).toBeTruthy()
    expect(await screen.findByText('38 rodadas')).toBeTruthy()
    expect(screen.getByText('2º LUGAR')).toBeTruthy()
    expect(screen.getByText('1200 pts · Palmeiras')).toBeTruthy()
    expect(screen.getByText('3º LUGAR')).toBeTruthy()
    expect(screen.getByText('CLASSIFICAÇÃO FINAL')).toBeTruthy()
    expect(screen.getByText('Bia')).toBeTruthy()
  })

  it('switches season with the chips', async () => {
    fakeApi(routes())
    await renderWithProviders(<ChampionsScreen />)
    await screen.findByText('CAMPEÃO 2025')
    await fireEvent.press(screen.getByRole('button', { name: 'Brasileirão 2024' }))
    expect(await screen.findByText('CAMPEÃO 2024')).toBeTruthy()
  })

  it('lists the seasons and the biggest winners, and opens a season', async () => {
    fakeApi(routes())
    await renderWithProviders(<ChampionsScreen />)
    await screen.findByText('CAMPEÃO 2025')
    await fireEvent.press(screen.getByRole('button', { name: 'Temporadas' }))
    expect(screen.getByText('MAIORES VENCEDORES')).toBeTruthy()
    expect(screen.getAllByText('1 título')).toHaveLength(2)
    expect(screen.getByText('1240 pontos · 4 jogadores')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Temporada Brasileirão 2024' }))
    expect(await screen.findByText('CAMPEÃO 2024')).toBeTruthy()
  })

  it('says so when no bolão has finished', async () => {
    fakeApi(routes([MINE[2]]))
    await renderWithProviders(<ChampionsScreen />)
    expect(await screen.findByText('Nenhum bolão encerrado ainda.')).toBeTruthy()
  })
})
