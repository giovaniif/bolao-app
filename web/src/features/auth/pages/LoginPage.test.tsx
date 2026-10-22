import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { LoginPage } from './LoginPage'

function failWith(status: number, error: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status, text: async () => JSON.stringify({ error }) }))
  )
}

function submit() {
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'ana' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage', () => {
  it('hides the forgot-password link before any attempt', () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).toBeNull()
  })

  it('shows the forgot-password link after a wrong password', async () => {
    failWith(401, 'Usuário ou senha inválidos')
    renderWithProviders(<LoginPage />, { route: '/login' })

    submit()

    expect(await screen.findByText('Usuário ou senha inválidos')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' }).getAttribute('href')).toBe('/esqueci-senha')
  })

  it('keeps the link hidden when the login fails for another reason', async () => {
    failWith(500, 'Erro interno')
    renderWithProviders(<LoginPage />, { route: '/login' })

    submit()

    expect(await screen.findByText('Erro interno')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).toBeNull()
  })
})
