import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { DeleteAccount } from './DeleteAccount'

let requests: { url: string; method: string }[] = []

function stub(status: number, body: unknown) {
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? 'GET' })
      return { ok: status < 400, status, text: async () => (status === 204 ? '' : JSON.stringify(body)) }
    })
  )
}

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
    expect(requests).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))

    await waitFor(() => expect(screen.getByText('tela de login')).toBeTruthy())
    expect(requests).toEqual([{ url: expect.stringMatching(/\/me$/), method: 'DELETE' }])
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('explains when the owner must hand over a bolão first', async () => {
    stub(409, { error: 'passe seus bolões ativos para outra pessoa antes de excluir a conta' })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    expect(await screen.findByText('passe seus bolões ativos para outra pessoa antes de excluir a conta')).toBeTruthy()
    expect(localStorage.getItem('token')).toBe('t')
  })
})
