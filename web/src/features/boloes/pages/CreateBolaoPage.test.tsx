import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { CreateBolaoPage } from './CreateBolaoPage'

const RULES = {
  match: [
    { key: 'correct_result', points: 9, text: 'Acertar o vencedor, ou o empate com o placar exato' },
    { key: 'correct_draw', points: 12, text: 'Acertar que vai dar empate, sem acertar o placar' },
  ],
  round: [{ key: 'round_total_goals', points: 10, text: 'Acertar o total de gols da rodada inteira' }],
  exact_score_variety_bonus: [{ score_types: 2, points: 10, text: '2 placares exatos diferentes na rodada' }],
  notes: ['Quem não palpitar um jogo fica com 0 x 0 nele quando o jogo começa.'],
}

let requests: { url: string; method: string; body?: string }[] = []

beforeEach(() => {
  requests = []
  localStorage.setItem('token', 't')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
      const body = (() => {
        if (url.endsWith('/competitions')) return [{ id: 'c-bsa', name: 'Brasileirão Série A 2026', provider_code: 'BSA', season: 2026 }]
        if (url.endsWith('/rules')) return RULES
        if (url.endsWith('/me/boloes') && init?.method === 'POST') return { id: 'b-new', name: 'Firma' }
        if (url.endsWith('/me/boloes')) return []
        return {}
      })()
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    })
  )
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

function Landing() {
  const { pathname, search } = useLocation()
  return <p>{`em ${pathname}${search}`}</p>
}

function renderWizard() {
  renderWithProviders(
    <Routes>
      <Route path="/criar-bolao" element={<CreateBolaoPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { route: '/criar-bolao' }
  )
}

describe('CreateBolaoPage', () => {
  it('asks for a name of at least 3 characters', async () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('Nome do bolão'), { target: { value: 'ab' } })
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('explains the rules before creating and then opens the new bolão', async () => {
    renderWizard()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Brasileirão Série A 2026' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Nome do bolão'), { target: { value: 'Firma' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    fireEvent.click(screen.getByLabelText(/Público/))
    fireEvent.click(screen.getByLabelText(/Aprovar quem pede para entrar/))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(screen.getByText('Acertar que vai dar empate, sem acertar o placar')).toBeTruthy())
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Quem não palpitar um jogo fica com 0 x 0 nele quando o jogo começa.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Criar bolão' }))

    await waitFor(() => expect(screen.getByText('em /?bolao=b-new')).toBeTruthy())
    const create = requests.find((r) => r.method === 'POST' && r.url.endsWith('/me/boloes'))
    expect(JSON.parse(create!.body!)).toEqual({ name: 'Firma', competition_id: 'c-bsa' })
    const settings = requests.find((r) => r.method === 'PATCH' && r.url.endsWith('/boloes/b-new'))
    expect(JSON.parse(settings!.body!)).toEqual({ name: 'Firma', visibility: 'public', requires_approval: false })
  })
})
