import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { DeleteAccount } from './DeleteAccount'
import { consumeLoginNotice } from '../../../shared/api/session'

let requests: { url: string; method: string; body?: string }[] = []

const BLOCKER = {
  bolao_id: 'b-1',
  bolao_name: 'Firma',
  suggested_owner_id: 'u-ana',
  members: [
    { user_id: 'u-ana', display_name: 'Ana', role: 'admin' },
    { user_id: 'u-bia', display_name: 'Bia', role: 'participant' },
  ],
}

function stub(status: number, body: unknown, blockers: unknown[] = []) {
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      requests.push({ url, method, body: init?.body as string | undefined })
      if (method === 'GET' && /\/me\/deletion-check$/.test(url)) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ blockers }) }
      }
      return { ok: status < 400, status, text: async () => (status === 204 ? '' : JSON.stringify(body)) }
    })
  )
}

const deletes = () => requests.filter((r) => r.method === 'DELETE')

function renderIt() {
  renderWithProviders(
    <Routes>
      <Route path="/perfil" element={<DeleteAccount />} />
      <Route path="/login" element={<p>tela de login</p>} />
    </Routes>,
    { route: '/perfil' }
  )
}

beforeEach(() => localStorage.setItem('token', 't'))
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('DeleteAccount', () => {
  it('asks to confirm, deletes the account and logs out', async () => {
    stub(204, null)
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    expect(deletes()).toHaveLength(0)
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }))

    await waitFor(() => expect(screen.getByText('tela de login')).toBeTruthy())
    expect(deletes()).toEqual([{ url: expect.stringMatching(/\/me$/), method: 'DELETE', body: undefined }])
    expect(localStorage.getItem('token')).toBeNull()
    expect(consumeLoginNotice()).toBe('Sua conta foi excluída')
  })

  it('shows the API error when the deletion fails', async () => {
    stub(409, { error: 'passe seus bolões ativos para outra pessoa antes de excluir a conta' })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }))
    expect(await screen.findByText('passe seus bolões ativos para outra pessoa antes de excluir a conta')).toBeTruthy()
    expect(localStorage.getItem('token')).toBe('t')
  })

  it('asks who becomes the owner of each bolão, preselects the suggestion and sends the choice', async () => {
    stub(204, null, [BLOCKER])
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))

    expect(await screen.findByText('Quem fica como dono de Firma?')).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Ana' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Bia' }))

    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(screen.getByText('tela de login')).toBeTruthy())
    expect(JSON.parse(deletes()[0].body ?? '{}')).toEqual({ new_owners: { 'b-1': 'u-bia' } })
  })
})
