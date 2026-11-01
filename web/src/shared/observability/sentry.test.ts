import { it, expect, vi } from 'vitest'

const init = vi.fn()
vi.mock('@sentry/react', () => ({ init }))

it('does not start Sentry in local runs even with a DSN', async () => {
  const { initSentry } = await import('./sentry')
  initSentry('https://key@o1.ingest.sentry.io/1')
  expect(init).not.toHaveBeenCalled()
})
