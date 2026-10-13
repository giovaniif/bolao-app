import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../shared/hooks/AuthProvider'

interface Options {
  route?: string
  router?: boolean
}

export function renderWithProviders(ui: ReactElement, { route = '/', router = true }: Options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const withAuth = (children: ReactNode) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )

  return render(
    router ? <MemoryRouter initialEntries={[route]}>{withAuth(ui)}</MemoryRouter> : withAuth(ui)
  )
}
