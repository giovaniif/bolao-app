import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../../App'

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/privacidade')
})

describe('PrivacyPage', () => {
  it('opens at /privacidade without a login', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacidade e termos de uso' })).toBeTruthy()
  })

  it('lists the data that the app collects', () => {
    render(<App />)
    for (const item of ['Usuário', 'Nome de exibição', 'E-mail', 'Time do coração', 'Palpites', 'Notificações', 'Sentry', 'PostHog']) {
      expect(screen.getAllByText(new RegExp(item)).length).toBeGreaterThan(0)
    }
  })

  it('explains how to delete the account', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Como excluir sua conta' })).toBeTruthy()
    expect(screen.getAllByText(/Excluir minha conta/).length).toBeGreaterThan(0)
  })

  it('says that the app takes no money and has no prizes', () => {
    render(<App />)
    expect(screen.getByText(/não recebe, não processa e não paga dinheiro/)).toBeTruthy()
  })
})
