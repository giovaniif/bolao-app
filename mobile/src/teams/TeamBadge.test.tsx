import { render, screen } from '@testing-library/react-native'
import { TeamBadge } from './TeamBadge'
import { teamBadge, teamInitials } from './teamBadges'

describe('teamBadges', () => {
  it('gives a known team its initials and two colors', () => {
    expect(teamBadge('Flamengo')).toEqual({ initials: 'FLA', fill: expect.stringMatching(/^#[0-9a-f]{6}$/), ring: expect.stringMatching(/^#[0-9a-f]{6}$/), text: expect.stringMatching(/^#[0-9a-f]{6}$/) })
    expect(teamBadge('São Paulo').initials).toBe('SP')
    expect(teamBadge('Atlético-MG').initials).toBe('AM')
  })

  it('gives an unknown team stable colors from its name', () => {
    expect(teamBadge('Time Novo')).toEqual(teamBadge('Time Novo'))
    expect(teamBadge('Time Novo').initials).toBe('TN')
  })

  it('builds initials from the name', () => {
    expect(teamInitials('Flamengo')).toBe('FLA')
    expect(teamInitials('Time da Rua')).toBe('TR')
  })
})

describe('TeamBadge', () => {
  it('draws the initials with no image', async () => {
    await render(<TeamBadge team="São Paulo" size={40} />)
    expect(screen.getByTestId('badge:São Paulo')).toBeTruthy()
    expect(screen.getByText('SP')).toBeTruthy()
    expect(screen.toJSON()).not.toHaveProperty('props.source')
  })
})
