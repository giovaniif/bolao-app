import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { LoginPage } from './LoginPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(route: string) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
    </Routes>,
    { route }
  )
}

describe('ForgotPasswordPage', () => {
  it('is linked from the login page', () => {
    renderAt('/login')
    fireEvent.click(screen.getByRole('link', { name: 'Esqueci minha senha' }))
    expect(screen.getByRole('heading', { name: 'Esqueci minha senha' })).toBeTruthy()
  })

  it('sends the login and says to check the email', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/esqueci-senha')
    fireEvent.change(screen.getByLabelText('Usuário ou e-mail'), { target: { value: 'maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    await waitFor(() => expect(screen.getByText(/Se existir uma conta com e-mail/)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/forgot-password'),
      expect.objectContaining({ body: JSON.stringify({ login: 'maria' }) })
    )
  })

  it('waits for a login before sending', () => {
    renderAt('/esqueci-senha')
    expect((screen.getByRole('button', { name: 'Enviar link' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
