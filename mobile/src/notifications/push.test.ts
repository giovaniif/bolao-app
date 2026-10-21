import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as SecureStore from 'expo-secure-store'
import { fakeApi } from '../test/fakeApi'
import { registerForPush, unregisterForPush } from './push'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } },
}))

const notifications = jest.mocked(Notifications)

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.deleteItemAsync('push-asked')
  await SecureStore.deleteItemAsync('push-token')
})

describe('registerForPush', () => {
  it('asks for permission and registers the Expo token with the project id and platform', async () => {
    const calls = fakeApi([{ method: 'POST', path: /^\/push\/expo-tokens$/, body: null, status: 204 }])

    await expect(registerForPush()).resolves.toBe('ExponentPushToken[test]')

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-id' })
    expect(calls).toEqual([
      { method: 'POST', path: '/push/expo-tokens', body: JSON.stringify({ token: 'ExponentPushToken[test]', platform: 'ios' }) },
    ])
  })

  it('asks only once when the user says no', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: true } as never)
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: true } as never)
    const calls = fakeApi([])

    await expect(registerForPush()).resolves.toBeNull()
    await expect(registerForPush()).resolves.toBeNull()

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('registers without asking when permission was already granted', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true } as never)
    const calls = fakeApi([{ method: 'POST', path: /^\/push\/expo-tokens$/, body: null, status: 204 }])

    await registerForPush()

    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
  })

  it('does nothing on a simulator', async () => {
    const restore = jest.replaceProperty(Device, 'isDevice', false)
    const calls = fakeApi([])

    await expect(registerForPush()).resolves.toBeNull()

    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
    restore.restore()
  })
})

describe('unregisterForPush', () => {
  it('removes the registered token from the API once', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true } as never)
    const calls = fakeApi([
      { method: 'POST', path: /^\/push\/expo-tokens$/, body: null, status: 204 },
      { method: 'DELETE', path: /^\/push\/expo-tokens$/, body: null, status: 204 },
    ])
    await registerForPush()

    await unregisterForPush()
    await unregisterForPush()

    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([
      { method: 'DELETE', path: '/push/expo-tokens', body: JSON.stringify({ token: 'ExponentPushToken[test]' }) },
    ])
  })

  it('does not fail sign out when the API is unreachable', async () => {
    await SecureStore.setItemAsync('push-token', 'ExponentPushToken[test]')
    fakeApi([{ method: 'DELETE', path: /^\/push\/expo-tokens$/, body: { error: 'falhou' }, status: 500 }])

    await expect(unregisterForPush()).resolves.toBeUndefined()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('push-token')
  })
})
