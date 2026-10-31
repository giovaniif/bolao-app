import { createAutoSaver, type SaveStatus } from './autoSave'

function setup(save: jest.Mock) {
  const statuses: Record<string, SaveStatus> = {}
  const saver = createAutoSaver({ save, onStatus: (id, s) => { statuses[id] = s }, retryDelays: [100, 200] })
  return { saver, statuses }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('createAutoSaver', () => {
  it('skips a match whose score did not change', async () => {
    const save = jest.fn().mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    saver.setBaseline('m-1', { home: 1, away: 0 })
    saver.leave('m-1', { home: 1, away: 0 }, false)
    await flush()
    expect(save).not.toHaveBeenCalled()
    expect(statuses['m-1']).toBeUndefined()
  })

  it('saves a changed score once and then treats it as saved', async () => {
    const save = jest.fn().mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    saver.leave('m-1', { home: 2, away: 1 }, false)
    expect(statuses['m-1']).toBe('saving')
    await flush()
    expect(save).toHaveBeenCalledWith('m-1', { home: 2, away: 1 })
    expect(statuses['m-1']).toBe('saved')
    saver.leave('m-1', { home: 2, away: 1 }, false)
    await flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('never saves a locked match', async () => {
    const save = jest.fn().mockResolvedValue(undefined)
    const { saver } = setup(save)
    saver.leave('m-1', { home: 3, away: 3 }, true)
    await flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('retries a failed save and reports the error until it works', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const { saver, statuses } = setup(save)
    saver.leave('m-1', { home: 1, away: 1 }, false)
    await flush()
    expect(statuses['m-1']).toBe('error')
    jest.advanceTimersByTime(100)
    await flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(statuses['m-1']).toBe('saved')
  })

  it('saves the latest score when the user changes it during a save', async () => {
    let resolve: () => void = () => {}
    const save = jest.fn().mockImplementationOnce(() => new Promise<void>((r) => { resolve = r })).mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    saver.leave('m-1', { home: 1, away: 0 }, false)
    saver.leave('m-1', { home: 2, away: 0 }, false)
    resolve()
    await flush()
    await flush()
    expect(save).toHaveBeenLastCalledWith('m-1', { home: 2, away: 0 })
    expect(statuses['m-1']).toBe('saved')
  })
})
