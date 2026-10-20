import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { DeleteAccount } from './DeleteAccount'

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('DeleteAccount', () => {
  it('asks to confirm, deletes the account and clears the session', async () => {
    const calls = fakeApi([{ method: 'DELETE', path: /^\/me$/, body: null, status: 204 }])
    await renderWithProviders(<DeleteAccount />)
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    expect(calls).toHaveLength(0)
    await fireEvent.press(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token'))
    expect(calls).toEqual([{ method: 'DELETE', path: '/me', body: undefined }])
  })

  it('explains when the owner must hand over a bolão first', async () => {
    fakeApi([{ method: 'DELETE', path: /^\/me$/, status: 409, body: { error: 'passe seus bolões ativos para outra pessoa antes de excluir a conta' } }])
    await renderWithProviders(<DeleteAccount />)
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Sim, excluir' }))
    expect(await screen.findByText('passe seus bolões ativos para outra pessoa antes de excluir a conta')).toBeTruthy()
  })
})
