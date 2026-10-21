import { describe, it, expect, vi, afterEach } from 'vitest'
import { forgotPassword, resetPassword } from './authApi'
import { API_BASE } from '../../../shared/api/client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(response: { ok: boolean; status: number; body?: string }) {
  const fetchMock = vi.fn(async () => ({ ...response, text: async () => response.body ?? '' }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('forgotPassword', () => {
  it('posts the login', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204 })
    await forgotPassword('maria@example.com')
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/forgot-password`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ login: 'maria@example.com' }) })
    )
  })
})

describe('resetPassword', () => {
  it('posts the token and the new password', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204 })
    await resetPassword('tok', 'segredo123')
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/reset-password`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'tok', new_password: 'segredo123' }) })
    )
  })

  it('throws the API message for a bad link', async () => {
    stubFetch({ ok: false, status: 400, body: JSON.stringify({ error: 'link inválido ou expirado' }) })
    await expect(resetPassword('tok', 'segredo123')).rejects.toThrow('link inválido ou expirado')
  })
})
