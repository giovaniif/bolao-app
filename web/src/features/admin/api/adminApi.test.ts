import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMatchesByRound, unlockMatch, updateMatchResults, updateRoundCloses } from './adminApi'
import { API_BASE } from '../../../shared/api/client'

const mockFetch = vi.fn()

describe('adminApi', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('[]') })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('hands a corrected match back to the automatic sync', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: 'm1', locked: false })),
    })

    const match = await unlockMatch('b-1', 'm1')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/boloes/b-1/matches/m1/lock`,
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(match.locked).toBe(false)
  })

  it('reads the matches of the round in the current bolão', async () => {
    await getMatchesByRound('b-1', 7)
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/boloes/b-1/matches/round/7`, expect.anything())
  })

  it('saves a result in the current bolão', async () => {
    await updateMatchResults('b-1', 'm1', 2, 1)
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/boloes/b-1/matches/m1/results`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ home_goals: 2, away_goals: 1 }) })
    )
  })

  it('moves the close time of a round in the current bolão', async () => {
    await updateRoundCloses('b-1', 7, '2026-10-21T18:00:00Z')
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/boloes/b-1/matches/round/7/closes`,
      expect.objectContaining({ method: 'PUT' })
    )
  })
})
