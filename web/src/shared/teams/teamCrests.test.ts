import { describe, it, expect } from 'vitest'
import { crestUrl, teamInitials } from './teamCrests'

describe('teamCrests', () => {
  it('maps every Série A team to its crest', () => {
    expect(crestUrl('Flamengo')).toBe('https://crests.football-data.org/1783.png')
    expect(crestUrl('São Paulo')).toBe('https://crests.football-data.org/1776.png')
    expect(crestUrl('Athletico-PR')).toBe('https://crests.football-data.org/1768.png')
    expect(crestUrl('Santos')).toBe('https://crests.football-data.org/6685.png')
  })

  it('has no crest for an unknown team', () => {
    expect(crestUrl('Time da Rua')).toBeUndefined()
  })

  it('builds initials for the fallback circle', () => {
    expect(teamInitials('Flamengo')).toBe('FLA')
    expect(teamInitials('São Paulo')).toBe('SP')
    expect(teamInitials('Atlético-MG')).toBe('AM')
  })
})
