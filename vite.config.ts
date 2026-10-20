import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Crunchr has two deliberate output shapes:
 *
 *   dist/          normal hashed static assets for a conventional host
 *   dist-single/   one self-contained HTML file for itch.io / offline use
 *
 * Both use relative URLs. The single-file artifact can be opened from disk,
 * where module imports and stylesheet fetches would otherwise fail.
 */
const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const SINGLE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function cspPlugin(single: boolean) {
  return {
    name: 'crunchr-csp',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(html: string, ctx: { server?: unknown }) {
        const policy = ctx.server ? DEV_CSP : single ? SINGLE_CSP : PROD_CSP
        return html.replaceAll('__CRUNCHR_CSP__', policy)
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single'

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(single),
      ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
      cssCodeSplit: !single,
      assetsInlineLimit: single ? 100_000_000 : 0,
      modulePreload: false,
      sourcemap: false,
      reportCompressedSize: false,
    },
    esbuild: {
      legalComments: 'none',
    },
  }
})
