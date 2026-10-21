import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi, type Route } from '../test/fakeApi'
import { router, setParams } from '../test/routerMock'
import { MembersScreen } from './MembersScreen'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())

const BOLAO = { id: 'b-2', name: 'Firma', status: 'active', member_status: 'active', member_count: 4, visibility: 'private', requires_approval: true }
const MEMBERS = [
  { id: 'u-1', username: 'ana', display_name: 'Ana', role: 'owner', status: 'active', amount_paid: 0 },
  { id: 'u-2', username: 'bia', display_name: 'Bia', role: 'admin', status: 'active', amount_paid: 0 },
  { id: 'u-3', username: 'caio', display_name: 'Caio', role: 'participant', status: 'active', amount_paid: 0 },
]

function routes(role: string, extra: Route[] = []): Route[] {
  return [
    { path: /^\/me\/boloes$/, body: [{ ...BOLAO, role }] },
    { path: /^\/boloes\/b-2\/invite$/, body: { code: 'FIRMA234' } },
    { path: /^\/boloes\/b-2\/members$/, body: MEMBERS },
    ...extra,
  ]
}

beforeEach(async () => {
  jest.clearAllMocks()
  setParams({ id: 'b-2' })
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('MembersScreen as owner', () => {
  it('shows each role', async () => {
    fakeApi(routes('owner'))
    await renderWithProviders(<MembersScreen />)
    expect(await screen.findByText('Dono')).toBeTruthy()
    expect(screen.getByText('3 PARTICIPANTES')).toBeTruthy()
  })

  it('makes a participant an admin', async () => {
    const calls = fakeApi(routes('owner', [{ method: 'PUT', path: /^\/boloes\/b-2\/members\/u-3\/role$/, body: { role: 'admin' } }]))
    await renderWithProviders(<MembersScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Tornar Caio admin' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy())
    expect(JSON.parse(calls.find((c) => c.method === 'PUT')!.body!)).toEqual({ role: 'admin' })
  })

  it('removes a member after confirming', async () => {
    const calls = fakeApi(routes('owner', [{ method: 'DELETE', path: /^\/boloes\/b-2\/members\/u-3$/, body: { status: 'removed' } }]))
    await renderWithProviders(<MembersScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover Caio' }))
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar remoção de Caio' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })

  it('cannot remove or demote the owner', async () => {
    fakeApi(routes('owner'))
    await renderWithProviders(<MembersScreen />)
    await screen.findByRole('button', { name: 'Remover Caio' })
    expect(screen.queryByRole('button', { name: 'Remover Ana' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tornar Ana participante' })).toBeNull()
  })

  it('saves the bolão settings', async () => {
    const calls = fakeApi(routes('owner', [{ method: 'PATCH', path: /^\/boloes\/b-2$/, body: { ...BOLAO, name: 'Firma 2026' } }]))
    await renderWithProviders(<MembersScreen />)
    await waitFor(() => expect(screen.getByLabelText('Nome do bolão').props.value).toBe('Firma'))
    await fireEvent.changeText(screen.getByLabelText('Nome do bolão'), 'Firma 2026')
    await fireEvent.press(screen.getByRole('switch', { name: 'Aparece na lista pública' }))
    await fireEvent.press(screen.getByRole('switch', { name: 'Pedidos precisam de aprovação' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar configurações' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toBeTruthy())
    expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!)).toEqual({ name: 'Firma 2026', visibility: 'public', requires_approval: false })
  })

  it('generates a new code', async () => {
    fakeApi(routes('owner', [{ method: 'POST', path: /^\/boloes\/b-2\/invite\/rotate$/, body: { code: 'NOVO5678' } }]))
    await renderWithProviders(<MembersScreen />)
    await screen.findByText('FIRMA234')
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar novo código' }))
    expect(await screen.findByText('NOVO5678')).toBeTruthy()
  })

  it('cannot leave its own bolão', async () => {
    fakeApi(routes('owner'))
    await renderWithProviders(<MembersScreen />)
    await screen.findByText('Dono')
    expect(screen.queryByRole('button', { name: 'Sair do bolão' })).toBeNull()
  })
})

describe('MembersScreen as admin', () => {
  it('removes participants but not admins, and edits no settings or roles', async () => {
    fakeApi(routes('admin'))
    await renderWithProviders(<MembersScreen />)
    expect(await screen.findByRole('button', { name: 'Remover Caio' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remover Bia' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tornar Caio admin' })).toBeNull()
    expect(screen.queryByLabelText('Nome do bolão')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gerar novo código' })).toBeNull()
    expect(screen.getByText('FIRMA234')).toBeTruthy()
  })
})

describe('MembersScreen as participant', () => {
  it('sees the members without invite or actions, and can leave', async () => {
    const calls = fakeApi(routes('participant', [{ method: 'POST', path: /^\/boloes\/b-2\/leave$/, body: { status: 'removed' } }]))
    await renderWithProviders(<MembersScreen />)
    expect(await screen.findByText('Caio')).toBeTruthy()
    expect(screen.queryByText('Código do bolão')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remover Caio' })).toBeNull()
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair do bolão' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar saída' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/leave'))).toBe(true))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/meus-boloes'))
  })
})
