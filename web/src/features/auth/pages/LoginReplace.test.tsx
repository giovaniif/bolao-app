import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

function succeed() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'jwt', user_id: 'u1', username: 'ana', is_admin: false, must_change_password: false }),
    }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  navigate.mockReset()
})

describe('leaving the sign-in pages', () => {
  it('replaces the login page so the back button cannot return to it', async () => {
    succeed()
    renderWithProviders(<LoginPage />, { route: '/login' })
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true })
  })

  it('replaces the sign-up page so the back button cannot return to it', async () => {
    succeed()
    renderWithProviders(<SignupPage />, { route: '/cadastro' })
    const fields = screen.getAllByRole('textbox')
    fireEvent.change(fields[0], { target: { value: 'Ana' } })
    fireEvent.change(fields[1], { target: { value: 'ana' } })
    fireEvent.change(fields[2], { target: { value: 'ana@example.com' } })
    const password = document.querySelector('input[type="password"]') as HTMLInputElement
    fireEvent.change(password, { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true })
  })
})
