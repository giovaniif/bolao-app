import { api, API_BASE, setToken } from './client'

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
  setToken(null)
})

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: status < 400, status, text: async () => JSON.stringify(body) })
}

describe('api', () => {
  it('sends the token as a bearer header', async () => {
    setToken('jwt')
    respond(200, { ok: true })
    await api('/me')
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/me`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer jwt' }) })
    )
  })

  it('throws the Portuguese error message of the API', async () => {
    respond(409, { error: 'este nome de usuário já está em uso' })
    await expect(api('/auth/signup', { method: 'POST' })).rejects.toThrow('este nome de usuário já está em uso')
  })

  it('returns null for an empty body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' })
    await expect(api('/me', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('explains a network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(api('/me')).rejects.toThrow('Sem conexão com o servidor. Tente de novo.')
  })
})
