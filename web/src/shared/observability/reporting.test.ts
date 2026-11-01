import { describe, it, expect } from 'vitest'
import { reportingAllowed } from './reporting'

describe('reportingAllowed', () => {
  it('allows only deployed dev and prod builds', () => {
    expect(reportingAllowed({ dev: false, mode: 'production', environment: 'prod' })).toBe(true)
    expect(reportingAllowed({ dev: false, mode: 'production', environment: 'production' })).toBe(true)
    expect(reportingAllowed({ dev: false, mode: 'production', environment: 'dev' })).toBe(true)
    expect(reportingAllowed({ dev: false, mode: 'production', environment: undefined })).toBe(true)
    expect(reportingAllowed({ dev: true, mode: 'development', environment: 'dev' })).toBe(false)
    expect(reportingAllowed({ dev: false, mode: 'test', environment: 'prod' })).toBe(false)
    expect(reportingAllowed({ dev: false, mode: 'production', environment: 'local' })).toBe(false)
  })

  it('is off inside vitest', () => {
    expect(reportingAllowed()).toBe(false)
  })
})
