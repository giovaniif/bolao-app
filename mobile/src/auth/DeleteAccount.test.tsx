import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi, type Route } from '../test/fakeApi'
import { DeleteAccount } from './DeleteAccount'
import { consumeLoginNotice } from '../api/session'

const NO_BLOCKERS: Route = { path: /^\/me\/deletion-check$/, body: { blockers: [] } }
const BLOCKER = {
  bolao_id: 'b-1',
  bolao_name: 'Firma',
  suggested_owner_id: 'u-ana',
  members: [
    { user_id: 'u-ana', display_name: 'Ana', role: 'admin' },
    { user_id: 'u-bia', display_name: 'Bia', role: 'participant' },
  ],
}

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('DeleteAccount', () => {
  it('asks to confirm, deletes the account and clears the session', async () => {
    const calls = fakeApi([NO_BLOCKERS, { method: 'DELETE', path: /^\/me$/, body: null, status: 204 }])
    await renderWithProviders(<DeleteAccount />)
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await fireEvent.press(await screen.findByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token'))
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([{ method: 'DELETE', path: '/me', body: undefined }])
    expect(consumeLoginNotice()).toBe('Sua conta foi excluída')
  })

  it('shows the API error when the deletion fails', async () => {
    fakeApi([NO_BLOCKERS, { method: 'DELETE', path: /^\/me$/, status: 409, body: { error: 'passe seus bolões ativos para outra pessoa antes de excluir a conta' } }])
    await renderWithProviders(<DeleteAccount />)
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Sim, excluir' }))
    expect(await screen.findByText('passe seus bolões ativos para outra pessoa antes de excluir a conta')).toBeTruthy()
  })

  it('asks who becomes the owner of each bolão, preselects the suggestion and sends the choice', async () => {
    const calls = fakeApi([
      { path: /^\/me\/deletion-check$/, body: { blockers: [BLOCKER] } },
      { method: 'DELETE', path: /^\/me$/, body: null, status: 204 },
    ])
    await renderWithProviders(<DeleteAccount />)
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))

    expect(await screen.findByText('Quem fica como dono de Firma?')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Ana' }).props.accessibilityState).toEqual({ checked: true })
    await fireEvent.press(screen.getByRole('radio', { name: 'Bia' }))
    expect(screen.getByRole('radio', { name: 'Bia' }).props.accessibilityState).toEqual({ checked: true })

    await fireEvent.press(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token'))
    const del = calls.find((c) => c.method === 'DELETE')
    expect(JSON.parse(del?.body ?? '{}')).toEqual({ new_owners: { 'b-1': 'u-bia' } })
  })
})
