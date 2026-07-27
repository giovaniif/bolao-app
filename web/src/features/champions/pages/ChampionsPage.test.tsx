import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../../shared/hooks/AuthProvider'
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
    const body = url.includes('/boloes')
      ? boloes
      : RANKINGS[new URL(url, 'http://x').searchParams.get('bolao_id') ?? ''] ?? []
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <ChampionsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  calls.length = 0
  localStorage.setItem('token', 't')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ChampionsPage', () => {
  it('shows the most recent finished bolão with its podium and full ranking', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    expect(await screen.findAllByText('Maria Silva')).toHaveLength(2)
    expect(screen.getByText('Campeão')).toBeTruthy()
    expect(screen.getByText('Classificação completa')).toBeTruthy()
    expect(screen.getByText('Carlos Dias')).toBeTruthy()
    expect(screen.getByText('4º')).toBeTruthy()
  })

  it('excludes the active bolão from the dropdown', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findAllByText('Maria Silva')
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Brasileirão 2025', 'Brasileirão 2024'])
  })

  it('switches bolão from the dropdown', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findAllByText('Maria Silva')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b-2024' } })

    expect(await screen.findAllByText('Pedro Costa')).toHaveLength(2)
    expect(screen.queryAllByText('Maria Silva')).toHaveLength(0)
  })

  it('never requests a classification without a bolao_id', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_2025, BOLAO_2024, BOLAO_ATIVO]))
    renderPage()

    await screen.findAllByText('Maria Silva')
    const classificationCalls = calls.filter((u) => u.includes('/classification'))
    expect(classificationCalls.length).toBeGreaterThan(0)
    for (const url of classificationCalls) {
      expect(url).toContain('bolao_id=')
    }
  })

  it('shows an empty state when no bolão has finished', async () => {
    vi.stubGlobal('fetch', mockFetch([BOLAO_ATIVO]))
    renderPage()

    expect(await screen.findByText('Nenhum bolão encerrado ainda.')).toBeTruthy()
    await waitFor(() => {
      expect(calls.filter((u) => u.includes('/classification'))).toHaveLength(0)
    })
  })

  it('hides the podium when the bolão has no recorded results', async () => {
    const empty = { ...BOLAO_2025, id: 'b-vazio' }
    vi.stubGlobal('fetch', mockFetch([empty]))
    renderPage()

    expect(await screen.findByText('Sem resultados registrados neste bolão.')).toBeTruthy()
    expect(screen.queryByText('Campeão')).toBeNull()
  })
})
