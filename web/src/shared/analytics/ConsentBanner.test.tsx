import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsentBanner } from './ConsentBanner'

describe('ConsentBanner', () => {
  it('asks once and reports the choice', () => {
    const onChoose = vi.fn()
    render(<ConsentBanner visible onChoose={onChoose} />)
    expect(screen.getByText(/dados de uso/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))
    expect(onChoose).toHaveBeenCalledWith('granted')
  })

  it('lets the user refuse', () => {
    const onChoose = vi.fn()
    render(<ConsentBanner visible onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }))
    expect(onChoose).toHaveBeenCalledWith('denied')
  })

  it('shows nothing when there is nothing to ask', () => {
    const { container } = render(<ConsentBanner visible={false} onChoose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
