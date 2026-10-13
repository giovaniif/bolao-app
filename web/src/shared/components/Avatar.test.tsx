import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders the initials', () => {
    render(<Avatar name="Giovani Farias" />)
    expect(screen.getByText('GF')).toBeTruthy()
  })

  it('hides the glyph from the accessibility tree', () => {
    render(<Avatar name="Giovani Farias" />)
    expect(screen.getByText('GF').getAttribute('aria-hidden')).toBe('true')
  })
})
