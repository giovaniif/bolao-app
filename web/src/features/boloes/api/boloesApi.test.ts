import { describe, it, expect, vi, beforeEach } from 'vitest'
import { finishBolao, UnresolvedMatchesError } from './boloesApi'
import { API_BASE } from '../../../shared/api/client'

const mockFetch = vi.fn()

describe('boloesApi', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('finishes the given bolão', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{"id":"b-1","status":"finished"}') })

    const bolao = await finishBolao('b-1', true)

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/boloes/b-1/finish`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ force: true }) })
    )
    expect(bolao.status).toBe('finished')
  })

  it('reports the rounds that still have matches without result', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve('{"error":"existem jogos sem resultado definido","rounds":[2,3],"count":4}'),
    })

    const err = await finishBolao('b-1').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(UnresolvedMatchesError)
    expect((err as UnresolvedMatchesError).rounds).toEqual([2, 3])
    expect((err as UnresolvedMatchesError).count).toBe(4)
  })
})
