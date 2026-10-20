import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { InvitePage } from './InvitePage'
import { JoinByCodePage } from './JoinByCodePage'

let joinStatus = 'pending'
let posts: string[] = []

function stub(preview: unknown) {
  posts = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(url)
      const body = (() => {
        if (url.endsWith('/join')) return { bolao_id: 'b-amigos', status: joinStatus }
        if (url.includes('/invites/')) return preview
        return []
      })()
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
}

function Landing() {
  const { pathname, search } = useLocation()
  return <p>{`em ${pathname}${search}`}</p>
}

function renderInvite(code = 'AMIGOS22') {
  renderWithProviders(
    <Routes>
      <Route path="/convite/:code" element={<InvitePage />} />
      <Route path="/entrar" element={<JoinByCodePage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { route: `/convite/${code}` }
  )
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const PREVIEW = { name: 'Amigos do Futebol', member_count: 12, max_members: 50, joins: 'request' }

describe('InvitePage', () => {
  it('shows the bolão and sends a visitor to log in and come back', async () => {
    stub(PREVIEW)
    renderInvite()
    await waitFor(() => expect(screen.getByText('Amigos do Futebol')).toBeTruthy())
    expect(screen.getByText('12 de 50 participantes')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar para participar' }).getAttribute('href')).toBe('/login?voltar=%2Fconvite%2FAMIGOS22')
  })

  it('sends a request when the owner approves members', async () => {
    localStorage.setItem('token', 't')
    joinStatus = 'pending'
    stub(PREVIEW)
    renderInvite()
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir para entrar' }))
    await waitFor(() => expect(screen.getByText('Pedido enviado. Você entra quando o dono aprovar.')).toBeTruthy())
    expect(posts).toEqual([expect.stringMatching(/\/invites\/AMIGOS22\/join$/)])
  })

  it('opens the bolão when the invite joins at once', async () => {
    localStorage.setItem('token', 't')
    joinStatus = 'active'
    stub({ ...PREVIEW, joins: 'direct' })
    renderInvite()
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar no bolão' }))
    await waitFor(() => expect(screen.getByText('em /?bolao=b-amigos')).toBeTruthy())
  })
})

describe('JoinByCodePage', () => {
  it('opens the invite of a typed code', async () => {
    localStorage.setItem('token', 't')
    stub(PREVIEW)
    renderWithProviders(
      <Routes>
        <Route path="/entrar" element={<JoinByCodePage />} />
        <Route path="*" element={<Landing />} />
      </Routes>,
      { route: '/entrar' }
    )
    fireEvent.change(screen.getByLabelText('Código do bolão'), { target: { value: ' amigos22 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('em /convite/AMIGOS22')).toBeTruthy()
  })
})
