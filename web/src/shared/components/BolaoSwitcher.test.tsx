import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BolaoSwitcher } from './BolaoSwitcher'
import type { MyBolao } from '../api/myBoloesApi'

function bolao(overrides: Partial<MyBolao>): MyBolao {
  return { id: 'b', name: 'Bolão', status: 'active', role: 'participant', member_status: 'active', member_count: 10, ...overrides }
}

const BOLOES = [
  bolao({ id: 'b-main', name: 'Brasileirão 2026', member_count: 20 }),
  bolao({ id: 'b-firma', name: 'Firma', role: 'owner', member_count: 5 }),
  bolao({ id: 'b-wait', name: 'Espera', member_status: 'pending' }),
]

describe('BolaoSwitcher', () => {
  it('shows nothing when the user plays in one bolão', () => {
    const { container } = render(<BolaoSwitcher boloes={BOLOES.slice(0, 1)} current={BOLOES[0]} onSelect={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('lists the bolões where the user plays and selects one', () => {
    const onSelect = vi.fn()
    render(<BolaoSwitcher boloes={BOLOES} current={BOLOES[0]} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Brasileirão 2026/ }))
    expect(screen.queryByText('Espera')).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /Firma/ }))

    expect(onSelect).toHaveBeenCalledWith('b-firma')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('marks the bolão in use', () => {
    render(<BolaoSwitcher boloes={BOLOES} current={BOLOES[1]} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Firma/ }))
    expect(screen.getByRole('menuitem', { name: /Firma/ }).getAttribute('aria-current')).toBe('true')
  })
})
