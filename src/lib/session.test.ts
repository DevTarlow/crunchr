import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET_ID, getPresetById } from '../audio/presets'
import {
  MAX_TAKE,
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  parseSession,
  readSession,
  sanitizeBatchGap,
  writeSession,
  type SessionSnapshot,
  type SessionStorage,
} from './session'

function validSnapshot(): SessionSnapshot {
  return {
    version: SESSION_VERSION,
    activePresetId: 'dice-roll',
    drafts: {
      'dice-roll': {
        params: {
          durationMs: 640,
          pitchHz: 380,
          punch: 74,
          resonance: 10,
          grit: 50,
          decay: 38,
        },
        seed: 0x1234_abcd,
        take: 3,
      },
    },
    humanize: 20,
    batchGapMs: 120,
  }
}

function memoryStorage(initial?: string): SessionStorage & { value: string | null } {
  const box = {
    value: initial ?? null,
    getItem(key: string) {
      return key === SESSION_STORAGE_KEY ? box.value : null
    },
    setItem(key: string, value: string) {
      if (key === SESSION_STORAGE_KEY) box.value = value
    },
  }
  return box
}

describe('session parsing', () => {
  it('round-trips a valid snapshot and keeps every draft', () => {
    const snapshot = validSnapshot()
    const parsed = parseSession(JSON.stringify(snapshot))
    expect(parsed).toEqual(snapshot)
  })

  it('migrates untouched legacy click and card lengths to the new defaults', () => {
    const parsed = parseSession(
      JSON.stringify({
        version: SESSION_VERSION,
        activePresetId: 'mechanical-click',
        drafts: {
          'mechanical-click': {
            params: {
              durationMs: 80,
              pitchHz: 2300,
              punch: 92,
              resonance: 15,
              grit: 38,
              decay: 30,
            },
            seed: 11,
            take: 2,
          },
          'card-snap': {
            params: {
              durationMs: 82,
              pitchHz: 1700,
              punch: 88,
              resonance: 4.5,
              grit: 68,
              decay: 28,
            },
            seed: 22,
            take: 3,
          },
        },
      }),
    )

    expect(parsed?.drafts['mechanical-click']).toEqual({
      params: getPresetById('mechanical-click').defaults,
      seed: 11,
      take: 2,
    })
    expect(parsed?.drafts['card-snap']).toEqual({
      params: getPresetById('card-snap').defaults,
      seed: 22,
      take: 3,
    })
  })

  it('keeps a hand-edited legacy click draft unchanged', () => {
    const parsed = parseSession(
      JSON.stringify({
        version: SESSION_VERSION,
        activePresetId: 'mechanical-click',
        drafts: {
          'mechanical-click': {
            params: {
              durationMs: 120,
              pitchHz: 2300,
              punch: 92,
              resonance: 15,
              grit: 38,
              decay: 30,
            },
            seed: 11,
            take: 2,
          },
        },
      }),
    )

    expect(parsed?.drafts['mechanical-click']?.params.durationMs).toBe(120)
  })

  it('rejects missing, non-JSON and wrong-version payloads', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession('')).toBeNull()
    expect(parseSession('{nope')).toBeNull()
    expect(parseSession(JSON.stringify({ version: 2, activePresetId: 'dice-roll' }))).toBeNull()
  })

  it('falls back to the default preset for an unknown active id', () => {
    const parsed = parseSession(
      JSON.stringify({ version: SESSION_VERSION, activePresetId: 'not-a-sound', drafts: {} }),
    )
    expect(parsed?.activePresetId).toBe(DEFAULT_PRESET_ID)
    expect(parsed?.humanize).toBe(20)
    expect(parsed?.batchGapMs).toBe(120)
  })

  it('ignores unknown preset ids and malformed drafts', () => {
    const parsed = parseSession(
      JSON.stringify({
        version: SESSION_VERSION,
        activePresetId: 'dice-roll',
        drafts: {
          'not-a-sound': validSnapshot().drafts['dice-roll'],
          'dice-roll': { params: { durationMs: 'long' }, seed: 1, take: 1 },
          'coin-clink': { params: validSnapshot().drafts['dice-roll']?.params, seed: -1, take: 1 },
          'bone-crunch': { params: validSnapshot().drafts['dice-roll']?.params, seed: 7, take: 0 },
        },
      }),
    )
    expect(parsed?.drafts).toEqual({})
  })

  it('clamps and rounds stored values at the public boundary', () => {
    const parsed = parseSession(
      JSON.stringify({
        version: SESSION_VERSION,
        activePresetId: 'dice-roll',
        drafts: {
          'dice-roll': {
            params: {
              durationMs: 5000,
              pitchHz: 1,
              punch: 140,
              resonance: 0,
              grit: 999,
              decay: -4,
            },
            seed: 0xffff_ffff,
            take: 3,
          },
        },
        humanize: 999,
        batchGapMs: 777,
      }),
    )
    expect(parsed?.drafts['dice-roll']?.params).toEqual({
      durationMs: 800,
      pitchHz: 40,
      punch: 100,
      resonance: 0.5,
      grit: 100,
      decay: 0,
    })
    expect(parsed?.humanize).toBe(50)
    expect(parsed?.batchGapMs).toBe(600)
  })

  it('rejects a take number outside the supported range', () => {
    const parsed = parseSession(
      JSON.stringify({
        version: SESSION_VERSION,
        activePresetId: 'dice-roll',
        drafts: {
          'dice-roll': {
            params: validSnapshot().drafts['dice-roll']?.params,
            seed: 7,
            take: MAX_TAKE + 1,
          },
        },
      }),
    )
    // The draft is discarded rather than silently inventing a version number.
    expect(parsed?.drafts['dice-roll']).toBeUndefined()
  })

  it('sanitizes the preview gap to the slider step', () => {
    expect(sanitizeBatchGap(109)).toBe(100)
    expect(sanitizeBatchGap(110)).toBe(120)
    expect(sanitizeBatchGap(-5)).toBe(0)
    expect(sanitizeBatchGap(Number.NaN)).toBe(120)
  })
})

describe('session storage', () => {
  it('writes and reads a snapshot through the injected storage', () => {
    const storage = memoryStorage()
    const snapshot = validSnapshot()
    expect(writeSession(snapshot, storage)).toBe(true)
    expect(readSession(storage)).toEqual(snapshot)
  })

  it('returns null when the stored value is corrupt', () => {
    expect(readSession(memoryStorage('{broken'))).toBeNull()
  })

  it('survives storage that throws', () => {
    const throwing: SessionStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('quota')
      },
    }
    expect(readSession(throwing)).toBeNull()
    expect(writeSession(validSnapshot(), throwing)).toBe(false)
  })
})
