import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './client'
import { configureSession, consumeLoginNotice, needsRefresh, resetSessionState } from './session'

function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

const DAY = 86_400_000

function jwt(expiresInMs: number) {
  const payload = btoa(JSON.stringify({ exp: Math.floor((Date.now() + expiresInMs) / 1000) })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`
}

type Call = { path: string; auth?: string }

function stubFetch(handler: (path: string, auth?: string) => { status: number; body?: unknown }) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'http://localhost').pathname.replace(/^\/api/, '')
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
    calls.push({ path, auth })
    await new Promise((r) => setTimeout(r, 5))
    const { status, body } = handler(path, auth)
    return { ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }
  }))
  return calls
}

let refreshed: string[] = []
let expired = 0

beforeEach(() => {
  resetSessionState()
  refreshed = []
  expired = 0
  configureSession({
    onRefreshed: async (token) => {
      refreshed.push(token)
      setToken(token)
    },
    onExpired: async () => {
      expired += 1
      setToken(null)
    },
  })
})

describe('session', () => {
  it('needs a refresh only inside the last 7 days of the token', () => {
    expect(needsRefresh(jwt(20 * DAY))).toBe(false)
    expect(needsRefresh(jwt(2 * DAY))).toBe(true)
    expect(needsRefresh('not-a-jwt')).toBe(false)
  })

  it('refreshes a token that expires soon before the request, silently', async () => {
    const fresh = jwt(30 * DAY)
    setToken(jwt(DAY))
    const calls = stubFetch((path) => (path === '/auth/refresh' ? { status: 200, body: { token: fresh } } : { status: 200, body: { ok: true } }))

    await expect(api('/me')).resolves.toEqual({ ok: true })

    expect(refreshed).toEqual([fresh])
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh', '/me'])
    expect(calls[1].auth).toBe(`Bearer ${fresh}`)
    expect(expired).toBe(0)
  })

  it('makes a single refresh for parallel requests', async () => {
    const fresh = jwt(30 * DAY)
    setToken(jwt(DAY))
    const calls = stubFetch((path) => (path === '/auth/refresh' ? { status: 200, body: { token: fresh } } : { status: 200, body: [] }))

    await Promise.all([api('/me'), api('/boloes'), api('/classification')])

    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1)
    expect(calls.filter((c) => c.path !== '/auth/refresh').every((c) => c.auth === `Bearer ${fresh}`)).toBe(true)
  })

  it('logs out once with a message when the refresh fails, even for parallel requests', async () => {
    setToken(jwt(20 * DAY))
    const calls = stubFetch(() => ({ status: 401, body: { error: 'token inválido ou expirado' } }))

    const results = await Promise.allSettled([api('/me'), api('/boloes'), api('/classification')])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(expired).toBe(1)
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1)
    expect(consumeLoginNotice()).toBe('Sua sessão expirou. Entre de novo.')
    expect(consumeLoginNotice()).toBeNull()
  })

  it('logs out at once when the stored token has already expired', async () => {
    setToken(jwt(-DAY))
    const calls = stubFetch(() => ({ status: 200, body: {} }))

    await expect(api('/me')).rejects.toThrow('Sua sessão expirou. Entre de novo.')

    expect(expired).toBe(1)
    expect(calls).toHaveLength(0)
  })

  it('keeps a wrong-password 401 from the login as a normal error', async () => {
    setToken(null)
    stubFetch(() => ({ status: 401, body: { error: 'usuário ou senha inválidos' } }))

    await expect(api('/auth/login', { method: 'POST' })).rejects.toMatchObject({ status: 401, message: 'usuário ou senha inválidos' })

    expect(expired).toBe(0)
    expect(consumeLoginNotice()).toBeNull()
  })
})
