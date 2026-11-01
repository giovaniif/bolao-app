const mockInit = jest.fn()
jest.mock('@sentry/react-native', () => ({ init: mockInit, setUser: jest.fn() }))

it('does not start Sentry in local runs even with a DSN', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1'
  jest.isolateModules(() => {
    jest.requireActual<typeof import('./sentry')>('./sentry').initSentry()
  })
  delete process.env.EXPO_PUBLIC_SENTRY_DSN
  expect(mockInit).not.toHaveBeenCalled()
})
