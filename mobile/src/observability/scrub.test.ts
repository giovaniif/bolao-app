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

  it('hides bearer tokens and JWTs in messages, breadcrumbs and exceptions', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiMSJ9.c2lnbmF0dXJl'
    const got = scrubEvent({
      type: undefined,
      message: 'call failed with Bearer abc.def-123',
      breadcrumbs: [{ message: `token ${jwt}` }],
      exception: { values: [{ value: `bad ${jwt}` }] },
    })
    expect(got.message).toBe('call failed with Bearer [token]')
    expect(got.breadcrumbs?.[0].message).toBe('token [token]')
    expect(got.exception?.values?.[0].value).toBe('bad [token]')
  })
})
