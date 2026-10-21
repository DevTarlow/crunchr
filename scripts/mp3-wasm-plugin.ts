import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:crunchr-mp3-wasm'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

let cachedBase64: string | null = null

function mp3WasmBase64(): string {
  if (cachedBase64) return cachedBase64

  try {
    const require = createRequire(path.join(process.cwd(), 'package.json'))
    const entry = require.resolve('wasm-media-encoders')
    const packageRoot = path.resolve(path.dirname(entry), '..')
    const wasmPath = path.join(packageRoot, 'wasm', 'mp3.wasm')
    cachedBase64 = readFileSync(wasmPath).toString('base64')
    return cachedBase64
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not load the MP3 encoder binary. Run "npm install" and try again. (${detail})`,
    )
  }
}

/**
 * Exposes the MP3 WASM binary as an inlined base64 module. Keeping it out of
 * Vite's asset pipeline means dev, the static build, the single-file build and
 * Vitest all resolve the exact same bytes, and the app never has to fetch it.
 */
export function mp3WasmPlugin(): Plugin {
  return {
    name: 'crunchr-mp3-wasm',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return `export default ${JSON.stringify(mp3WasmBase64())}`
    },
  }
}
