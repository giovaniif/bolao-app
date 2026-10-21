import { act, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { PushGate } from './PushGate'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } },
}))

const notifications = jest.mocked(Notifications)

function tapResponse() {
  return { notification: { request: { content: { data: { url: '/palpites?rodada=7' } } } } } as never
}

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.deleteItemAsync('push-asked')
  await SecureStore.deleteItemAsync('push-token')
  await SecureStore.deleteItemAsync('token')
})

describe('PushGate', () => {
  it('registers for push once the user is signed in', async () => {
    await SecureStore.setItemAsync('token', 'jwt')
    const calls = fakeApi([{ method: 'POST', path: /^\/push\/expo-tokens$/, body: null, status: 204 }])

    await renderWithProviders(<PushGate />)

    await waitFor(() => expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /push/expo-tokens']))
  })

  it('does not register while signed out', async () => {
    const calls = fakeApi([])

    await renderWithProviders(<PushGate />)

    await waitFor(() => expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalled())
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('opens Palpitar when a notification is tapped', async () => {
    fakeApi([])
    await renderWithProviders(<PushGate />)
    await waitFor(() => expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalled())
    const onTap = notifications.addNotificationResponseReceivedListener.mock.calls[0][0]

    await act(async () => onTap(tapResponse()))

    expect(router.push).toHaveBeenCalledWith('/palpitar')
  })

  it('opens Palpitar for the notification that launched the app', async () => {
    notifications.getLastNotificationResponse.mockReturnValueOnce(tapResponse())
    fakeApi([])

    await renderWithProviders(<PushGate />)

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/palpitar'))
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled()
  })
})
