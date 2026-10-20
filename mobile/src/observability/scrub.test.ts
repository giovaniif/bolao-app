import type { ErrorEvent } from '@sentry/react-native'
import { scrubEvent } from './scrub'

describe('scrubEvent', () => {
  it('keeps the user id and drops tokens and personal data', () => {
    const event = {
      request: { url: 'https://api/auth/login', headers: { Authorization: 'Bearer jwt', Accept: 'json' }, data: '{"password":"123"}' },
      user: { id: 'u-1', email: 'ana@example.com', username: 'ana', ip_address: '1.2.3.4' },
      message: 'erro para ana@example.com',
      breadcrumbs: [{ message: 'POST ana@example.com' }],
    } as unknown as ErrorEvent

    const got = scrubEvent(event)

    expect(got.request?.headers).toEqual({ Accept: 'json' })
    expect(got.request?.data).toBeUndefined()
    expect(got.user).toEqual({ id: 'u-1' })
    expect(got.message).toBe('erro para [email]')
    expect(got.breadcrumbs?.[0].message).toBe('POST [email]')
  })
})
