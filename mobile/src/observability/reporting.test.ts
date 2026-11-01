import { reportingAllowed } from './reporting'

describe('reportingAllowed', () => {
  it('allows only release builds outside jest', () => {
    expect(reportingAllowed({ dev: false, jest: false })).toBe(true)
    expect(reportingAllowed({ dev: true, jest: false })).toBe(false)
    expect(reportingAllowed({ dev: false, jest: true })).toBe(false)
  })

  it('is off inside jest', () => {
    expect(reportingAllowed()).toBe(false)
  })
})
