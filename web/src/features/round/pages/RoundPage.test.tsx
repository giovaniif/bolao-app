import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { RoundPage } from './RoundPage'

const BOLAO = {
  id: 'b-1',
  name: 'Brasileirão 2026',
  status: 'active',
  started_at: '2026-03-01T00:00:00Z',
}

const PARTICIPANTS = Array.from({ length: 14 }, (_, i) => ({
  id: `u-${i}`,
  username: `u${i}`,
  display_name: `Jogador ${i}`,
  is_admin: false,
  amount_paid: 0,
  joined_at: '2026-03-01T00:00:00Z',
}))

// The market has already closed, so the players tab shows its player picker.
const MATCHES = [
  {
    id: 'm-1',
    round: 7,
    home_team: 'Palmeiras',
    away_team: 'Flamengo',
    market_closes_at: '2020-01-01T00:00:00Z',
  },
]

let calls: string[] = []

function mockFetch() {
  return vi.fn(async (url: string) => {
    calls.push(url)
    const body = (() => {
      if (url.includes('/matches/rounds/summary')) return { rounds: [6, 7, 8], active: 7 }
      if (url.includes('/boloes/active')) return BOLAO
      if (url.includes('/participants')) return PARTICIPANTS
      if (url.includes('/parciais/') && url.includes('/classification')) return []
      if (url.includes('/parciais/round/')) {
        return MATCHES.map((m) => ({ ...m, partial_home: null, partial_away: null }))
      }
      if (url.includes('/matches/round/')) return MATCHES
      if (url.includes('/users')) return PARTICIPANTS
      return []
    })()
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  })
}

beforeEach(() => {
  calls = []
  localStorage.setItem('token', 't')
  vi.stubGlobal('fetch', mockFetch())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

function tab(name: string) {
  return screen.getByRole('tab', { name })
}

// "Rodada 7" is both the title and a chip label; the heading role disambiguates.
function heading(name: string) {
  return screen.findByRole('heading', { name })
}

describe('RoundPage', () => {
  it('shows the active round and the participant count', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada' })

    expect(await heading('Rodada 7')).toBeTruthy()
    expect(await screen.findByText('14 jogadores')).toBeTruthy()
  })

  it('opens on the partials tab without writing the tab into the URL', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada' })

    await waitFor(() => expect(tab('Parciais').getAttribute('aria-selected')).toBe('true'))
    expect(tab('Galera').getAttribute('aria-selected')).toBe('false')
    expect(await screen.findByText('Editar parciais')).toBeTruthy()
  })

  it('opens straight on the players tab with ?aba=galera', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada?aba=galera' })

    await waitFor(() => expect(tab('Galera').getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByText(/Veja os palpites de qualquer jogador/)).toBeTruthy()
  })

  it('switches tabs without refetching the round', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada' })
    await heading('Rodada 7')
    await waitFor(() => expect(calls.some((u) => u.includes('/parciais/round/'))).toBe(true))

    const before = calls.length
    fireEvent.click(tab('Galera'))
    await waitFor(() => expect(tab('Galera').getAttribute('aria-selected')).toBe('true'))

    // The players tab mounts and fetches its own matches, but nothing round-level repeats.
    const afterSwitch = calls.slice(before)
    expect(afterSwitch.filter((u) => u.includes('/matches/rounds/summary'))).toHaveLength(0)
    expect(afterSwitch.filter((u) => u.includes('/parciais/round/'))).toHaveLength(0)

    const beforeBack = calls.length
    fireEvent.click(tab('Parciais'))
    await waitFor(() => expect(tab('Parciais').getAttribute('aria-selected')).toBe('true'))
    expect(calls.slice(beforeBack)).toHaveLength(0)
  })

  it('keeps the hidden panel state when switching tabs', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada?aba=galera' })

    const picker = await screen.findByRole('combobox')
    fireEvent.change(picker, { target: { value: 'u-3' } })
    expect(await screen.findByText('Palpites de Jogador 3')).toBeTruthy()

    fireEvent.click(tab('Parciais'))
    await waitFor(() => expect(tab('Parciais').getAttribute('aria-selected')).toBe('true'))
    fireEvent.click(tab('Galera'))

    // The panel was hidden, never unmounted, so the chosen player is still selected.
    expect(await screen.findByText('Palpites de Jogador 3')).toBeTruthy()
  })

  it('changes round from the chips while staying on the same tab', async () => {
    renderWithProviders(<RoundPage />, { route: '/rodada?aba=galera' })
    await heading('Rodada 7')

    const chips = screen.getByRole('tablist', { name: 'Rodada' })
    fireEvent.click(within(chips).getByRole('tab', { name: 'Rodada 6' }))

    expect(await heading('Rodada 6')).toBeTruthy()
    expect(tab('Galera').getAttribute('aria-selected')).toBe('true')
  })
})
