import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ClassificationPage } from './ClassificationPage'

interface PublicBolao {
  id: string
  name: string
  requires_approval: boolean
  max_members: number
  member_count: number
}

function publicBolao(overrides: Partial<PublicBolao> = {}): PublicBolao {
  return { id: 'b-amigos', name: 'Brasileirão dos Amigos', requires_approval: false, max_members: 50, member_count: 38, ...overrides }
}

const calls: string[] = []

function stub(mine: unknown[], open: PublicBolao[], joinStatus = 'active') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      let body: unknown = []
      if (url.endsWith('/me/boloes')) body = mine
      if (url.includes('/boloes/public')) body = open
      if (url.endsWith('/join')) body = { bolao_id: 'b-amigos', status: joinStatus }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
}

function Landing() {
  const { pathname, search } = useLocation()
  return <p>{`em ${pathname}${search}`}</p>
}

function renderHome() {
  renderWithProviders(
    <Routes>
      <Route path="/" element={<ClassificationPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}

beforeEach(() => {
  localStorage.setItem('token', 't')
  calls.length = 0
})
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ClassificationPage without a bolão', () => {
  it('shows the open bolões instead of an empty standings', async () => {
    stub([], [
      publicBolao(),
      publicBolao({ id: 'b-firma', name: 'Firma 2026', requires_approval: true, member_count: 21 }),
      publicBolao({ id: 'b-x', name: 'Firma X', member_count: 50 }),
    ])
    renderHome()

    expect(await screen.findByText('Escolha um bolão para jogar')).toBeTruthy()
    expect(screen.getByText('Entre num bolão aberto, use o código de um amigo ou crie o seu.')).toBeTruthy()
    expect(await screen.findByText('38 de 50 participantes')).toBeTruthy()
    expect(screen.getByText('21 de 50 participantes · aprovação do dono')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar no Brasileirão dos Amigos' }).textContent).toBe('Entrar')
    expect(screen.getByRole('button', { name: 'Pedir para entrar no Firma 2026' }).textContent).toBe('Pedir')
    expect(screen.getByText('Lotado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Firma X/ })).toBeNull()
    expect(screen.getByText('Bolões privados não aparecem na busca. Peça o código ou o link ao dono.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tenho um código' }).getAttribute('href')).toBe('/entrar')
    expect(screen.getByRole('link', { name: 'Criar bolão' }).getAttribute('href')).toBe('/criar-bolao')
  })

  it('searches the bolões by name', async () => {
    stub([], [publicBolao()])
    renderHome()

    fireEvent.change(await screen.findByPlaceholderText('Buscar bolões pelo nome'), { target: { value: 'firma' } })

    await waitFor(() => expect(calls.some((c) => c.endsWith('/boloes/public?q=firma'))).toBe(true))
  })

  it('joins an open bolão and enters it', async () => {
    stub([], [publicBolao()])
    renderHome()

    fireEvent.click(await screen.findByRole('button', { name: 'Entrar no Brasileirão dos Amigos' }))

    expect(await screen.findByText('em /palpites?bolao=b-amigos')).toBeTruthy()
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/boloes/b-amigos/join'))).toBe(true)
  })

  it('says the request was sent when the owner must approve', async () => {
    stub([], [publicBolao({ requires_approval: true })], 'pending')
    renderHome()

    fireEvent.click(await screen.findByRole('button', { name: 'Pedir para entrar no Brasileirão dos Amigos' }))

    expect(await screen.findByText('Pedido enviado. Você entra quando o dono aprovar.')).toBeTruthy()
  })
})
