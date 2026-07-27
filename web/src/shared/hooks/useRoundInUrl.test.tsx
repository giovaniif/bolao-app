import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { useRoundInUrl } from './useRoundInUrl'

function Probe({ rounds }: { rounds: number[] }) {
  const [round] = useRoundInUrl(rounds)
  const [searchParams] = useSearchParams()
  return (
    <>
      <span data-testid="round">{round}</span>
      <span data-testid="param">{searchParams.get('rodada') ?? ''}</span>
    </>
  )
}

function renderAt(path: string, rounds: number[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe rounds={rounds} />
    </MemoryRouter>
  )
}

describe('useRoundInUrl', () => {
  it('sem ?rodada, seleciona a rodada mais recente', () => {
    renderAt('/palpites', [1, 2, 3])
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('escreve a rodada mais recente na URL', async () => {
    renderAt('/parciais', [1, 2, 3])
    await waitFor(() =>
      expect(screen.getByTestId('param').textContent).toBe('3')
    )
  })

  it('respeita uma rodada válida vinda da URL', () => {
    renderAt('/palpites?rodada=2', [1, 2, 3])
    expect(screen.getByTestId('round').textContent).toBe('2')
  })

  it('cai na rodada mais recente quando a da URL não existe', () => {
    renderAt('/palpites?rodada=9', [1, 2, 3])
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('usa a maior rodada mesmo se a lista vier fora de ordem', () => {
    renderAt('/palpites', [3, 1, 2])
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('retorna 0 enquanto as rodadas não carregaram', () => {
    renderAt('/palpites', [])
    expect(screen.getByTestId('round').textContent).toBe('0')
  })
})
