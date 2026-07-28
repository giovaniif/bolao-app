import { describe, it, expect } from 'vitest'
import { tallyTitles } from '../utils/titles'
import type { Season } from '../hooks/useSeasons'

function season(championId: string | null, name = championId ?? ''): Season {
  const champion = championId
    ? {
        id: championId,
        username: championId,
        display_name: name,
        is_admin: false,
        amount_paid: 0,
        total_points: 100,
        exact_scores: 0,
        correct_results: 0,
        rounds_won: 0,
      }
    : undefined

  return {
    bolao: { id: `b-${championId}`, name: 'Bolão', status: 'finished', started_at: '' },
    year: 2025,
    ranking: champion ? [champion] : [],
    champion,
    players: champion ? 1 : 0,
    margin: 0,
    tiedForFirst: false,
  }
}

describe('tallyTitles', () => {
  it('counts one title per season won', () => {
    const got = tallyTitles([season('rafa', 'Rafa'), season('bia', 'Bia'), season('rafa', 'Rafa')])
    expect(got).toEqual([
      { id: 'rafa', name: 'Rafa', titles: 2 },
      { id: 'bia', name: 'Bia', titles: 1 },
    ])
  })

  it('works with a single season', () => {
    expect(tallyTitles([season('rafa', 'Rafa')])).toEqual([
      { id: 'rafa', name: 'Rafa', titles: 1 },
    ])
  })

  it('ignores seasons with no champion', () => {
    expect(tallyTitles([season(null)])).toEqual([])
  })

  it('breaks ties by name so the order is stable', () => {
    const got = tallyTitles([season('zeca', 'Zeca'), season('ana', 'Ana')])
    expect(got.map((w) => w.name)).toEqual(['Ana', 'Zeca'])
  })
})
