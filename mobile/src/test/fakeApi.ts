export type Route = { method?: string; path: RegExp; body: unknown; status?: number }

export function fakeApi(routes: Route[]) {
  const calls: { method: string; path: string; body?: string }[] = []
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = new URL(url).pathname.replace(/^\/api/, '') + new URL(url).search
    calls.push({ method, path, body: init?.body as string | undefined })
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.path.test(path))
    const status = route?.status ?? (route ? 200 : 404)
    const body = route ? route.body : { error: `sem mock: ${method} ${path}` }
    return { ok: status < 400, status, text: async () => JSON.stringify(body) }
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return calls
}
