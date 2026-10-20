import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedBadge } from './FeedBadge'
import type { Match } from '../api/adminApi'

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    round: 32,
    home_team: 'Flamengo',
    away_team: 'Palmeiras',
    locked: false,
    ...overrides,
  }
}

describe('FeedBadge', () => {
  it('shows nothing for a match the admin entered', () => {
    const { container } = render(<FeedBadge match={match()} onUnlock={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('marks a match that comes from the feed', () => {
    render(<FeedBadge match={match({ provider_match_id: 554740 })} onUnlock={vi.fn()} />)
    expect(screen.getByText('Automático')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Voltar ao automático' })).toBeNull()
  })

  it('offers to hand a corrected match back to the feed', () => {
    const onUnlock = vi.fn()
    render(<FeedBadge match={match({ provider_match_id: 554740, locked: true })} onUnlock={onUnlock} />)

    expect(screen.getByText('Corrigido')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao automático' }))
    expect(onUnlock).toHaveBeenCalledWith('m1')
  })

  it('disables the unlock while it runs', () => {
    render(<FeedBadge match={match({ provider_match_id: 1, locked: true })} onUnlock={vi.fn()} isUnlocking />)
    expect((screen.getByRole('button', { name: 'Voltar ao automático' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
