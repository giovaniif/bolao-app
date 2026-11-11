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

describe('reporting builds', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN
    jest.restoreAllMocks()
    mockInit.mockClear()
  })

  it('warns and skips init when the DSN is missing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.isolateModules(() => {
      jest.requireActual<typeof import('./sentry')>('./sentry').initSentry(() => true)
    })
    expect(mockInit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_SENTRY_DSN'))
  })

  it('starts Sentry without warning when the DSN is set', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1'
    jest.isolateModules(() => {
      jest.requireActual<typeof import('./sentry')>('./sentry').initSentry(() => true)
    })
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/1' }))
    expect(warn).not.toHaveBeenCalled()
  })
})
