#!/usr/bin/env node

/**
 * Validate the release kit: page metadata, screenshots, cover art, store copy,
 * licence and the single-file artifact. This is additive to the unit and
 * browser suites; it never changes a file.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0

function pass(message) {
  checks += 1
  console.log(`  ok  ${message}`)
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePath), 'utf8'))
}

function resolve(relativePath) {
  return path.join(projectRoot, relativePath)
}

function requireFile(relativePath) {
  assert.ok(existsSync(resolve(relativePath)), `Missing ${relativePath}`)
  assert.ok(statSync(resolve(relativePath)).size > 0, `${relativePath} is empty`)
}

function pngSize(relativePath) {
  requireFile(relativePath)
  const buffer = readFileSync(resolve(relativePath))
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} is not a PNG`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length }
}

function listedSize(size) {
  const match = /^(\d+)x(\d+)$/.exec(size)
  assert.ok(match, `Unreadable screenshot size: ${size}`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground)
  const b = luminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function main() {
  const pkg = readJson('package.json')
  const metadata = readJson('docs/itch/metadata.json')

  console.log(`Crunchr release check — v${pkg.version}`)

  assert.equal(pkg.license, 'MIT', 'package.json must declare the MIT licence')
  requireFile('LICENSE')
  assert.match(readFileSync(resolve('LICENSE'), 'utf8'), /^MIT License/m)
  const lockfile = readJson('package-lock.json')
  assert.equal(lockfile.packages[''].license, 'MIT', 'package-lock.json must agree on the licence')
  pass('the app declares MIT, ships a licence file and the lockfile agrees')

  assert.equal(metadata.version, pkg.version, 'The store metadata version must match package.json')
  const appSource = readFileSync(resolve('src/App.tsx'), 'utf8')
  assert.ok(
    appSource.includes(`v${pkg.version}`),
    `The footer in src/App.tsx must show v${pkg.version}`,
  )
  pass(`store metadata and the in-app footer both show v${pkg.version}`)

  assert.equal(metadata.title, 'Crunchr')
  assert.equal(metadata.tagline, 'Tiny Sound Maker for Games')
  assert.equal(metadata.classification, 'Tool')
  assert.equal(metadata.kindOfGame, 'HTML Game', 'Crunchr must ship as an HTML Game, not a downloadable file')
  assert.equal(metadata.channel, 'html5', 'The release channel must be html5 for an HTML Game')
  assert.equal(metadata.genre, null)
  assert.equal(metadata.releaseStatus, 'Released')
  assert.equal(metadata.mobileFriendly, true)
  assert.equal(metadata.pricing.model, 'free')
  assert.match(metadata.support, /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
  assert.equal(metadata.urlSlug, 'crunchr')
  assert.equal(metadata.itchTarget, 'tarlow/crunchr')
  pass(`page fields agree with v${pkg.version} (Tool, HTML Game, free, mobile friendly)`)

  assert.ok(Array.isArray(metadata.tags), 'Tags must be a list')
  assert.ok(metadata.tags.length > 0 && metadata.tags.length <= 10, 'itch allows up to 10 tags')
  assert.equal(new Set(metadata.tags).size, metadata.tags.length, 'Tags must be unique')
  assert.ok(metadata.tags.includes('html5'), 'An HTML Game should carry the html5 tag')
  assert.ok(!metadata.tags.includes('webgl'), 'webgl would suggest a 3D engine this is not')
  assert.ok(metadata.shortDescription.length <= 200, 'The short description must fit itch')
  pass(`${metadata.tags.length} unique tags, includes html5, short description ${metadata.shortDescription.length}/200`)

  const theme = metadata.theme
  assert.ok(theme && typeof theme === 'object', 'The page theme must be recorded in metadata')
  const themeKeys = [
    'background',
    'contentBackground',
    'subtleBackground',
    'text',
    'link',
    'border',
    'button',
    'buttonText',
    'buttonShadow',
  ]
  for (const key of themeKeys) {
    assert.match(theme[key], /^#[0-9a-f]{6}$/i, `Theme ${key} must be a six-digit hex color`)
  }
  assert.equal(theme.font, 'sans-serif', 'Keep the page theme on the app sans-serif')
  const contrastPairs = [
    ['text', 'background'],
    ['text', 'contentBackground'],
    ['text', 'subtleBackground'],
    ['link', 'background'],
    ['link', 'contentBackground'],
    ['buttonText', 'button'],
  ]
  for (const [foreground, background] of contrastPairs) {
    const ratio = contrastRatio(theme[foreground], theme[background])
    assert.ok(
      ratio >= 4.5,
      `Theme contrast ${foreground} on ${background} is ${ratio.toFixed(2)}:1, below AA 4.5:1`,
    )
  }
  pass('theme palette is complete and clears AA contrast')

  requireFile('docs/itch/RELEASE.md')
  const releaseDoc = readFileSync(resolve('docs/itch/RELEASE.md'), 'utf8')
  assert.match(releaseDoc, new RegExp(pkg.version.replaceAll('.', '\\.')))
  pass('docs/itch/RELEASE.md exists and names the release version')

  assert.ok(Array.isArray(metadata.screenshots) && metadata.screenshots.length >= 3)
  for (const [index, shot] of metadata.screenshots.entries()) {
    const actual = pngSize(shot.file)
    const expected = listedSize(shot.size)
    assert.deepEqual(
      { width: actual.width, height: actual.height },
      expected,
      `${shot.file} is ${actual.width}x${actual.height}, metadata says ${shot.size}`,
    )
    assert.ok(actual.bytes > 20_000, `${shot.file} looks too small to be a real capture`)
    assert.ok(shot.caption.trim().length > 20, `Screenshot ${index + 1} needs a real caption`)
    pass(`screenshot ${index + 1}: ${shot.file} (${shot.size}, ${Math.round(actual.bytes / 1024)} kB)`)
  }

  assert.deepEqual(pngSize(metadata.cover), { width: 630, height: 500, bytes: statSync(resolve(metadata.cover)).size })
  assert.deepEqual(pngSize(metadata.banner), { width: 960, height: 400, bytes: statSync(resolve(metadata.banner)).size })
  pass('cover is 630x500 and banner is 960x400')

  requireFile('docs/crunchr-ui.png')
  requireFile('docs/crunchr-help.png')
  pass('README screenshots are present')

  assert.match(releaseDoc, /HTML Game/)
  assert.match(releaseDoc, /index\.html/)
  pass('release notes describe the HTML Game upload and index.html entry point')

  const artifact = 'dist-single/index.html'
  requireFile(artifact)
  const html = readFileSync(resolve(artifact), 'utf8')
  assert.ok(html.includes('<div id="root"></div>'), 'The single-file build must contain the app root')
  assert.ok(!html.includes('__CRUNCHR_CSP__'), 'The CSP placeholder must be replaced at build time')
  assert.ok(
    html.includes("script-src 'unsafe-inline' 'wasm-unsafe-eval'"),
    'The single-file CSP must allow the bundled MP3 WebAssembly encoder',
  )
  assert.ok(html.includes("connect-src 'none'"), 'The single-file build must block network egress')
  assert.ok(!/<script[^>]+\ssrc=/i.test(html), 'The single-file build must not load an external script')
  assert.ok(!/<link[^>]+\shref=(?!["']data:)/i.test(html), 'The single-file build must not load an external stylesheet')
  pass(`single-file artifact is self-contained (${Math.round(statSync(resolve(artifact)).size / 1024)} kB, no egress)`)

  console.log(`\nRelease checks passed: ${checks}.\n`)
}

try {
  main()
} catch (error) {
  console.error('\nRelease check failed:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
