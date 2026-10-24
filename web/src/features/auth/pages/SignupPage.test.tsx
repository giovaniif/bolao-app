import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { SignupPage } from './SignupPage'

function Landing() {
  const { pathname } = useLocation()
  return <p>{`em ${pathname}`}</p>
}

function renderAt(route: string) {
  renderWithProviders(
    <Routes>
      <Route path="/cadastro" element={<SignupPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { route }
  )
}

function fill(password = 'segredo123') {
  fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'João Silva' } })
  fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'joao' } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'joao@example.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('SignupPage', () => {
  it('creates the account, logs in and goes back to the invite', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ token: 'jwt', user_id: '9', username: 'joao', is_admin: false, must_change_password: false }),
      }))
    )
    renderAt('/cadastro?voltar=%2Fconvite%2FFIRMA234')
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(screen.getByText('em /convite/FIRMA234')).toBeTruthy())
    expect(localStorage.getItem('token')).toBe('jwt')
  })

  it('asks for a password of at least 8 characters', () => {
    renderAt('/cadastro')
    fill('1234567')
    expect((screen.getByRole('button', { name: 'Criar conta' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the password and username rules visible after the user types', () => {
    renderAt('/cadastro')
    fill('1234567')
    expect(screen.getByLabelText('Senha').getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Pelo menos 8 caracteres')).toBeTruthy()
    expect(screen.getByText('Pelo menos 3 caracteres')).toBeTruthy()
  })

  it('shows the API error, like a taken username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ error: 'este nome de usuário já está em uso' }) }))
    )
    renderAt('/cadastro')
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(screen.getByText('este nome de usuário já está em uso')).toBeTruthy())
  })
})
