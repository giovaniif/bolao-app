import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamCrest } from './TeamCrest'

describe('TeamCrest', () => {
  it('shows the crest image of a known team', () => {
    render(<TeamCrest team="Palmeiras" />)

    expect(screen.getByRole('img', { name: 'Escudo do Palmeiras' }).getAttribute('src')).toBe(
      'https://crests.football-data.org/1769.png'
    )
  })

  it('falls back to the initials when the image fails', () => {
    render(<TeamCrest team="Palmeiras" />)

    fireEvent.error(screen.getByRole('img', { name: 'Escudo do Palmeiras' }))

    expect(screen.queryByRole('img', { name: 'Escudo do Palmeiras' })).toBeNull()
    expect(screen.getByText('PAL')).toBeTruthy()
  })

  it('shows the initials for a team without a crest', () => {
    render(<TeamCrest team="Time da Rua" />)

    expect(screen.getByText('TR')).toBeTruthy()
  })
})
