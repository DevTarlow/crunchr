#!/usr/bin/env node

/**
 * Package Crunchr's downloadable itch build.
 *
 * The ZIP contains the single HTML file, the plain-language START HERE guide
 * and the MIT licence. The archive is read back and compared byte for byte with
 * the source files before it is allowed to remain on disk, so a broken or stale
 * build cannot look publishable.
 */

import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectRoot, 'dist-itch')

const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const zipName = `Crunchr-${pkg.version}.zip`
const zipPath = path.join(outputDir, zipName)

const files = [
  { name: 'crunchr.html', source: 'dist-single/index.html' },
  { name: 'START HERE.txt', source: 'packaging/START HERE.txt' },
  { name: 'LICENSE.txt', source: 'LICENSE' },
]

function newestSourceMtime() {
  let newest = 0
  const visit = (relativePath) => {
    const absolute = path.join(projectRoot, relativePath)
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      for (const entry of readdirSync(absolute)) visit(path.join(relativePath, entry))
    } else if (stats.mtimeMs > newest) {
      newest = stats.mtimeMs
    }
  }
  visit('src')
  for (const relativePath of ['index.html', 'vite.config.ts', 'package.json']) {
    const stats = statSync(path.join(projectRoot, relativePath))
    if (stats.mtimeMs > newest) newest = stats.mtimeMs
  }
  return newest
}

function formattedSize(bytes) {
  return `${Math.round(bytes / 1024)} kB`
}

async function main() {
  for (const file of files) {
    assert.ok(existsSync(path.join(projectRoot, file.source)), `Missing ${file.source}`)
  }

  const artifactPath = path.join(projectRoot, 'dist-single/index.html')
  const artifactStats = statSync(artifactPath)
  const sourceMtime = newestSourceMtime()
  assert.ok(
    artifactStats.mtimeMs >= sourceMtime,
    'dist-single/index.html is older than the source. Run "npm run build:single" first.',
  )

  const html = readFileSync(artifactPath, 'utf8')
  assert.ok(html.includes('<div id="root"></div>'), 'The artifact does not contain the app root')
  assert.ok(html.includes("connect-src 'none'"), 'The artifact must block network egress')
  assert.ok(!html.includes('__CRUNCHR_CSP__'), 'The artifact still has an unreplaced CSP placeholder')

  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, readFileSync(path.join(projectRoot, file.source)))
  }

  mkdirSync(outputDir, { recursive: true })
  try {
    const bytes = await zip.generateAsync({
      type: 'nodebuffer',
      platform: 'UNIX',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })
    assert.ok(bytes.length > 100_000, `The archive is unexpectedly small (${bytes.length} bytes)`)
    assert.ok(bytes.length < 250 * 1024 * 1024, 'The archive is over itch.io practical limits')
    writeFileSync(zipPath, bytes)
    console.log(`Crunchr ${pkg.version} — ${path.relative(projectRoot, zipPath)}`)
    console.log(`  archive: ${formattedSize(bytes.length)}`)

    const archive = await JSZip.loadAsync(readFileSync(zipPath))
    const entries = Object.keys(archive.files)
      .filter((name) => !archive.files[name].dir)
      .sort()
    assert.deepEqual(
      entries,
      files.map((file) => file.name).sort(),
      'The archive must contain exactly the app, the guide and the licence',
    )

    for (const file of files) {
      const packed = Buffer.from(await archive.files[file.name].async('uint8array'))
      const source = readFileSync(path.join(projectRoot, file.source))
      assert.deepEqual(
        packed,
        source,
        `${file.name} must be byte-identical to ${file.source}`,
      )
      console.log(`  ok  ${file.name} — ${formattedSize(packed.length)}`)
    }

    console.log('\nVerified: the ZIP opens, holds the three expected files, and the app matches dist-single byte for byte.\n')
  } catch (error) {
    rmSync(zipPath, { force: true })
    throw error
  }
}

main().catch((error) => {
  console.error('\nitch.io packaging failed:')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
