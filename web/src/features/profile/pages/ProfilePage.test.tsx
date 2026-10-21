import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ProfilePage } from './ProfilePage'

interface Call {
  path: string
  method: string
  body?: string
}

function stubApi(profile: Record<string, unknown>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api/, '')
      const method = init?.method ?? 'GET'
      calls.push({ path, method, body: init?.body as string | undefined })
      let body: unknown = []
      if (path === '/me' && method === 'PUT') body = { ...profile, ...JSON.parse(init?.body as string) }
      else if (path === '/me') body = profile
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
  return calls
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const base = { id: '1', username: 'maria', display_name: 'Maria', favorite_team: null, is_admin: false }

describe('ProfilePage email', () => {
  it('lets a user without email add one', async () => {
    const calls = stubApi(base)
    renderWithProviders(<ProfilePage />)
    const email = (await screen.findByLabelText('E-mail')) as HTMLInputElement
    expect(email.value).toBe('')
    expect(screen.getByText(/para recuperar a senha/)).toBeTruthy()
    fireEvent.change(email, { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT')
    expect(JSON.parse(put?.body ?? '{}').email).toBe('maria@example.com')
  })

  it('shows the saved email and leaves it out when empty', async () => {
    const calls = stubApi({ ...base, email: 'maria@example.com' })
    renderWithProviders(<ProfilePage />)
    await waitFor(() => expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('maria@example.com'))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT')
    expect('email' in JSON.parse(put?.body ?? '{}')).toBe(false)
  })
})
