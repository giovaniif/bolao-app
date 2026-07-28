import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './shared/hooks/AuthProvider'
import { RedirectToRound } from './App'

function Probe() {
  const { pathname, search } = useLocation()
  return <span data-testid="url">{pathname + search}</span>
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/inicio', path]}>
        <AuthProvider>
          <Routes>
            <Route path="/parciais" element={<RedirectToRound tab="parciais" />} />
            <Route path="/ver-palpites" element={<RedirectToRound tab="galera" />} />
            <Route path="/rodada" element={<Probe />} />
            <Route path="/inicio" element={<Probe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.setItem('token', 't')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '[]' })))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('legacy round routes', () => {
  it('/parciais lands on the partials tab keeping the round', async () => {
    renderAt('/parciais?rodada=5')
    await waitFor(() =>
      expect(screen.getByTestId('url').textContent).toBe('/rodada?rodada=5&aba=parciais')
    )
  })

  it('/ver-palpites lands on the players tab keeping the round', async () => {
    renderAt('/ver-palpites?rodada=5')
    await waitFor(() =>
      expect(screen.getByTestId('url').textContent).toBe('/rodada?rodada=5&aba=galera')
    )
  })

  it('works without a round in the URL', async () => {
    renderAt('/parciais')
    await waitFor(() =>
      expect(screen.getByTestId('url').textContent).toBe('/rodada?aba=parciais')
    )
  })
})
