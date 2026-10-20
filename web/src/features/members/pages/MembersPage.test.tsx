import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { MembersPage } from './MembersPage'

const MINE = [{ id: 'b-1', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 3 }]
const MEMBERS = [
  { id: 'u-ana', username: 'ana', display_name: 'Ana', role: 'owner', status: 'active', amount_paid: 50 },
  { id: 'u-bia', username: 'bia', display_name: 'Bia', role: 'participant', status: 'active', amount_paid: 0 },
  { id: 'u-caio', username: 'caio', display_name: 'Caio', role: 'participant', status: 'pending', amount_paid: 0 },
]
let requests: { url: string; method: string; body?: string }[] = []

beforeEach(() => {
  requests = []
  localStorage.setItem('token', 't')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      requests.push({ url, method, body: init?.body as string | undefined })
      const body = (() => {
        if (url.endsWith('/me/boloes')) return MINE
        if (url.endsWith('/members')) return MEMBERS
        if (url.endsWith('/invite') && method === 'GET') return { code: 'FIRMA234' }
        if (url.endsWith('/invite/links')) return { token: 'tok_abcdefghijklmnopqrstuv', expires_at: '2026-10-27T00:00:00Z' }
        return { status: 'active' }
      })()
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('MembersPage', () => {
  it('shows the code and makes an invite link', async () => {
    renderWithProviders(<MembersPage />, { route: '/membros?bolao=b-1' })
    await waitFor(() => expect(screen.getByText('FIRMA234')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Criar link de convite' }))
    await waitFor(() => expect(screen.getByDisplayValue(/\/convite\/tok_abcdefghijklmnopqrstuv$/)).toBeTruthy())
  })

  it('approves a request', async () => {
    renderWithProviders(<MembersPage />, { route: '/membros?bolao=b-1' })
    const requestsSection = await screen.findByRole('region', { name: 'Pedidos para entrar' })
    fireEvent.click(within(requestsSection).getByRole('button', { name: 'Aprovar Caio' }))
    await waitFor(() => expect(requests.some((r) => r.method === 'POST' && r.url.endsWith('/boloes/b-1/members/u-caio/approve'))).toBe(true))
  })

  it('makes a participant an admin', async () => {
    renderWithProviders(<MembersPage />, { route: '/membros?bolao=b-1' })
    const select = await screen.findByLabelText('Papel de Bia')
    fireEvent.change(select, { target: { value: 'admin' } })
    await waitFor(() => {
      const put = requests.find((r) => r.method === 'PUT' && r.url.endsWith('/members/u-bia/role'))
      expect(put && JSON.parse(put.body!)).toEqual({ role: 'admin' })
    })
  })
})
