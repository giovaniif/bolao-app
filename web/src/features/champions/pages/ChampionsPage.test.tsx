import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ChampionsPage } from './ChampionsPage'

const BOLAO_2025 = {
  id: 'b-2025',
  name: 'Brasileirão 2025',
  status: 'finished',
  started_at: '2025-03-01T00:00:00Z',
  finished_at: '2025-12-01T00:00:00Z',
}
const BOLAO_2024 = {
  id: 'b-2024',
  name: 'Brasileirão 2024',
  status: 'finished',
  started_at: '2024-03-01T00:00:00Z',
  finished_at: '2024-12-01T00:00:00Z',
}
const BOLAO_ATIVO = {
  id: 'b-2026',
  name: 'Brasileirão 2026',
  status: 'active',
  started_at: '2026-03-01T00:00:00Z',
}

function player(id: string, name: string, points: number) {
  return {
    id,
    username: id,
    display_name: name,
    is_admin: false,
    amount_paid: 0,
    total_points: points,
    exact_scores: 0,
    correct_results: 0,
    rounds_won: 0,
  }
}

const RANKINGS: Record<string, ReturnType<typeof player>[]> = {
  'b-2025': [
    player('maria', 'Maria Silva', 1240),
    player('joao', 'João Souza', 1180),
    player('ana', 'Ana Lima', 1090),
    player('carlos', 'Carlos Dias', 980),
  ],
  'b-2024': [player('pedro', 'Pedro Costa', 1310), player('bia', 'Bia Rocha', 1200)],
}

const calls: string[] = []

function mockFetch(boloes: unknown[]) {
  return vi.fn(async (url: string) => {
    calls.push(url)
    const body = (() => {
      if (url.includes('/boloes')) return boloes
      // Without this branch the summary would fall through to the rankings lookup and
      // resolve to [], making select: s => s.rounds silently undefined.
      if (url.includes('/matches/rounds/summary')) {
        return { rounds: [1, 2, 3, 4, 5, 6, 7], active: 7, pending_results: 0 }
      }
      return RANKINGS[new URL(url, 'http://x').searchParams.get('bolao_id') ?? ''] ?? []
    })()
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  })
}

function renderPage() {
  return renderWithProviders(<ChampionsPage />)
}

beforeEach(() => {
  calls.length = 0
  localStorage.setItem('token', 't')
  localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'gio', is_admin: false }))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ChampionsPage', () => {
  it('shows the latest champion in the hero, with stats and rounds', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    expect(await screen.findByText('CAMPEÃO 2025')).toBeTruthy()
    // The champion appears in the hero only; the final table starts at 4th.
    expect(await screen.findAllByText('Maria Silva')).toHaveLength(1)
    expect(screen.getByText('1240')).toBeTruthy()
    expect(await screen.findByText('7 rodadas')).toBeTruthy()
  })

  it('shows 2nd and 3rd as a pair, with no emoji medals', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025]))
    renderPage()

    expect(await screen.findByText('2º LUGAR')).toBeTruthy()
    expect(screen.getByText('3º LUGAR')).toBeTruthy()
    expect(screen.getByText('João Souza')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/[\u{1F451}\u{1F948}\u{1F949}\u{1F3C6}]/u)
  })

  it('lists the final standings from 4th', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025]))
    renderPage()

    expect(await screen.findByText('CLASSIFICAÇÃO FINAL')).toBeTruthy()
    expect(screen.getByText('Carlos Dias')).toBeTruthy()
    expect(screen.getByText('4º')).toBeTruthy()
    // 1st to 3rd are already in the hero and the pair; repeating them is noise.
    expect(screen.queryByText('1º')).toBeNull()
    expect(screen.queryByText('2º')).toBeNull()
  })

  it('excludes the active bolão from the season chips', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findByText('CAMPEÃO 2025')
    const chips = screen.getByRole('tablist', { name: 'Temporada' })
    expect(within(chips).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Brasileirão 2025',
      'Brasileirão 2024',
    ])
  })

  it('switches season from the chips', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findByText('CAMPEÃO 2025')
    fireEvent.click(screen.getByRole('tab', { name: 'Brasileirão 2024' }))

    expect(await screen.findByText('CAMPEÃO 2024')).toBeTruthy()
    expect(await screen.findAllByText('Pedro Costa')).toHaveLength(1)
    expect(screen.queryByText('Maria Silva')).toBeNull()
  })

  it('shows the winning margin', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025]))
    renderPage()
    // 1240 - 1180
    expect(await screen.findByText(/venceu por 60 pontos/)).toBeTruthy()
  })

  it('never requests a classification without a bolao_id', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findByText('CAMPEÃO 2025')
    const classificationCalls = calls.filter((u) => u.includes('/classification'))
    expect(classificationCalls.length).toBeGreaterThan(0)
    for (const url of classificationCalls) {
      expect(url).toContain('bolao_id=')
    }
  })

  it('shows the empty state when no bolão has finished', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_ATIVO]))
    renderPage()

    expect(await screen.findByText('Nenhum bolão encerrado ainda.')).toBeTruthy()
    await waitFor(() => {
      expect(calls.filter((u) => u.includes('/classification'))).toHaveLength(0)
    })
  })

  it('hides the hero when the bolão has no results', async () => {
    const empty = { ...BOLAO_2025, id: 'b-empty' }
    vi.stubGlobal('fetch', mockFetch([empty]))
    renderPage()

    expect(await screen.findByText('Sem resultados registrados neste bolão.')).toBeTruthy()
    expect(screen.queryByText(/CAMPEÃO/)).toBeNull()
  })
})
