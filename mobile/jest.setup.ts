jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key)
    }),
  }
})

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[test]' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
}))

jest.mock('expo-device', () => ({ isDevice: true }))

require('@testing-library/react-native').configure({ asyncUtilTimeout: 10000 })

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default)

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native')
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: unknown }) => children,
    usePanGesture: () => ({}),
  }
})

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => {
      const shared = { value: initial, get: () => shared.value, set: (v: number) => { shared.value = v } }
      return shared
    },
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: number) => value,
    withSpring: (value: number) => value,
  }
})

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
}))
