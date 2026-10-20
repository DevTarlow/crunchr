import type { ParamKey } from '../audio/types'

export function formatHz(hz: number): string {
  if (hz < 1000) return `${Math.round(hz)} Hz`
  const khz = hz / 1000
  return `${khz.toFixed(khz >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')} kHz`
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatQ(value: number): string {
  return value.toFixed(1)
}

export function readoutForParam(key: ParamKey, value: number): string {
  switch (key) {
    case 'durationMs':
      return formatMs(value)
    case 'pitchHz':
      return formatHz(value)
    case 'resonance':
      return `${formatQ(value)} Q`
    case 'punch':
    case 'grit':
    case 'decay':
      return formatPercent(value)
  }
}

export function readoutForHumanize(value: number): string {
  return `${Math.round(value)}%`
}

export function formatSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

export function formatElapsedMs(value: number): string {
  if (value < 10) return `${value.toFixed(1)} ms`
  return `${Math.round(value)} ms`
}
