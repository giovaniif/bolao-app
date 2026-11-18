import easJson from '../eas.json'
import { updateCommand } from './publish-update'

type Profile = { channel?: string; env?: Record<string, string> }

const API = {
  production: easJson.build.production.env.EXPO_PUBLIC_API_URL,
  dev: easJson.build.preview.env.EXPO_PUBLIC_API_URL,
}

describe('publish-update', () => {
  it('gives each build profile the channel of the API it talks to', () => {
    const channels = Object.fromEntries(Object.entries(easJson.build as Record<string, Profile>).map(([name, profile]) => [name, profile.channel]))
    expect(channels).toEqual({
      development: 'development',
      preview: 'preview',
      production: 'production',
      'testflight-dev': 'preview',
      'play-internal': 'preview',
      'android-apk-prod': 'production',
    })
  })

  it('publishes the same update for every profile on a channel', () => {
    const byChannel: Record<string, { environment: string; api: string | undefined }[]> = {}
    for (const name of Object.keys(easJson.build)) {
      const { args, env } = updateCommand(easJson, name, 'm')
      const channel = args[2]
      byChannel[channel] = byChannel[channel] ?? []
      byChannel[channel].push({ environment: args[4], api: env.EXPO_PUBLIC_API_URL })
    }
    for (const builds of Object.values(byChannel)) {
      for (const build of builds) expect(build).toEqual(builds[0])
    }
  })

  it('publishes production updates against the production API, like the production build', () => {
    const { args, env } = updateCommand(easJson, 'production', 'v2026.11_3.0.6')
    expect(args).toEqual([
      'update',
      '--channel', 'production',
      '--environment', 'production',
      '--message', 'v2026.11_3.0.6',
      '--non-interactive',
    ])
    expect(env.EXPO_PUBLIC_API_URL).toBe(API.production)
  })

  it('takes the env and environment of the extending profile over the base profile', () => {
    const { args, env } = updateCommand(easJson, 'testflight-dev', 'try it')
    expect(args.slice(0, 5)).toEqual(['update', '--channel', 'preview', '--environment', 'preview'])
    expect(env.EXPO_PUBLIC_API_URL).toBe(API.dev)
  })

  it('uses the EAS environment that a build of the profile uses', () => {
    expect(updateCommand(easJson, 'development', 'm').args[4]).toBe('development')
    expect(updateCommand(easJson, 'preview', 'm').args[4]).toBe('preview')
    expect(updateCommand(easJson, 'android-apk-prod', 'm').args[4]).toBe('production')
  })

  it('rejects a profile that eas.json does not define', () => {
    expect(() => updateCommand(easJson, 'staging', 'm')).toThrow('Unknown build profile "staging"')
  })

  it('rejects an update without a message', () => {
    expect(() => updateCommand(easJson, 'production', '')).toThrow('An update needs a message')
  })
})
