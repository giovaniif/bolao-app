import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
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

beforeEach(() => {
  localStorage.setItem('token', 't')
  setUser()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '[]' })))
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
