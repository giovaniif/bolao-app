import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { useSearchParams } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'
import { useCurrentBolao } from './useCurrentBolao'

const MINE = [
  { id: 'b-old', name: 'Antigo', status: 'finished', role: 'participant', member_status: 'active', member_count: 9 },
  { id: 'b-main', name: 'Brasileirão 2026', status: 'active', role: 'participant', member_status: 'active', member_count: 20 },
  { id: 'b-firma', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 5 },
  { id: 'b-wait', name: 'Espera', status: 'active', role: 'participant', member_status: 'pending', member_count: 3 },
]

function Probe() {
  const { bolaoId, bolao, isLoading, select } = useCurrentBolao()
  const [params] = useSearchParams()
  return (
    <>
      <span data-testid="id">{isLoading ? 'loading' : bolaoId ?? 'none'}</span>
      <span data-testid="name">{bolao?.name ?? ''}</span>
      <span data-testid="param">{params.get('bolao') ?? ''}</span>
      <button onClick={() => select('b-firma')}>escolher firma</button>
    </>
  )
}

function stubMine(list: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(list) }))
  )
}

beforeEach(() => {
  localStorage.setItem('token', 't')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('useCurrentBolao', () => {
  it('uses the first active bolão where the user plays', async () => {
    stubMine(MINE)
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b-main'))
    expect(screen.getByTestId('name').textContent).toBe('Brasileirão 2026')
  })

  it('uses the bolão in the URL', async () => {
    stubMine(MINE)
    renderWithProviders(<Probe />, { route: '/?bolao=b-firma' })
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b-firma'))
  })

  it('remembers a bolão that came in the URL', async () => {
    stubMine(MINE)
    renderWithProviders(<Probe />, { route: '/?bolao=b-firma' })
    await waitFor(() => expect(localStorage.getItem('bolao')).toBe('b-firma'))
  })

  it('ignores a bolão in the URL where the user does not play', async () => {
    stubMine(MINE)
    renderWithProviders(<Probe />, { route: '/?bolao=b-wait' })
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b-main'))
  })

  it('remembers the last choice on this device', async () => {
    stubMine(MINE)
    localStorage.setItem('bolao', 'b-firma')
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b-firma'))
  })

  it('selecting a bolão writes it to the URL and remembers it', async () => {
    stubMine(MINE)
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b-main'))
    fireEvent.click(screen.getByText('escolher firma'))
    await waitFor(() => expect(screen.getByTestId('param').textContent).toBe('b-firma'))
    expect(screen.getByTestId('id').textContent).toBe('b-firma')
    expect(localStorage.getItem('bolao')).toBe('b-firma')
  })

  it('has no bolão when the user plays in none', async () => {
    stubMine([])
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('none'))
  })
})
