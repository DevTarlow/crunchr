import { describe, expect, it } from 'vitest'
import { formatBytes, formatElapsedMs, formatHz, formatMs, formatPercent } from './format'

describe('display formatting', () => {
  it('formats byte sizes compactly for buttons and toasts', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-10)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(9.5 * 1024)).toBe('9.5 KB')
    expect(formatBytes(10 * 1024)).toBe('10 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(5.25 * 1024 * 1024)).toBe('5.3 MB')
  })

  it('keeps the existing readout formatting stable', () => {
    expect(formatHz(380)).toBe('380 Hz')
    expect(formatHz(2300)).toBe('2.3 kHz')
    expect(formatHz(1200)).toBe('1.2 kHz')
    expect(formatMs(46.4)).toBe('46 ms')
    expect(formatPercent(92.5)).toBe('93%')
    expect(formatElapsedMs(2.34)).toBe('2.3 ms')
    expect(formatElapsedMs(46.2)).toBe('46 ms')
  })
})
