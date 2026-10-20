import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { MyBoloesPage } from './MyBoloesPage'

function stub(mine: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('/me/boloes') ? mine : []
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
}

beforeEach(() => localStorage.setItem('token', 't'))
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('MyBoloesPage', () => {
  it('lists the bolões where I play and the requests I am waiting for', async () => {
    stub([
      { id: 'b-1', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
      { id: 'b-2', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 5 },
      { id: 'b-3', name: 'Família', status: 'active', role: 'participant', member_status: 'pending', member_count: 8 },
    ])
    renderWithProviders(<MyBoloesPage />)

    await waitFor(() => expect(screen.getAllByText('Firma').length).toBeGreaterThan(0))
    expect(screen.getByText('Dono')).toBeTruthy()
    expect(screen.getByText('20 participantes')).toBeTruthy()
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Firma/ }).getAttribute('href')).toBe('/?bolao=b-2')
    expect(screen.queryByRole('link', { name: /Família/ })).toBeNull()
  })

  it('invites a user without bolões to create or join one', async () => {
    stub([])
    renderWithProviders(<MyBoloesPage />)

    await waitFor(() => expect(screen.getByText('Você ainda não participa de nenhum bolão.')).toBeTruthy())
    expect(screen.getAllByRole('link', { name: 'Criar bolão' })[0].getAttribute('href')).toBe('/criar-bolao')
    expect(screen.getAllByRole('link', { name: 'Entrar com código' })[0].getAttribute('href')).toBe('/entrar')
  })
})
