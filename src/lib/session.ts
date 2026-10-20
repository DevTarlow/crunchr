import type { ParamKey, SynthParams } from '../audio/types'
import { PRESETS, DEFAULT_PRESET_ID } from '../audio/presets'
import {
  BATCH_GAP_DEFAULT,
  BATCH_GAP_MAX,
  BATCH_GAP_STEP,
  DEFAULT_HUMANIZE,
  sanitizeHumanize,
  sanitizeParams,
} from '../audio/params'

/**
 * Browser-local session memory. Everything here is best effort: a blocked,
 * full or half-corrupt storage must never be able to stop the instrument from
 * loading. The pure parser is exported separately so it can be tested without
 * a DOM.
 */
export const SESSION_STORAGE_KEY = 'crunchr.session.v1'
export const SESSION_VERSION = 1
export const MAX_TAKE = 999

export interface SoundDraft {
  params: SynthParams
  seed: number
  take: number
}

export interface SessionSnapshot {
  version: typeof SESSION_VERSION
  activePresetId: string
  drafts: Record<string, SoundDraft>
  humanize: number
  batchGapMs: number
}

/** Minimal storage shape so tests can inject an in-memory implementation. */
export interface SessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const PRESET_IDS = new Set(PRESETS.map((preset) => preset.id))
const PARAM_KEYS: readonly ParamKey[] = [
  'durationMs',
  'pitchHz',
  'punch',
  'resonance',
  'grit',
  'decay',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSeed(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 0 || value > 0xffff_ffff) return null
  return value
}

function parseTake(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 1 || value > MAX_TAKE) return null
  return value
}

function parseParams(value: unknown): SynthParams | null {
  if (!isRecord(value)) return null
  for (const key of PARAM_KEYS) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) return null
  }
  return sanitizeParams(value as unknown as SynthParams)
}

function parseDraft(value: unknown): SoundDraft | null {
  if (!isRecord(value)) return null
  const params = parseParams(value.params)
  const seed = parseSeed(value.seed)
  const take = parseTake(value.take)
  if (!params || seed === null || take === null) return null
  return { params, seed, take }
}

function parseDrafts(value: unknown): Record<string, SoundDraft> {
  const drafts: Record<string, SoundDraft> = Object.create(null)
  if (!isRecord(value)) return drafts
  for (const [id, raw] of Object.entries(value)) {
    if (!PRESET_IDS.has(id)) continue
    const draft = parseDraft(raw)
    if (draft) drafts[id] = draft
  }
  return drafts
}

export function sanitizeBatchGap(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return BATCH_GAP_DEFAULT
  const stepped = Math.round(value / BATCH_GAP_STEP) * BATCH_GAP_STEP
  return Math.min(BATCH_GAP_MAX, Math.max(0, stepped))
}

/** Parse and validate a stored session. Returns null when nothing usable exists. */
export function parseSession(raw: string | null): SessionSnapshot | null {
  if (!raw) return null
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(decoded) || decoded.version !== SESSION_VERSION) return null

  const activePresetId =
    typeof decoded.activePresetId === 'string' && PRESET_IDS.has(decoded.activePresetId)
      ? decoded.activePresetId
      : DEFAULT_PRESET_ID

  return {
    version: SESSION_VERSION,
    activePresetId,
    drafts: parseDrafts(decoded.drafts),
    humanize:
      typeof decoded.humanize === 'number' && Number.isFinite(decoded.humanize)
        ? sanitizeHumanize(decoded.humanize)
        : DEFAULT_HUMANIZE,
    batchGapMs: sanitizeBatchGap(decoded.batchGapMs),
  }
}

function localSessionStorage(): SessionStorage | null {
  try {
    const storage = globalThis.localStorage
    return storage ?? null
  } catch {
    // Some privacy modes throw on the property access itself.
    return null
  }
}

export function readSession(storage: SessionStorage | null = localSessionStorage()): SessionSnapshot | null {
  if (!storage) return null
  try {
    return parseSession(storage.getItem(SESSION_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeSession(
  snapshot: SessionSnapshot,
  storage: SessionStorage | null = localSessionStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    // Full storage, private mode or a browser policy: keep working in memory.
    return false
  }
}
