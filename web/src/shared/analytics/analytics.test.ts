import { describe, it, expect, vi, beforeEach } from 'vitest'

const posthog = {
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}
vi.mock('posthog-js', () => ({ default: posthog }))

async function freshModule() {
  vi.resetModules()
  return import('./analytics')
}

beforeEach(() => {
  localStorage.clear()
  Object.values(posthog).forEach((f) => f.mockReset())
})

describe('analytics', () => {
  it('does nothing without a key', async () => {
    const a = await freshModule()
    await a.startAnalytics(undefined)
    a.track('bolao_created')
    expect(posthog.init).not.toHaveBeenCalled()
    expect(a.needsConsent(undefined)).toBe(false)
  })

  it('starts opted out on the EU servers and asks for consent', async () => {
    const a = await freshModule()
    await a.startAnalytics('phc_key')
    expect(posthog.init).toHaveBeenCalledWith('phc_key', expect.objectContaining({ api_host: 'https://eu.i.posthog.com', opt_out_capturing_by_default: true }))
    expect(a.needsConsent('phc_key')).toBe(true)
  })

  it('tracks only after the user accepts, and stops after a refusal', async () => {
    const a = await freshModule()
    await a.startAnalytics('phc_key')
    a.setConsent('granted')
    expect(posthog.opt_in_capturing).toHaveBeenCalled()
    expect(localStorage.getItem('analytics-consent')).toBe('granted')
    a.track('predictions_saved', { round: 7 })
    expect(posthog.capture).toHaveBeenCalledWith('predictions_saved', { round: 7 })

    a.setConsent('denied')
    expect(posthog.opt_out_capturing).toHaveBeenCalled()
    a.track('bolao_created')
    expect(posthog.capture).toHaveBeenCalledTimes(1)
  })

  it('identifies a user by id only', async () => {
    const a = await freshModule()
    localStorage.setItem('analytics-consent', 'granted')
    await a.startAnalytics('phc_key')
    a.identify('u-1')
    expect(posthog.identify).toHaveBeenCalledWith('u-1')
  })

  it('remembers a refusal and does not ask again', async () => {
    const a = await freshModule()
    localStorage.setItem('analytics-consent', 'denied')
    await a.startAnalytics('phc_key')
    expect(a.needsConsent('phc_key')).toBe(false)
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled()
  })
})
