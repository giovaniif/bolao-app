import { describe, it, expect } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Maria Silva')).toBe('MS')
  })

  it('ignores middle names', () => {
    expect(initials('ana paula de souza')).toBe('AS')
  })

  it('returns one letter for a single name', () => {
    expect(initials('Maria')).toBe('M')
  })

  it('returns empty for a blank name', () => {
    expect(initials('   ')).toBe('')
    expect(initials('')).toBe('')
  })
})
