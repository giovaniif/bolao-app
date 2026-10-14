import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { Layout } from './Layout'

function renderAt(route: string) {
  renderWithProviders(<Layout>conteúdo</Layout>, { route })
}

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

  it('marks Rodada current on the legacy routes that redirect to /rodada', () => {
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

  function openMenu() {
    fireEvent.click(header().getByRole('button', { name: 'Meu perfil' }))
    return within(screen.getByRole('menu'))
  }

  it('has only the wordmark and the profile menu button', () => {
    renderAt('/')
    const interactive = [...header().getAllByRole('link'), ...header().queryAllByRole('button')]
    expect(interactive).toHaveLength(2)
  })

  it('keeps the menu closed until the avatar is clicked', () => {
    renderAt('/')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(header().getByRole('button', { name: 'Meu perfil' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('offers Perfil and Sair to a player, without Admin', () => {
    renderAt('/')
    const menu = openMenu()
    expect(menu.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Perfil', 'Sair'])
    expect(menu.getByRole('menuitem', { name: 'Perfil' }).getAttribute('href')).toBe('/perfil')
  })

  it('offers Perfil, Admin and Sair to an admin', () => {
    setUser(true)
    renderAt('/')
    const menu = openMenu()
    expect(menu.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Perfil', 'Admin', 'Sair'])
    expect(menu.getByRole('menuitem', { name: 'Admin' }).getAttribute('href')).toBe('/admin')
  })

  it('shows the pending result count next to Admin', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 3 })
    renderAt('/')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('rounds/summary'), expect.anything()))
    const menu = openMenu()
    expect(await menu.findByText('3')).toBeTruthy()
  })

  it('signs out from the menu', () => {
    renderAt('/')
    fireEvent.click(openMenu().getByRole('menuitem', { name: 'Sair' }))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('closes the menu on Escape', () => {
    renderAt('/')
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('falls back to the username until /me responds', () => {
    renderAt('/')
    expect(header().getByText('G')).toBeTruthy()
  })
})

describe('Admin mode banner', () => {
  it('is gone, even for an admin with pending results', async () => {
    setUser(true)
    stubFetch({ rounds: [1], active: 1, pending_results: 3 })
    renderAt('/')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('rounds/summary'), expect.anything()))
    expect(screen.queryByText(/Modo admin/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir' })).toBeNull()
  })
})
