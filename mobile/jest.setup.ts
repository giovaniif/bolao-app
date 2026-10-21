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

require('@testing-library/react-native').configure({ asyncUtilTimeout: 10000 })

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default)

import 'react-native-gesture-handler/jestSetup'

jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'))
