import appConfig from '../../app.config'
import appJson from '../../app.json'

const base = appJson.expo as Parameters<typeof appConfig>[0]['config']

function plugins(iosClientId: string | undefined) {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  if (iosClientId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = iosClientId
  try {
    return appConfig({ config: base, projectRoot: '', staticConfigPath: null, packageJsonPath: null }).plugins ?? []
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = previous
  }
}

describe('app config', () => {
  it('adds the Google sign-in plugin with the reversed iOS client id', () => {
    expect(plugins('123-abc.apps.googleusercontent.com')).toContainEqual([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: 'com.googleusercontent.apps.123-abc' },
    ])
  })

  it('leaves the Google plugin out without an iOS client id, so the build does not fail', () => {
    const names = plugins(undefined).map((p) => (Array.isArray(p) ? p[0] : p))
    expect(names).not.toContain('@react-native-google-signin/google-signin')
    expect(names).toContain('expo-apple-authentication')
  })

  it('turns on Sign in with Apple for iOS', () => {
    expect(appJson.expo.ios.usesAppleSignIn).toBe(true)
  })

  it('points Android at the google-services.json from the EAS file variable', () => {
    const previous = process.env.GOOGLE_SERVICES_JSON
    process.env.GOOGLE_SERVICES_JSON = '/tmp/eas/google-services.json'
    try {
      const config = appConfig({ config: base, projectRoot: '', staticConfigPath: null, packageJsonPath: null })
      expect(config.android?.googleServicesFile).toBe('/tmp/eas/google-services.json')
    } finally {
      if (previous === undefined) delete process.env.GOOGLE_SERVICES_JSON
      else process.env.GOOGLE_SERVICES_JSON = previous
    }
  })
})
