import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { AdminBoloes } from './AdminBoloes'

const mine = [
  { id: 'b-1', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
  { id: 'b-2', name: 'Bolão da Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 5 },
]
const all = [
  { id: 'b-1', name: 'Brasileirão 2026', status: 'active', started_at: '2026-04-01T00:00:00Z' },
  { id: 'b-2', name: 'Bolão da Firma', status: 'active', owner_id: 'u-1', started_at: '2026-05-01T00:00:00Z' },
]

const calls: { url: string; method: string }[] = []

beforeEach(() => {
  calls.length = 0
  localStorage.setItem('token', 't')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET' })
      let body: unknown = []
      if (url.endsWith('/me/boloes')) body = mine
      else if (url.endsWith('/boloes')) body = all
      else if (url.endsWith('/finish')) body = { ...all[1], status: 'finished' }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
})
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AdminBoloes', () => {
  it('finishes the current bolão, not the default active one', async () => {
    renderWithProviders(<AdminBoloes />, { route: '/admin?bolao=b-2' })

    await waitFor(() => expect(screen.getByText('Bolão da Firma')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar bolão atual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalização' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
      expect.stringMatching(/\/boloes\/b-2\/finish$/),
    ])
    expect(calls.some((c) => c.url.includes('/boloes/active'))).toBe(false)
  })

  it('does not offer a new bolão while the platform bolão is active', async () => {
    renderWithProviders(<AdminBoloes />, { route: '/admin?bolao=b-2' })

    await waitFor(() => expect(screen.getByText('Bolão da Firma')).toBeTruthy())
    expect(screen.queryByRole('button', { name: '+ Criar novo bolão' })).toBeNull()
  })
})
