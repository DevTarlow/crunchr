/**
 * Small deterministic PRNG utilities. Every sample-level random choice is
 * derived from a number so a preview and its exported WAV are identical.
 */
export type Rng = () => number

/** Fast, well-distributed 32-bit seedable generator (mulberry32). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform bipolar value in [-1, 1). */
export function bipolar(rng: Rng): number {
  return rng() * 2 - 1
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randomBetween(rng, min, max + 1))
}

/** A stable 32-bit hash for strings / numbers. */
export function hashSeed(...parts: readonly (string | number)[]): number {
  let h = 2166136261 >>> 0
  const input = parts.join('|')
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Final avalanche so small adjacent inputs do not produce correlated streams.
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return h >>> 0
}

export function deriveSeed(baseSeed: number, ...parts: readonly (string | number)[]): number {
  return hashSeed(baseSeed, ...parts)
}

export function createSeed(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1)
    cryptoApi.getRandomValues(values)
    return values[0] ?? hashSeed(Date.now(), Math.random())
  }
  return hashSeed(Date.now(), Math.random())
}
