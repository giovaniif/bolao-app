import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { SocialSignIn } from './SocialSignIn'

function Landing() {
  const { pathname } = useLocation()
  return <p>{`em ${pathname}`}</p>
}

function renderSignIn(next = '/') {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<SocialSignIn next={next} />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { route: '/login' }
  )
}

const loginBody = { token: 'jwt', user_id: '9', username: 'joao', is_admin: false, must_change_password: false }

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) }
}

function stubApple(idToken = 'apple-token') {
  const signIn = vi.fn(async () => ({ authorization: { id_token: idToken } }))
  const init = vi.fn()
  vi.stubGlobal('AppleID', { auth: { init, signIn } })
  return { init, signIn }
}

function stubGoogle(credential = 'google-token') {
  const initialize = vi.fn()
  const renderButton = vi.fn((el: HTMLElement) => {
    const button = document.createElement('button')
    button.textContent = 'Continuar com o Google'
    button.onclick = () => {
      const options = initialize.mock.calls[0][0] as { callback: (r: { credential: string }) => void }
      options.callback({ credential })
    }
    el.appendChild(button)
  })
  vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } })
  return { initialize, renderButton }
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SocialSignIn', () => {
  it('shows nothing when no provider is configured', () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', '')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    renderSignIn()
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
    expect(screen.queryByText('ou')).toBeNull()
  })

  it('signs in with Apple and goes to the next page', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', 'web.example')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const apple = stubApple()
    const fetchMock = vi.fn(async () => respond(200, loginBody))
    vi.stubGlobal('fetch', fetchMock)
    renderSignIn('/convite/FIRMA234')

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com a Apple' }))

    await waitFor(() => expect(screen.getByText('em /convite/FIRMA234')).toBeTruthy())
    expect(apple.init).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'web.example', usePopup: true }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/social$/),
      expect.objectContaining({ body: JSON.stringify({ provider: 'apple', id_token: 'apple-token' }) })
    )
    expect(localStorage.getItem('token')).toBe('jwt')
  })

  it('asks for a username on the first social login and creates the account', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', '')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-web-id')
    const google = stubGoogle()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { needs_username: true, error: 'escolha um nome de usuário' }))
      .mockResolvedValueOnce(respond(201, loginBody))
    vi.stubGlobal('fetch', fetchMock)
    renderSignIn()

    fireEvent.click(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    fireEvent.change(await screen.findByLabelText('Nome de usuário'), { target: { value: 'joao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(screen.getByText('em /')).toBeTruthy())
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'google-web-id' }))
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/auth\/social$/),
      expect.objectContaining({ body: JSON.stringify({ provider: 'google', id_token: 'google-token', username: 'joao' }) })
    )
  })

  it('keeps the username form open and shows the error when the name is taken', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', 'web.example')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    stubApple()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respond(409, { needs_username: true, error: 'escolha um nome de usuário' }))
        .mockResolvedValueOnce(respond(409, { error: 'este nome de usuário já está em uso' }))
    )
    renderSignIn()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com a Apple' }))
    fireEvent.change(await screen.findByLabelText('Nome de usuário'), { target: { value: 'joao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText('este nome de usuário já está em uso')).toBeTruthy()
    expect(screen.getByLabelText('Nome de usuário')).toBeTruthy()
  })

  it('shows the error when the provider login fails', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', 'web.example')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    stubApple()
    vi.stubGlobal('fetch', vi.fn(async () => respond(401, { error: 'login inválido, tente novamente' })))
    renderSignIn()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com a Apple' }))

    expect(await screen.findByText('login inválido, tente novamente')).toBeTruthy()
  })
})
