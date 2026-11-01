const mockCtor = jest.fn()
jest.mock('posthog-react-native', () => ({ __esModule: true, default: mockCtor, PostHog: mockCtor }))

it('does not start PostHog in local runs even with a key', async () => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_key'
  let a: typeof import('./analytics') | undefined
  jest.isolateModules(() => {
    a = jest.requireActual<typeof import('./analytics')>('./analytics')
  })
  delete process.env.EXPO_PUBLIC_POSTHOG_KEY
  await a!.startAnalytics()
  expect(mockCtor).not.toHaveBeenCalled()
  expect(await a!.needsConsent()).toBe(false)
})
