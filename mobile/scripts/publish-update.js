const { spawnSync } = require('node:child_process')

function resolveProfile(easJson, name, seen = []) {
  const profile = easJson.build?.[name]
  if (!profile) throw new Error(`Unknown build profile "${name}"`)
  if (seen.includes(name)) throw new Error(`Build profile "${name}" extends itself`)
  if (!profile.extends) return profile
  const base = resolveProfile(easJson, profile.extends, [...seen, name])
  return { ...base, ...profile, env: { ...base.env, ...profile.env } }
}

function buildEnvironment(profile) {
  if (profile.environment) return profile.environment
  if (profile.developmentClient) return 'development'
  if (profile.distribution === 'internal') return 'preview'
  return 'production'
}

function updateCommand(easJson, profileName, message) {
  if (!message) throw new Error('An update needs a message')
  const profile = resolveProfile(easJson, profileName)
  if (!profile.channel) throw new Error(`Build profile "${profileName}" has no channel`)
  return {
    args: [
      'update',
      '--channel', profile.channel,
      '--environment', buildEnvironment(profile),
      '--message', message,
      '--non-interactive',
    ],
    env: { ...profile.env },
  }
}

function main([profileName, message]) {
  const easJson = require('../eas.json')
  const { args, env } = updateCommand(easJson, profileName, message)
  const result = spawnSync('npx', ['--yes', 'eas-cli@latest', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  process.exit(result.status ?? 1)
}

if (require.main === module) main(process.argv.slice(2))

module.exports = { updateCommand }
