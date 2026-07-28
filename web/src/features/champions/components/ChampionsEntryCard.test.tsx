import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ClassificationPage } from '../../classification/pages/ClassificationPage'

const FINISHED = {
  id: 'b-2025',
  name: 'Brasileirão 2025',
  status: 'finished',
  started_at: '2025-03-01T00:00:00Z',
  finished_at: '2025-12-01T00:00:00Z',
}
const ACTIVE = {
  id: 'b-2026',
  name: 'Brasileirão 2026',
  status: 'active',
  started_at: '2026-03-01T00:00:00Z',
}

const RANKING = [
  {
    id: 'maria',
    username: 'maria',
    display_name: 'Maria Silva',
    is_admin: false,
    amount_paid: 0,
    total_points: 1240,
    exact_scores: 21,
    correct_results: 40,
    rounds_won: 7,
  },
]

function mockFetch(boloes: unknown[]) {
  return vi.fn(async (url: string) => {
    const body = url.includes('/boloes')
      ? boloes
      : url.includes('/matches/rounds/summary')
        ? { rounds: [1], active: 1, pending_results: 0 }
        : url.includes('/classification')
          ? RANKING
          : []
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  })
}

beforeEach(() => {
  localStorage.setItem('token', 't')
  localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'gio', is_admin: false }))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ChampionsEntryCard', () => {
  it('shows the latest champion and links to the Hall', async () => {
    vi.stubGlobal('fetch', mockFetch([FINISHED, ACTIVE]))
    renderWithProviders(<ClassificationPage />)

    const card = await screen.findByRole('link', { name: /Hall dos Campeões/ })
    expect(card.getAttribute('href')).toBe('/hall-dos-campeoes')
    expect(await screen.findByText('Último: Maria Silva · 2025')).toBeTruthy()
  })

  it('does not render when no bolão has finished', async () => {
    vi.stubGlobal('fetch', mockFetch([ACTIVE]))
    renderWithProviders(<ClassificationPage />)

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Hall dos Campeões/ })).toBeNull()
    )
  })

  // The subtitle line exists from the first render so the card keeps its height.
  it('shows neutral subtitle copy until the ranking lands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/classification')) return new Promise(() => {}) // never resolves
        const body = url.includes('/boloes')
          ? [FINISHED]
          : url.includes('/matches/rounds/summary')
            ? { rounds: [1], active: 1, pending_results: 0 }
            : []
        return { ok: true, status: 200, text: async () => JSON.stringify(body) }
      })
    )
    renderWithProviders(<ClassificationPage />)

    expect(await screen.findByText('Temporadas encerradas')).toBeTruthy()
  })
})
