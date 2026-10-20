import { describe, it, expect } from 'vitest'
import aasaText from '../../public/.well-known/apple-app-site-association?raw'
import vercelText from '../../vercel.json?raw'

describe('apple-app-site-association', () => {
  it('lets the iOS app open invite links', () => {
    const details = JSON.parse(aasaText).applinks.details
    expect(details).toHaveLength(1)
    expect(details[0].appIDs).toEqual(['827UMZ89C2.com.giovaniif.bolao'])
    expect(details[0].components).toEqual([{ '/': '/convite/*' }])
  })

  it('is served as JSON', () => {
    const vercel = JSON.parse(vercelText)
    const rule = vercel.headers.find((h: { source: string }) => h.source === '/.well-known/apple-app-site-association')
    expect(rule.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' })
  })
})
