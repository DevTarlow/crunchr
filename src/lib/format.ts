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
      return formatQ(value)
    case 'punch':
    case 'grit':
    case 'decay':
      return formatPercent(value)
  }
}

export function readoutForHumanize(value: number): string {
  return `${Math.round(value)}%`
}

export function formatElapsedMs(value: number): string {
  if (value < 10) return `${value.toFixed(1)} ms`
  return `${Math.round(value)} ms`
}

/** Compact file size for download buttons and toasts. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
