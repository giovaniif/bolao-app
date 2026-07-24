import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Podium } from './Podium'
import type { UserWithStats } from '../../classification/api/classificationApi'

function user(overrides: Partial<UserWithStats> & { id: string }): UserWithStats {
  return {
    username: overrides.id,
    display_name: overrides.id,
    is_admin: false,
    amount_paid: 0,
    total_points: 0,
    exact_scores: 0,
    correct_results: 0,
    rounds_won: 0,
    ...overrides,
  }
}

const maria = user({ id: 'maria', display_name: 'Maria Silva', total_points: 1240, favorite_team: 'Flamengo' })
const joao = user({ id: 'joao', display_name: 'João Souza', total_points: 1180 })
const ana = user({ id: 'ana', display_name: 'Ana Lima', total_points: 1090 })

describe('Podium', () => {
  it('renders the three places with the champion highlighted', () => {
    render(<Podium top={[maria, joao, ana]} />)

    expect(screen.getByText('Maria Silva')).toBeTruthy()
    expect(screen.getByText('João Souza')).toBeTruthy()
    expect(screen.getByText('Ana Lima')).toBeTruthy()

    expect(screen.getByText('1º')).toBeTruthy()
    expect(screen.getByText('2º')).toBeTruthy()
    expect(screen.getByText('3º')).toBeTruthy()

    expect(screen.getByText('Campeão')).toBeTruthy()
    expect(screen.getByText('Flamengo')).toBeTruthy()

    expect(screen.getByText('1240')).toBeTruthy()
    expect(screen.getByText('1180')).toBeTruthy()
    expect(screen.getByText('1090')).toBeTruthy()
  })

  it('omits missing places when there are fewer than three participants', () => {
    render(<Podium top={[maria, joao]} />)

    expect(screen.getByText('1º')).toBeTruthy()
    expect(screen.getByText('2º')).toBeTruthy()
    expect(screen.queryByText('3º')).toBeNull()
  })

  it('renders only the champion for a single participant', () => {
    render(<Podium top={[maria]} />)

    expect(screen.getByText('Maria Silva')).toBeTruthy()
    expect(screen.queryByText('2º')).toBeNull()
    expect(screen.queryByText('3º')).toBeNull()
  })

  it('renders nothing when there is no ranking', () => {
    const { container } = render(<Podium top={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('warns about a tie for first place only when asked', () => {
    const { unmount } = render(<Podium top={[maria, joao, ana]} />)
    expect(screen.queryByText(/Empate na liderança/)).toBeNull()
    unmount()

    render(<Podium top={[maria, joao, ana]} tiedForFirst />)
    expect(screen.getByText(/Empate na liderança/)).toBeTruthy()
  })
})
