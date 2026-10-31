import { describe, it, expect } from 'vitest'
import { teamBadge, teamInitials } from './teamBadges'

describe('teamBadges', () => {
  it('gives a known team its initials and two colors', () => {
    const badge = teamBadge('Flamengo')
    expect(badge.initials).toBe('FLA')
    expect(badge.fill).toMatch(/^#[0-9a-f]{6}$/)
    expect(badge.ring).toMatch(/^#[0-9a-f]{6}$/)
    expect(badge.text).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('gives an unknown team stable colors from its name', () => {
    expect(teamBadge('Time da Rua')).toEqual(teamBadge('Time da Rua'))
    expect(teamBadge('Time da Rua').initials).toBe('TR')
  })

  it('builds initials from the name', () => {
    expect(teamInitials('Flamengo')).toBe('FLA')
    expect(teamInitials('São Paulo')).toBe('SP')
    expect(teamInitials('Atlético-MG')).toBe('AM')
  })
})
