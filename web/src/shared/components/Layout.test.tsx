import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { Layout } from './Layout'

function renderAt(route: string) {
  renderWithProviders(<Layout>conteúdo</Layout>, { route })
}

/**
 * The header wordmark is also a "Bolão" link; scoping to the bar removes the ambiguity and
 * keeps these assertions about navigation rather than the header.
 */
function tabs() {
  return within(screen.getByRole('navigation'))
}

function tab(name: string) {
  return tabs().getByRole('link', { name })
}

function setUser(isAdmin = false) {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'gio', is_admin: isAdmin }))
}

function stubFetch(summary: unknown = { rounds: [1], active: 1, pending_results: 0 }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify(url.includes('/matches/rounds/summary') ? summary : []),
    }))
  )
}

beforeEach(() => {
  localStorage.setItem('token', 't')
  setUser()
  stubFetch()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('BottomNav', () => {
  it('has exactly three targets', () => {
    renderAt('/')
    const targets = tabs().getAllByRole('link')
    expect(targets.map((a) => a.textContent)).toEqual(['Bolão', 'Palpitar', 'Rodada'])
  })

  it('marks Bolão current on the home screen', () => {
    renderAt('/')
    expect(tab('Bolão').getAttribute('aria-current')).toBe('page')
    expect(tab('Rodada').getAttribute('aria-current')).toBeNull()
  })

  it('marks Bolão current on the champions screen', () => {
    renderAt('/hall-dos-campeoes')
    expect(tab('Bolão').getAttribute('aria-current')).toBe('page')
  })

  it('marks Rodada current on the round screen', () => {
    renderAt('/rodada')
    expect(tab('Rodada').getAttribute('aria-current')).toBe('page')
    expect(tab('Bolão').getAttribute('aria-current')).toBeNull()
  })

  // /ver-palpites and /parciais redirect to /rodada; a direct link must not leave the bar
  // with nothing active on the way.
  it('marks Rodada current on the legacy routes', () => {
    renderAt('/ver-palpites')
    expect(tab('Rodada').getAttribute('aria-current')).toBe('page')
  })

  it('never marks Palpitar as the current tab', () => {
    renderAt('/palpites')
    expect(tab('Palpitar').getAttribute('aria-current')).toBeNull()
  })

  it('carries ?rodada=N to all three targets', () => {
    renderAt('/?rodada=7')
    for (const name of ['Bolão', 'Palpitar', 'Rodada']) {
      expect(tab(name).getAttribute('href')).toContain('rodada=7')
    }
  })

  it('adds no query string when the URL has no round', () => {
    renderAt('/')
    for (const name of ['Bolão', 'Palpitar', 'Rodada']) {
      expect(tab(name).getAttribute('href')).not.toContain('?')
    }
  })

  it('no longer renders an Admin tab', () => {
    setUser(true)
    renderAt('/')
    expect(tabs().queryByRole('link', { name: 'Admin' })).toBeNull()
  })
})

describe('AppHeader', () => {
  function header() {
    return within(screen.getByRole('banner'))
  }

  it('has only the wordmark and the profile avatar', () => {
    renderAt('/')
    const interactive = [...header().getAllByRole('link'), ...header().queryAllByRole('button')]
    expect(interactive).toHaveLength(2)
  })

  it('links to the profile from the avatar', () => {
    renderAt('/')
    expect(header().getByRole('link', { name: 'Meu perfil' }).getAttribute('href')).toBe('/perfil')
  })

  it('no longer has the Sair button or the trophy link', () => {
    renderAt('/')
    expect(header().queryByRole('button', { name: 'Sair' })).toBeNull()
    expect(header().queryByRole('link', { name: 'Hall dos Campeões' })).toBeNull()
  })

  it('falls back to the username until /me responds', () => {
    renderAt('/')
    expect(header().getByText('G')).toBeTruthy()
  })
})

describe('AdminBanner', () => {
  /**
   * "Modo admin" is also the loading label, so asserting on it without waiting would pass
   * even if the settled state were wrong. Wait for the summary to land first.
   */
  async function summaryLoaded() {
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('rounds/summary'),
        expect.anything()
      )
    )
    await waitFor(() => expect(screen.getByText(/Modo admin/)).toBeTruthy())
  }

  it('renders nothing for a non-admin', async () => {
    stubFetch({ rounds: [1], active: 1, pending_results: 3 })
    renderAt('/')
    await waitFor(() => expect(screen.queryByText(/Modo admin/)).toBeNull())
    expect(screen.queryByRole('link', { name: 'Abrir' })).toBeNull()
  })

  it('shows the pending result count for an admin', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 3 })
    renderAt('/')

    expect(await screen.findByText('Modo admin · 3 resultados por lançar')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe('/admin')
  })

  it('uses the singular for a single result', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 1 })
    renderAt('/')
    expect(await screen.findByText('Modo admin · 1 resultado por lançar')).toBeTruthy()
  })

  // "0 resultados por lançar" is noise; the banner is still useful as a shortcut.
  it('omits the count when nothing is pending', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 0 })
    renderAt('/')
    await summaryLoaded()
    expect(screen.getByText('Modo admin')).toBeTruthy()
  })

  // The API may not have shipped the field yet; the banner degrades instead of showing
  // "undefined".
  it('omits the count when the API sends no pending_results', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1 })
    renderAt('/')
    await summaryLoaded()
    expect(screen.getByText('Modo admin')).toBeTruthy()
  })

  it('does not appear inside /admin', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 3 })
    renderAt('/admin')
    await waitFor(() => expect(screen.queryByText(/Modo admin/)).toBeNull())
  })
})
