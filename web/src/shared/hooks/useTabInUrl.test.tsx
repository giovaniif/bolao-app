import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { useTabInUrl } from './useTabInUrl'

const TABS = ['parciais', 'galera'] as const
type Tab = (typeof TABS)[number]

function Probe() {
  const [tab, setTab] = useTabInUrl<Tab>('aba', TABS, 'parciais')
  const [searchParams] = useSearchParams()
  return (
    <>
      <span data-testid="tab">{tab}</span>
      <span data-testid="param">{searchParams.get('aba') ?? ''}</span>
      <span data-testid="round">{searchParams.get('rodada') ?? ''}</span>
      <button onClick={() => setTab('galera')}>Galera</button>
    </>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>
  )
}

describe('useTabInUrl', () => {
  it('falls back when the param is missing', () => {
    renderAt('/rodada')
    expect(screen.getByTestId('tab').textContent).toBe('parciais')
  })

  // The round is the only hook that corrects the URL on mount; a second writer in the
  // same tick would clobber it.
  it('does not write the fallback into the URL', async () => {
    renderAt('/rodada')
    await waitFor(() => expect(screen.getByTestId('param').textContent).toBe(''))
  })

  it('honours a valid value from the URL', () => {
    renderAt('/rodada?aba=galera')
    expect(screen.getByTestId('tab').textContent).toBe('galera')
  })

  it('falls back on an unknown value', () => {
    renderAt('/rodada?aba=xyz')
    expect(screen.getByTestId('tab').textContent).toBe('parciais')
  })

  it('writes the chosen tab and keeps sibling params', async () => {
    renderAt('/rodada?rodada=7')
    fireEvent.click(screen.getByText('Galera'))

    await waitFor(() =>
      expect(screen.getByTestId('param').textContent).toBe('galera')
    )
    expect(screen.getByTestId('round').textContent).toBe('7')
  })
})
