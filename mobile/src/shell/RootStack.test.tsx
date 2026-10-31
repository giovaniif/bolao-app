import type { ReactNode } from 'react'
import { screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { RootStack } from './RootStack'

jest.mock('expo-router', () => {
  const { Text: RNText, View } = jest.requireActual('react-native')
  const Stack = ({ children }: { children: ReactNode }) => <View>{children}</View>
  Stack.Screen = ({ name, options }: { name: string; options?: { gestureEnabled?: boolean } }) => (
    <RNText>{`screen:${name}${options?.gestureEnabled === false ? ':nogesture' : ''}`}</RNText>
  )
  Stack.Protected = ({ guard, children }: { guard: boolean; children: ReactNode }) => (guard ? <View>{children}</View> : null)
  return { Stack }
})

const SIGNED_OUT_ONLY = ['login', 'cadastro', 'esqueci-senha']

beforeEach(async () => {
  await SecureStore.deleteItemAsync('token')
})

describe('RootStack', () => {
  it('offers login, sign-up and password reset while signed out', async () => {
    await renderWithProviders(<RootStack />)
    for (const name of SIGNED_OUT_ONLY) {
      expect(await screen.findByText(`screen:${name}`)).toBeTruthy()
    }
    expect(screen.queryByText('screen:(app)')).toBeNull()
  })

  it('drops login, sign-up and password reset from the stack once signed in', async () => {
    await SecureStore.setItemAsync('token', 'jwt')
    await renderWithProviders(<RootStack />)
    expect(await screen.findByText('screen:(app)')).toBeTruthy()
    await waitFor(() => {
      for (const name of SIGNED_OUT_ONLY) {
        expect(screen.queryByText(`screen:${name}`)).toBeNull()
      }
    })
  })

  it('keeps the onboarding reachable after the social sign-in, without a back gesture', async () => {
    await SecureStore.setItemAsync('token', 'jwt')
    await renderWithProviders(<RootStack />)
    expect(await screen.findByText('screen:boas-vindas:nogesture')).toBeTruthy()
  })
})

