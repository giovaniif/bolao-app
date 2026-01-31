import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login } from './authApi'

const mockFetch = vi.fn()

describe('authApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  it('calls login endpoint with username', async () => {
    const responseData = {
      token: 'jwt',
      user_id: '1',
      username: 'admin',
      is_admin: true,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(responseData)),
    })

    const res = await login('admin')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin' }),
      })
    )
    expect(res.token).toBe('jwt')
    expect(res.username).toBe('admin')
  })
})
