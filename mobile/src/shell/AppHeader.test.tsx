import { act, fireEvent, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { router } from '../test/routerMock'
import { bottomSheetCalls } from '../test/bottomSheetMock'
import { AppHeader } from './AppHeader'

jest.mock('expo-router', () => jest.requireActual('../test/routerMock').routerModule())
jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('../test/bottomSheetMock').bottomSheetModule())

const MINE = [
  { id: 'b-1', name: 'Bolão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
  { id: 'b-2', name: 'Bolão da Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 7 },
]

beforeEach(async () => {
  jest.clearAllMocks()
  await SecureStore.setItemAsync('token', 'jwt')
  await SecureStore.setItemAsync('user', JSON.stringify({ id: 'u-1', username: 'ana', isAdmin: false }))
  await SecureStore.deleteItemAsync('bolao')
})

describe('AppHeader', () => {
  it('shows the brand, the page title and the current bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    expect(screen.getByText('Bolão')).toBeTruthy()
    expect(screen.getByText('Palpites')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Trocar bolão: Bolão 2026' })).toBeTruthy()
  })

  it('switches to another bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Trocar bolão: Bolão 2026' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Bolão da Firma' }))
    expect(await screen.findByRole('button', { name: 'Trocar bolão: Bolão da Firma' })).toBeTruthy()
  })

  it('hides the switcher with only one bolão', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: [MINE[0]] }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    expect(await screen.findByText('AS')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Trocar bolão/ })).toBeNull()
  })

  it('opens Meus bolões from the profile menu', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Meus bolões' }))
    expect(router.push).toHaveBeenCalledWith('/meus-boloes')
  })

  it('leaves the Hall dos Campeões out of the profile menu', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    expect(screen.getByRole('menuitem', { name: 'Perfil' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Hall dos Campeões' })).toBeNull()
  })

  it('signs out from the profile menu', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Sair' }))
    expect(router.replace).toHaveBeenCalledWith('/login')
    expect(await SecureStore.getItemAsync('token')).toBeNull()
  })
})

describe('AppHeader profile menu', () => {
  it('opens Perfil', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Perfil' }))
    expect(router.push).toHaveBeenCalledWith('/perfil')
  })
})

describe('AppHeader admin entry', () => {
  it('shows Admin with the pending results to a platform admin', async () => {
    await SecureStore.setItemAsync('user', JSON.stringify({ id: 'u-1', username: 'ana', isAdmin: true }))
    fakeApi([
      { path: /^\/me\/boloes$/, body: MINE },
      { path: /^\/me$/, body: { display_name: 'Ana Souza' } },
      { path: /^\/boloes\/b-1\/matches\/rounds\/summary$/, body: { rounds: [7], active: 7, pending_results: 3 } },
    ])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    expect(await screen.findByText('3')).toBeTruthy()
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Admin' }))
    expect(router.push).toHaveBeenCalledWith('/admin')
  })

  it('hides Admin from other users', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).toBeNull()
  })
})

describe('AppHeader profile sheet', () => {
  it('opens the profile actions in a bottom sheet with the user name', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    expect(screen.getByTestId('profile-sheet')).toBeTruthy()
    expect(bottomSheetCalls.present).toBeGreaterThan(0)
    expect(screen.getByRole('header', { name: 'Ana Souza' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeTruthy()
  })

  it('closes the sheet when the backdrop is tapped', async () => {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
    await renderWithProviders(<AppHeader title="Palpites" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    await fireEvent.press(screen.getByLabelText('Fechar menu'))
    expect(screen.queryByTestId('profile-sheet')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Sair' })).toBeNull()
  })
})

describe('AppHeader profile sheet lifecycle', () => {
  function routes() {
    fakeApi([{ path: /^\/me\/boloes$/, body: MINE }, { path: /^\/me$/, body: { display_name: 'Ana Souza' } }])
  }

  async function openSheet() {
    await fireEvent.press(await screen.findByRole('button', { name: 'Meu perfil' }))
    expect(await screen.findByTestId('profile-sheet')).toBeTruthy()
  }

  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it('lists Perfil first', async () => {
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    await openSheet()
    expect(screen.getAllByRole('menuitem')[0].props.accessibilityLabel).toBe('Perfil')
  })

  it('opens again after closing from the backdrop, three times', async () => {
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    for (let i = 0; i < 3; i++) {
      await openSheet()
      await fireEvent.press(screen.getByLabelText('Fechar menu'))
      await settle()
      expect(screen.queryByTestId('profile-sheet')).toBeNull()
    }
  })

  it('opens again after a pan down closes it, three times', async () => {
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    for (let i = 0; i < 3; i++) {
      await openSheet()
      await act(async () => bottomSheetCalls.panDown())
      await settle()
      expect(screen.queryByTestId('profile-sheet')).toBeNull()
    }
  })

  it('opens again after a pan down that only reports index -1, three times', async () => {
    bottomSheetCalls.firesOnDismiss = false
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    for (let i = 0; i < 3; i++) {
      await openSheet()
      await act(async () => bottomSheetCalls.panDown())
      await settle()
      expect(screen.queryByTestId('profile-sheet')).toBeNull()
    }
    bottomSheetCalls.firesOnDismiss = true
  })

  it('opens again after an item closes it, three times', async () => {
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    for (let i = 0; i < 3; i++) {
      await openSheet()
      await fireEvent.press(screen.getByRole('menuitem', { name: 'Meus bolões' }))
      await settle()
      expect(screen.queryByTestId('profile-sheet')).toBeNull()
    }
  })

  it('opens again after Android back closes it, three times', async () => {
    const handlers: (() => boolean | null | undefined)[] = []
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler as () => boolean)
      return { remove: () => handlers.splice(handlers.indexOf(handler as () => boolean), 1) }
    })
    routes()
    await renderWithProviders(<AppHeader title="Palpites" />)
    for (let i = 0; i < 3; i++) {
      await openSheet()
      await act(async () => {
        handlers[handlers.length - 1]()
      })
      await settle()
      expect(screen.queryByTestId('profile-sheet')).toBeNull()
    }
    spy.mockRestore()
  })
})

