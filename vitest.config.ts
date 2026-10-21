import { defineConfig } from 'vitest/config'
import { mp3WasmPlugin } from './scripts/mp3-wasm-plugin'

export default defineConfig({
  plugins: [mp3WasmPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'default',
  },
})
