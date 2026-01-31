import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login } from './authApi'

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
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: '123' }),
      })
    )
    expect(res.token).toBe('jwt')
    expect(res.username).toBe('admin')
  })
})
