import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unlockMatch } from './adminApi'
import { API_BASE } from '../../../shared/api/client'

const mockFetch = vi.fn()

describe('adminApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  it('hands a corrected match back to the automatic sync', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: 'm1', locked: false })),
    })

    const match = await unlockMatch('m1')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/matches/m1/lock`,
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(match.locked).toBe(false)
  })
})
