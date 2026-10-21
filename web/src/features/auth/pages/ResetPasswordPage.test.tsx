import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ResetPasswordPage } from './ResetPasswordPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(route: string) {
  renderWithProviders(
    <Routes>
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/login" element={<p>tela de login</p>} />
    </Routes>,
    { route }
  )
}

function fill(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: confirm } })
}

describe('ResetPasswordPage', () => {
  it('sets the new password with the token from the link', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/redefinir-senha?token=abc')
    fill('segredo123')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await waitFor(() => expect(screen.getByText('Senha alterada. Entre com a nova senha.')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/reset-password'),
      expect.objectContaining({ body: JSON.stringify({ token: 'abc', new_password: 'segredo123' }) })
    )
    fireEvent.click(screen.getByRole('link', { name: 'Entrar' }))
    expect(screen.getByText('tela de login')).toBeTruthy()
  })

  it('shows the API error for an expired link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: 'link inválido ou expirado' }) }))
    )
    renderAt('/redefinir-senha?token=old')
    fill('segredo123')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    await waitFor(() => expect(screen.getByText('link inválido ou expirado')).toBeTruthy())
  })

  it('needs 8 characters and matching passwords', () => {
    renderAt('/redefinir-senha?token=abc')
    const button = () => screen.getByRole('button', { name: 'Salvar nova senha' }) as HTMLButtonElement
    fill('1234567')
    expect(button().disabled).toBe(true)
    fill('segredo123', 'segredo124')
    expect(button().disabled).toBe(true)
    expect(screen.getByText('As senhas não conferem')).toBeTruthy()
  })

  it('explains a link without a token', () => {
    renderAt('/redefinir-senha')
    expect(screen.getByText(/Este link não é válido/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeTruthy()
  })
})
