import { describe, it, expect, vi, afterEach } from 'vitest'
import { API_BASE } from '../../../shared/api/client'
import { joinPublicBolao, searchPublicBoloes } from './publicBoloesApi'

function respond(body: unknown) {
  const mock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(body) }))
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => vi.unstubAllGlobals())

describe('publicBoloesApi', () => {
  it('searches the public bolões by name', async () => {
    const mock = respond([{ id: 'b-1', name: 'Firma 2026', requires_approval: true, max_members: 50, member_count: 21 }])

    const res = await searchPublicBoloes('firma x')

    expect(mock).toHaveBeenCalledWith(`${API_BASE}/boloes/public?q=firma+x`, expect.anything())
    expect(res[0].name).toBe('Firma 2026')
  })

  it('lists every public bolão for an empty search', async () => {
    const mock = respond([])

    await searchPublicBoloes('  ')

    expect(mock).toHaveBeenCalledWith(`${API_BASE}/boloes/public`, expect.anything())
  })

  it('joins a bolão from the listing', async () => {
    const mock = respond({ bolao_id: 'b-1', status: 'pending' })

    const res = await joinPublicBolao('b-1')

    expect(mock).toHaveBeenCalledWith(`${API_BASE}/boloes/b-1/join`, expect.objectContaining({ method: 'POST' }))
    expect(res.status).toBe('pending')
  })
})
