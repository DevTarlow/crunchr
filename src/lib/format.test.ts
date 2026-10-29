import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatElapsedMs,
  formatHz,
  formatInputValue,
  formatMs,
  formatPercent,
  parseInputValue,
} from './format'

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

describe('typed value boxes', () => {
  it('formats values with the precision of each control step', () => {
    expect(formatInputValue(120, 1)).toBe('120')
    expect(formatInputValue(4, 0.1)).toBe('4.0')
    expect(formatInputValue(4.26, 0.1)).toBe('4.3')
    expect(formatInputValue(-0, 1)).toBe('0')
  })

  it('parses plain decimals, including a comma separator', () => {
    expect(parseInputValue('120', 10, 800, 1)).toBe(120)
    expect(parseInputValue(' 120 ', 10, 800, 1)).toBe(120)
    expect(parseInputValue('1,5', 0.5, 24, 0.1)).toBe(1.5)
    expect(parseInputValue('.5', 0.5, 24, 0.1)).toBe(0.5)
    expect(parseInputValue('4.', 0.5, 24, 0.1)).toBe(4)
    expect(parseInputValue('+3', 0, 50, 1)).toBe(3)
  })

  it('clamps and snaps typed values to the control step', () => {
    expect(parseInputValue('5000', 10, 800, 1)).toBe(800)
    expect(parseInputValue('-5', 0, 100, 1)).toBe(0)
    expect(parseInputValue('2.34', 0.5, 24, 0.1)).toBe(2.3)
    expect(parseInputValue('2.35', 0.5, 24, 0.1)).toBe(2.4)
    expect(parseInputValue('125', 0, 600, 20)).toBe(120)
  })

  it('rejects empty and non-decimal input', () => {
    expect(parseInputValue('', 0, 100, 1)).toBeNull()
    expect(parseInputValue('   ', 0, 100, 1)).toBeNull()
    expect(parseInputValue('abc', 0, 100, 1)).toBeNull()
    expect(parseInputValue('1.2.3', 0, 100, 1)).toBeNull()
    expect(parseInputValue('1e3', 0, 100, 1)).toBeNull()
    expect(parseInputValue('0x10', 0, 100, 1)).toBeNull()
    expect(parseInputValue('Infinity', 0, 100, 1)).toBeNull()
  })
})
