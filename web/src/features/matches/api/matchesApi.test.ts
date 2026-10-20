import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMatchesByRound, getRoundsSummary } from './matchesApi'
import { API_BASE } from '../../../shared/api/client'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('[]') })
  vi.stubGlobal('fetch', mockFetch)
})

describe('matchesApi', () => {
  it('reads the matches of the current bolão', async () => {
    await getMatchesByRound(7, 'b-1')
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/boloes/b-1/matches/round/7`, expect.anything())
  })

  it('reads the rounds of the current bolão', async () => {
    await getRoundsSummary(undefined, 'b-1')
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/boloes/b-1/matches/rounds/summary`, expect.anything())
  })

  it('a past season keeps the old query', async () => {
    await getRoundsSummary('s-2025', 'b-1')
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/matches/rounds/summary?bolao_id=s-2025`, expect.anything())
  })
})
