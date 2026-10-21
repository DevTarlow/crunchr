#!/usr/bin/env node

/**
 * Validate the release kit: page metadata, screenshots, cover art, packaging
 * copy, licence and the single-file artifact. This is additive to the unit and
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
  assert.equal(metadata.kindOfGame, 'Downloadable', 'Crunchr must ship as a downloadable file, not an iframe build')
  assert.equal(metadata.genre, null)
  assert.equal(metadata.releaseStatus, 'Released')
  assert.equal(metadata.mobileFriendly, true)
  assert.equal(metadata.pricing.model, 'free')
  assert.match(metadata.support, /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
  assert.equal(metadata.urlSlug, 'crunchr')
  assert.equal(metadata.itchTarget, 'tarlow/crunchr')
  pass(`page fields agree with v${pkg.version} (Tool, Downloadable, free, mobile friendly)`)

  assert.ok(Array.isArray(metadata.tags), 'Tags must be a list')
  assert.ok(metadata.tags.length > 0 && metadata.tags.length <= 10, 'itch allows up to 10 tags')
  assert.equal(new Set(metadata.tags).size, metadata.tags.length, 'Tags must be unique')
  for (const forbidden of ['html5', 'webgl']) {
    assert.ok(!metadata.tags.includes(forbidden), `Do not use the ${forbidden} tag for a downloadable tool`)
  }
  assert.ok(metadata.shortDescription.length <= 200, 'The short description must fit itch')
  pass(`${metadata.tags.length} unique tags, no playable-build tags, short description ${metadata.shortDescription.length}/200`)

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

  requireFile('packaging/START HERE.txt')
  requireFile('docs/crunchr-ui.png')
  requireFile('docs/crunchr-help.png')
  pass('packaging copy and README screenshots are present')

  const artifact = 'dist-single/index.html'
  requireFile(artifact)
  const html = readFileSync(resolve(artifact), 'utf8')
  assert.ok(html.includes('<div id="root"></div>'), 'The single-file build must contain the app root')
  assert.ok(!html.includes('__CRUNCHR_CSP__'), 'The CSP placeholder must be replaced at build time')
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
