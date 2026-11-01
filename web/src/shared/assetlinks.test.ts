import { describe, expect, it } from 'vitest'
import links from '../../public/.well-known/assetlinks.json'

describe('assetlinks.json', () => {
  it('lets the Android app open bolao.giovani.app links with its signing key', () => {
    expect(links[0].target).toEqual(
      expect.objectContaining({ namespace: 'android_app', package_name: 'com.giovaniif.bolao' })
    )
    expect(links[0].relation).toContain('delegate_permission/common.handle_all_urls')
    expect(links[0].target.sha256_cert_fingerprints).toContain(
      '72:B2:18:AD:2E:2C:A4:FB:B5:7D:1A:DA:85:09:1B:6C:EC:6A:F9:B8:50:17:86:44:1F:C4:50:EF:12:B8:7B:AF'
    )
  })
})
