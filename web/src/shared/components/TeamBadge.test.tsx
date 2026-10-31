import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamBadge } from './TeamBadge'

describe('TeamBadge', () => {
  it('draws the initials with no image', () => {
    const { container } = render(<TeamBadge team="Palmeiras" />)

    expect(screen.getByText('PAL')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('draws a team without a known color', () => {
    render(<TeamBadge team="Time da Rua" />)

    expect(screen.getByText('TR')).toBeTruthy()
  })
})
