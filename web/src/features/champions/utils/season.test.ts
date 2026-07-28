import { describe, it, expect } from 'vitest'
import { seasonYear, byRecencyDesc } from './season'
import type { Bolao } from '../../boloes/api/boloesApi'

function bolao(over: Partial<Bolao> & { name: string }): Bolao {
  return {
    id: over.name,
    status: 'finished',
    started_at: '2025-03-01T00:00:00Z',
    ...over,
  }
}

describe('seasonYear', () => {
  it('uses the year in the name', () => {
    expect(seasonYear(bolao({ name: 'Brasileirão 2024' }))).toBe(2024)
  })

  // A bolão spanning new year would show the wrong year from the date alone.
  it('prefers the name over the finish date', () => {
    const b = bolao({
      name: 'Brasileirão 2025',
      started_at: '2025-03-01T00:00:00Z',
      finished_at: '2026-02-10T00:00:00Z',
    })
    expect(seasonYear(b)).toBe(2025)
  })

  it('falls back to finished_at when the name has no year', () => {
    const b = bolao({ name: 'Copa dos Amigos', finished_at: '2023-11-30T00:00:00Z' })
    expect(seasonYear(b)).toBe(2023)
  })

  it('falls back to started_at when there is no finish date', () => {
    const b = bolao({ name: 'Copa dos Amigos', started_at: '2022-04-01T00:00:00Z' })
    expect(seasonYear(b)).toBe(2022)
  })

  it('does not mistake an arbitrary number for a year', () => {
    const b = bolao({ name: 'Copa 12 times', finished_at: '2021-12-01T00:00:00Z' })
    expect(seasonYear(b)).toBe(2021)
  })
})

describe('byRecencyDesc', () => {
  it('sorts newest first', () => {
    const a = bolao({ name: 'a', finished_at: '2024-12-01T00:00:00Z' })
    const b = bolao({ name: 'b', finished_at: '2025-12-01T00:00:00Z' })
    expect([a, b].sort(byRecencyDesc).map((x) => x.name)).toEqual(['b', 'a'])
  })
})
