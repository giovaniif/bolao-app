import { describe, it, expect } from 'vitest'
import { scopedPath } from './scopedPath'

describe('scopedPath', () => {
  it('puts the bolão in front of the path', () => {
    expect(scopedPath('/matches/round/7', 'b-1')).toBe('/boloes/b-1/matches/round/7')
  })

  it('keeps the old path without a bolão', () => {
    expect(scopedPath('/matches/round/7')).toBe('/matches/round/7')
  })
})
