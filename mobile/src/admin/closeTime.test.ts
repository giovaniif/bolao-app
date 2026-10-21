import { formatCloseTime, parseCloseTime } from './closeTime'

describe('parseCloseTime', () => {
  it('reads day, month, hour and minute in local time', () => {
    expect(parseCloseTime('25/10 16:30', 2026)?.getTime()).toBe(new Date(2026, 9, 25, 16, 30).getTime())
  })

  it('accepts single-digit day, month and hour', () => {
    expect(parseCloseTime('5/3 9:05', 2026)?.getTime()).toBe(new Date(2026, 2, 5, 9, 5).getTime())
  })

  it.each(['', '25/10', '25-10 16:30', '32/10 16:30', '25/13 16:30', '25/10 24:00', '25/10 16:60', '31/02 10:00'])('rejects %p', (text) => {
    expect(parseCloseTime(text, 2026)).toBeNull()
  })
})

describe('formatCloseTime', () => {
  it('writes the time back in the same shape', () => {
    expect(formatCloseTime(new Date(2026, 2, 5, 9, 5))).toBe('05/03 09:05')
  })
})
