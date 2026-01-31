import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Clique</Button>)
    const btn = screen.getByRole('button', { name: 'Clique' })
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('Clique')
  })

  it('applies variant styles', () => {
    render(<Button variant="secondary">Sec</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-[var(--color-card)]')
  })
})
