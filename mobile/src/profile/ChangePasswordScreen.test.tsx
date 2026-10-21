import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { ChangePasswordScreen } from './ChangePasswordScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.setItemAsync('token', 'jwt')
})

async function fill(current: string, next: string, confirm: string) {
  await fireEvent.changeText(screen.getByLabelText('Senha atual'), current)
  await fireEvent.changeText(screen.getByLabelText('Nova senha'), next)
  await fireEvent.changeText(screen.getByLabelText('Confirmar nova senha'), confirm)
  await fireEvent.press(screen.getByRole('button', { name: 'Alterar senha' }))
}

describe('ChangePasswordScreen', () => {
  it('changes the password and goes home', async () => {
    const calls = fakeApi([{ method: 'POST', path: /^\/auth\/change-password$/, body: { message: 'ok' } }])
    await renderWithProviders(<ChangePasswordScreen />)
    await fill('velha123', 'nova12345', 'nova12345')
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(JSON.parse(calls[0].body!)).toEqual({ current_password: 'velha123', new_password: 'nova12345' })
  })

  it('refuses when the two new passwords differ', async () => {
    const calls = fakeApi([])
    await renderWithProviders(<ChangePasswordScreen />)
    await fill('velha123', 'nova12345', 'outra1234')
    expect(screen.getByText('As senhas não conferem.')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('shows the API error', async () => {
    fakeApi([{ method: 'POST', path: /^\/auth\/change-password$/, status: 400, body: { error: 'senha atual incorreta' } }])
    await renderWithProviders(<ChangePasswordScreen />)
    await fill('errada12', 'nova12345', 'nova12345')
    expect(await screen.findByText('senha atual incorreta')).toBeTruthy()
  })
})
