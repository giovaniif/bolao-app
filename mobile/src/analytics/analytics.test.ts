const mockClient = { optIn: jest.fn(), optOut: jest.fn(), capture: jest.fn(), identify: jest.fn(), reset: jest.fn() }
const mockCtor = jest.fn(() => mockClient)
jest.mock('posthog-react-native', () => ({ __esModule: true, default: mockCtor, PostHog: mockCtor }))

type Store = { setItemAsync: (k: string, v: string) => Promise<void> }

function load(key?: string, consent?: string) {
  jest.resetModules()
  if (key) process.env.EXPO_PUBLIC_POSTHOG_KEY = key
  else delete process.env.EXPO_PUBLIC_POSTHOG_KEY
  const store = jest.requireMock<Store>('expo-secure-store')
  if (consent) store.setItemAsync('analytics-consent', consent)
  return jest.requireActual<typeof import('./analytics')>('./analytics')
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('analytics', () => {
  it('does nothing without a key', async () => {
    const a = load()
    await a.startAnalytics()
    a.track('bolao_created')
    expect(mockCtor).not.toHaveBeenCalled()
    expect(await a.needsConsent()).toBe(false)
  })

  it('starts opted out on the EU servers and asks for consent', async () => {
    const a = load('phc_key')
    await a.startAnalytics()
    expect(mockCtor).toHaveBeenCalledWith('phc_key', expect.objectContaining({ host: 'https://us.i.posthog.com', defaultOptIn: false }))
    expect(await a.needsConsent()).toBe(true)
  })

  it('tracks only after the user accepts, and stops after a refusal', async () => {
    const a = load('phc_key')
    await a.startAnalytics()
    await a.setConsent('granted')
    expect(mockClient.optIn).toHaveBeenCalled()
    a.track('predictions_saved', { round: 7 })
    expect(mockClient.capture).toHaveBeenCalledWith('predictions_saved', { round: 7 })

    await a.setConsent('denied')
    expect(mockClient.optOut).toHaveBeenCalled()
    a.track('bolao_created')
    expect(mockClient.capture).toHaveBeenCalledTimes(1)
  })

  it('identifies a user by id only', async () => {
    const a = load('phc_key', 'granted')
    await a.startAnalytics()
    a.identify('u-1')
    expect(mockClient.identify).toHaveBeenCalledWith('u-1')
  })
})
