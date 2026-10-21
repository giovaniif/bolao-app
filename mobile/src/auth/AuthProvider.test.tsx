import { Pressable, Text } from 'react-native'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { useAuth } from './AuthProvider'

function SignOutButton() {
  const { ready, signOut } = useAuth()
  return (
    <Pressable accessibilityRole="button" onPress={() => signOut()} disabled={!ready}>
      <Text>Sair</Text>
    </Pressable>
  )
}

describe('AuthProvider', () => {
  it('removes the device push token while the session is still valid on sign out', async () => {
    await SecureStore.setItemAsync('token', 'jwt')
    await SecureStore.setItemAsync('push-token', 'ExponentPushToken[test]')
    const calls = fakeApi([{ method: 'DELETE', path: /^\/push\/expo-tokens$/, body: null, status: 204 }])

    await renderWithProviders(<SignOutButton />)
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith('token'))
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token'))
    expect(calls).toEqual([{ method: 'DELETE', path: '/push/expo-tokens', body: JSON.stringify({ token: 'ExponentPushToken[test]' }) }])
    expect(await SecureStore.getItemAsync('push-token')).toBeNull()
  })
})
