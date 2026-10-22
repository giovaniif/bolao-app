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

function onboardingApi({ taken = [] as string[], createError = '' } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/auth/social')) {
      const body = JSON.parse(String(init?.body)) as { username?: string }
      if (!body.username) {
        return respond(409, { needs_username: true, error: 'escolha um nome de usuário', suggested_username: 'joao.silva' })
      }
      if (createError) return respond(409, { error: createError })
      return respond(201, { ...loginBody, username: body.username })
    }
    if (url.includes('/auth/username-available')) {
      const username = new URL(url, 'http://x').searchParams.get('username') ?? ''
      return respond(200, { valid: true, available: !taken.includes(username) })
    }
    if (url.endsWith('/teams')) return respond(200, ['Flamengo', 'Palmeiras', 'Corinthians'])
    if (url.endsWith('/me') && method === 'GET') {
      return respond(200, { id: '9', username: 'joao.silva', display_name: 'João Silva', favorite_team: null, is_admin: false })
    }
    if (url.endsWith('/me') && method === 'PUT') return respond(200, {})
    return respond(404, { error: 'not mocked' })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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

  it('asks for a username on the first social login, then the favorite team', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', '')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-web-id')
    const google = stubGoogle()
    const fetchMock = onboardingApi()
    renderSignIn()

    fireEvent.click(await screen.findByRole('button', { name: 'Continuar com o Google' }))

    expect(await screen.findByRole('heading', { name: 'Como você quer aparecer no bolão?' })).toBeTruthy()
    expect(screen.getByText('Passo 1 de 2')).toBeTruthy()
    expect(screen.getByText('É o nome que todo mundo vê na classificação. Você também entra com ele.')).toBeTruthy()
    const input = screen.getByLabelText('Nome de usuário') as HTMLInputElement
    expect(input.value).toBe('joao.silva')
    expect(await screen.findByText('Disponível')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: 'Pra qual time você torce?' })).toBeTruthy()
    expect(screen.getByText('Passo 2 de 2')).toBeTruthy()
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'google-web-id' }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/social$/),
      expect.objectContaining({ body: JSON.stringify({ provider: 'google', id_token: 'google-token', username: 'joao.silva' }) })
    )
    expect(localStorage.getItem('token')).toBe('jwt')

    fireEvent.change(screen.getByPlaceholderText('Buscar time'), { target: { value: 'pal' } })
    expect(screen.queryByRole('button', { name: 'Flamengo' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Palmeiras' }))
    expect(screen.getByRole('button', { name: 'Palmeiras' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

    await waitFor(() => expect(screen.getByText('em /')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/me$/),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ username: 'joao.silva', display_name: 'João Silva', favorite_team: 'Palmeiras' }),
      })
    )
  })

  it('lets the user skip the favorite team', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', '')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-web-id')
    stubGoogle()
    const fetchMock = onboardingApi()
    renderSignIn('/palpites')

    fireEvent.click(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await screen.findByText('Disponível')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pular por agora' }))

    await waitFor(() => expect(screen.getByText('em /palpites')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/me$/), expect.objectContaining({ method: 'PUT' }))
  })

  it('says when the username is taken and blocks Continuar', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', '')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-web-id')
    stubGoogle()
    onboardingApi({ taken: ['joao.silva'] })
    renderSignIn()

    fireEvent.click(await screen.findByRole('button', { name: 'Continuar com o Google' }))

    expect(await screen.findByText('Em uso')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'jo' } })
    expect(await screen.findByText('Use de 3 a 30 letras, números, ponto ou _')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sends the name Apple gave on both requests', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', 'web.example')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    vi.stubGlobal('AppleID', {
      auth: {
        init: vi.fn(),
        signIn: vi.fn(async () => ({
          authorization: { id_token: 'apple-token' },
          user: { name: { firstName: 'João', lastName: 'Silva' } },
        })),
      },
    })
    const fetchMock = onboardingApi()
    renderSignIn()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com a Apple' }))
    await screen.findByText('Disponível')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { name: 'Pra qual time você torce?' })

    const bodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith('/auth/social'))
      .map(([, init]) => (init as RequestInit).body)
    expect(bodies).toEqual([
      JSON.stringify({ provider: 'apple', id_token: 'apple-token', name: 'João Silva' }),
      JSON.stringify({ provider: 'apple', id_token: 'apple-token', username: 'joao.silva', name: 'João Silva' }),
    ])
  })

  it('keeps the username step open and shows the error when the name is taken at the end', async () => {
    vi.stubEnv('VITE_APPLE_SERVICE_ID', 'web.example')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    stubApple()
    onboardingApi({ createError: 'este nome de usuário já está em uso' })
    renderSignIn()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com a Apple' }))
    await screen.findByText('Disponível')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

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
