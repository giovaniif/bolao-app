import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { scrubEvent } from './scrub'

describe('scrubEvent', () => {
  it('keeps the user id and drops tokens, cookies and personal data', () => {
    const event = {
      request: { url: 'https://bolao/login', headers: { Authorization: 'Bearer jwt', 'User-Agent': 'x' }, cookies: { s: '1' }, data: '{"password":"123"}' },
      user: { id: 'u-1', email: 'ana@example.com', username: 'ana', ip_address: '1.2.3.4' },
      message: 'erro para ana@example.com',
      breadcrumbs: [{ message: 'login ana@example.com' }],
    } as unknown as ErrorEvent

    const got = scrubEvent(event)

    expect(got.request?.headers).toEqual({ 'User-Agent': 'x' })
    expect(got.request?.cookies).toBeUndefined()
    expect(got.request?.data).toBeUndefined()
    expect(got.user).toEqual({ id: 'u-1' })
    expect(got.message).toBe('erro para [email]')
    expect(got.breadcrumbs?.[0].message).toBe('login [email]')
  })
})
