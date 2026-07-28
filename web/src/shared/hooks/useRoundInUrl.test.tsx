import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { useRoundInUrl } from './useRoundInUrl'

function Probe({ rounds, activeRound }: { rounds: number[]; activeRound?: number }) {
  const [round, setRound] = useRoundInUrl(rounds, activeRound)
  const [searchParams] = useSearchParams()
  return (
    <>
      <span data-testid="round">{round}</span>
      <span data-testid="param">{searchParams.get('rodada') ?? ''}</span>
      <span data-testid="aba">{searchParams.get('aba') ?? ''}</span>
      <button onClick={() => setRound(1)}>go to round 1</button>
    </>
  )
}

function renderAt(path: string, rounds: number[], activeRound?: number) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe rounds={rounds} activeRound={activeRound} />
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

  it('sem ?rodada, seleciona a rodada ativa em vez da última', () => {
    renderAt('/palpites', [1, 2, 3, 4], 2)
    expect(screen.getByTestId('round').textContent).toBe('2')
  })

  it('escreve a rodada ativa na URL', async () => {
    renderAt('/parciais', [1, 2, 3, 4], 2)
    await waitFor(() =>
      expect(screen.getByTestId('param').textContent).toBe('2')
    )
  })

  it('a rodada da URL tem precedência sobre a ativa', () => {
    renderAt('/palpites?rodada=4', [1, 2, 3, 4], 2)
    expect(screen.getByTestId('round').textContent).toBe('4')
  })

  it('cai na última rodada enquanto a rodada ativa não chegou', () => {
    renderAt('/palpites', [1, 2, 3], undefined)
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('ignora uma rodada ativa que não existe na lista', () => {
    renderAt('/palpites', [1, 2, 3], 9)
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('seleciona a rodada ativa mesmo sendo a última', () => {
    renderAt('/palpites', [1, 2, 3], 3)
    expect(screen.getByTestId('round').textContent).toBe('3')
  })

  it('keeps sibling params when correcting the round in the URL', async () => {
    renderAt('/rodada?aba=galera', [1, 2, 3])
    await waitFor(() =>
      expect(screen.getByTestId('param').textContent).toBe('3')
    )
    expect(screen.getByTestId('aba').textContent).toBe('galera')
  })

  it('keeps sibling params when changing round', async () => {
    renderAt('/rodada?rodada=3&aba=galera', [1, 2, 3])
    fireEvent.click(screen.getByText('go to round 1'))
    await waitFor(() =>
      expect(screen.getByTestId('param').textContent).toBe('1')
    )
    expect(screen.getByTestId('aba').textContent).toBe('galera')
  })
})
