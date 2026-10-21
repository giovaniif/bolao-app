import { buildSeason, byRecencyDesc, seasonYear, tallyTitles, type Season } from './season'
import type { MyBolao, Standing } from '../api/play'

function bolao(over: Partial<MyBolao> & { name: string }): MyBolao {
  return {
    id: over.name,
    status: 'finished',
    role: 'participant',
    member_status: 'active',
    member_count: 2,
    started_at: '2025-03-01T00:00:00Z',
    ...over,
  }
}

function standing(id: string, points: number, over: Partial<Standing> = {}): Standing {
  return { id, username: id, display_name: id, total_points: points, exact_scores: 1, correct_results: 2, rounds_won: 1, ...over }
}

function season(championId: string | null, name = championId ?? ''): Season {
  return buildSeason(bolao({ name: `b-${championId}` }), championId ? [standing(championId, 100, { display_name: name })] : [])
}

describe('seasonYear', () => {
  it('uses the year in the name', () => {
    expect(seasonYear(bolao({ name: 'Brasileirão 2024' }))).toBe(2024)
  })

  it('keeps the year from the name when the season ends the next year', () => {
    expect(seasonYear(bolao({ name: 'Brasileirão 2025', finished_at: '2026-02-10T00:00:00Z' }))).toBe(2025)
  })

  it('falls back to finished_at when the name has no year', () => {
    expect(seasonYear(bolao({ name: 'Copa dos Amigos', finished_at: '2023-11-30T00:00:00Z' }))).toBe(2023)
  })

  it('falls back to started_at when there is no finish date', () => {
    expect(seasonYear(bolao({ name: 'Copa dos Amigos', started_at: '2022-04-01T00:00:00Z' }))).toBe(2022)
  })

  it('does not mistake an arbitrary number for a year', () => {
    expect(seasonYear(bolao({ name: 'Copa 12 times', finished_at: '2021-12-01T00:00:00Z' }))).toBe(2021)
  })
})

describe('byRecencyDesc', () => {
  it('sorts newest first', () => {
    const a = bolao({ name: 'a', finished_at: '2024-12-01T00:00:00Z' })
    const b = bolao({ name: 'b', finished_at: '2025-12-01T00:00:00Z' })
    expect([a, b].sort(byRecencyDesc).map((x) => x.name)).toEqual(['b', 'a'])
  })
})

describe('buildSeason', () => {
  it('takes the podium, the player count and the margin from the ranking', () => {
    const s = buildSeason(bolao({ name: 'Brasileirão 2025' }), [standing('ana', 120), standing('bia', 100), standing('cris', 90)])
    expect(s.year).toBe(2025)
    expect(s.champion?.id).toBe('ana')
    expect(s.runnerUp?.id).toBe('bia')
    expect(s.third?.id).toBe('cris')
    expect(s.players).toBe(3)
    expect(s.margin).toBe(20)
    expect(s.tiedForFirst).toBe(false)
  })

  it('flags a tie when every tiebreaker is equal', () => {
    const s = buildSeason(bolao({ name: 'x' }), [standing('ana', 100), standing('bia', 100)])
    expect(s.tiedForFirst).toBe(true)
    expect(s.margin).toBe(0)
  })

  it('has no champion for an empty ranking', () => {
    const s = buildSeason(bolao({ name: 'x' }), [])
    expect(s.champion).toBeUndefined()
    expect(s.players).toBe(0)
  })
})

describe('tallyTitles', () => {
  it('counts titles per champion, most first, then by name', () => {
    const seasons = [season('bia', 'Bia'), season('ana', 'Ana'), season('bia', 'Bia'), season('cris', 'Cris')]
    expect(tallyTitles(seasons)).toEqual([
      { id: 'bia', name: 'Bia', titles: 2 },
      { id: 'ana', name: 'Ana', titles: 1 },
      { id: 'cris', name: 'Cris', titles: 1 },
    ])
  })

  it('skips seasons without a champion', () => {
    expect(tallyTitles([season(null)])).toEqual([])
  })
})
