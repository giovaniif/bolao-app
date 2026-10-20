import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login } from './authApi'
import { API_BASE } from '../../../shared/api/client'

const mockFetch = vi.fn()

describe('authApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  it('calls login endpoint with username and password', async () => {
    const responseData = {
      token: 'jwt',
      user_id: '1',
      username: 'admin',
      is_admin: true,
      must_change_password: false,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(responseData)),
    })

    const res = await login('admin', '123')
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/auth/login`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: '123' }),
      })
    )
    expect(res.token).toBe('jwt')
    expect(res.username).toBe('admin')
  })
})

describe('signup', () => {
  it('creates the account and returns the login', async () => {
    const mockSignup = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ token: 'jwt', user_id: '9', username: 'joao', is_admin: false, must_change_password: false })),
    })
    vi.stubGlobal('fetch', mockSignup)
    const { signup } = await import('./authApi')

    const res = await signup({ username: 'joao', display_name: 'João', email: 'joao@example.com', password: 'segredo123' })

    expect(mockSignup).toHaveBeenCalledWith(
      `${API_BASE}/auth/signup`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'joao', display_name: 'João', email: 'joao@example.com', password: 'segredo123' }),
      })
    )
    expect(res.username).toBe('joao')
  })
})
