#!/usr/bin/env node

/**
 * Capture the release screenshots and draw the itch.io cover and banner.
 *
 * Every image comes from the real single-file build in `dist-single/index.html`
 * driven in headless Chrome. There are no mock-ups and no hand-edited
 * screenshots. Run `npm run release:media` after a visual change, then
 * `npm run release:check` to validate the files the store kit points at.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = path.join(projectRoot, 'dist-single', 'index.html')
const docsDir = path.join(projectRoot, 'docs')
const screenshotsDir = path.join(docsDir, 'screenshots')
const mediaDir = path.join(docsDir, 'media', 'itch')
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))

function findChromeExecutable() {
  const explicit = process.env.CHROME_PATH
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`CHROME_PATH points to a file that does not exist: ${explicit}`)
    }
    return explicit
  }

  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] &&
      path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean)

  try {
    const bundled = chromium.executablePath()
    if (bundled) candidates.push(bundled)
  } catch {
    // playwright-core has no managed browser; fall through to system Chrome.
  }

  const chrome = candidates.find((candidate) => existsSync(candidate))
  if (!chrome) {
    throw new Error(
      'Chrome was not found. Install Google Chrome or set CHROME_PATH to its executable before capturing release media.',
    )
  }
  return chrome
}

function attachDiagnostics(page, label) {
  const diagnostics = { consoleErrors: [], pageErrors: [], externalRequests: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(`${label}: ${message.text()}`)
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(`${label}: ${error.message}`))
  page.on('request', (request) => {
    if (!/^(file|data|blob):/i.test(request.url())) {
      diagnostics.externalRequests.push(`${label}: ${request.url()}`)
    }
  })
  return diagnostics
}

async function waitForPlaybackToStop(page) {
  await page.waitForFunction(
    () => document.querySelector('.app-root')?.getAttribute('data-playing') === 'false',
    undefined,
    { timeout: 10_000 },
  )
}

async function loadInstrument(page) {
  await page.goto(pathToFileURL(artifactPath).href, { waitUntil: 'load' })
  await page.locator('.app-root').waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForFunction(() => document.querySelectorAll('.hardware-range').length === 7)
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('.scope-canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 10 || canvas.height < 10) {
        return false
      }
      const context = canvas.getContext('2d')
      if (!context) return false
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) return true
      }
      return false
    },
    undefined,
    { timeout: 5_000 },
  )
  await page.waitForTimeout(250)
}

async function armInstrument(page) {
  await page.locator('.trigger-button').click()
  await waitForPlaybackToStop(page)
  await page.waitForTimeout(180)
}

async function selectDice(page) {
  // Choosing a different group loads that group's first sound and auditions it.
  // Do not click the now-active chip: that is the deliberate re-roll gesture and
  // would leave a toast over the screenshot.
  await page.locator('.category-button').filter({ hasText: 'Items' }).click()
  await page.waitForFunction(
    () => document.querySelector('.preset-title-row h3')?.textContent === 'Dice Roll / Bounce',
  )
  await waitForPlaybackToStop(page)
  await page.waitForTimeout(180)
}

async function selectGravel(page) {
  await page.locator('.category-button').filter({ hasText: 'Footsteps' }).click()
  await page.waitForFunction(
    () => document.querySelector('.preset-title-row h3')?.textContent === 'Gravel Crunch',
  )
  await waitForPlaybackToStop(page)
  await page.waitForTimeout(180)
}

async function openPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const diagnostics = attachDiagnostics(page, `${viewport.width}x${viewport.height}`)
  await loadInstrument(page)
  return { context, page, diagnostics }
}

function pngSize(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', 'Expected a PNG file')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function plateHtml({ width, height, screenshot }) {
  const base64 = screenshot.toString('base64')
  const compact = width < 700
  const pad = compact ? 34 : 42
  const titleSize = compact ? 76 : 104
  const markSize = compact ? 42 : 48
  const taglineSize = compact ? 17 : 21

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #051a21;
      }
      body {
        position: relative;
        color: #f1ede5;
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      .shot {
        position: absolute;
        inset: 0;
        background-image: url("data:image/png;base64,${base64}");
        background-position: ${compact ? '72% 0' : '68% 0'};
        background-size: cover;
        filter: saturate(1.04);
      }
      .shade {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, #051a21fa 0%, #051a21ee 34%, #051a21b8 54%, #051a215c 72%, #051a2118 100%),
          linear-gradient(0deg, #051a21e6 0%, #051a2100 34%);
      }
      .grid {
        position: absolute;
        inset: 0;
        opacity: 0.32;
        background:
          linear-gradient(rgba(241,237,229,0.05) 1px, transparent 1px) 0 0 / 100% 28px,
          linear-gradient(90deg, rgba(241,237,229,0.035) 1px, transparent 1px) 0 0 / 28px 100%;
        mask-image: linear-gradient(90deg, #000 0%, #0000 62%);
      }
      .content {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: ${pad}px;
      }
      .top { display: flex; align-items: center; gap: 12px; }
      .mark {
        display: grid;
        place-items: center;
        width: ${markSize}px;
        height: ${markSize}px;
        color: #ffd166;
        border: 1px solid #4a3d1b;
        border-radius: 4px;
        background: linear-gradient(145deg, #ffd16618, #0000 60%), #062028;
        box-shadow: inset 0 1px #ffffff12;
      }
      .mark svg { width: 62%; height: 62%; }
      .eyebrow {
        color: #a9bec3;
        font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
        font-size: ${compact ? 10 : 11}px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .eyebrow b { color: #ffd166; font-weight: 600; }
      .hero { margin-top: auto; padding-top: ${compact ? 26 : 34}px; }
      .title {
        color: #f1ede5;
        font-size: ${titleSize}px;
        font-weight: 900;
        letter-spacing: -0.075em;
        line-height: 0.82;
      }
      .title span { color: #ffd166; text-shadow: 0 0 26px #ffd16655; }
      .tagline {
        max-width: ${compact ? 330 : 470}px;
        margin-top: ${compact ? 14 : 18}px;
        color: #ffe3a0;
        font-size: ${taglineSize}px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: ${compact ? 16 : 20}px;
      }
      .chips span {
        padding: 5px 8px;
        color: #cfdde0;
        border: 1px solid #114450;
        border-radius: 2px;
        background: #04141ab8;
        font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
        font-size: ${compact ? 9 : 10}px;
        font-weight: 600;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }
      .chips span:first-child { color: #1b1207; border-color: #ffe3a0; background: #ffd166; }
      .foot {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 18px;
        margin-top: ${compact ? 22 : 28}px;
        color: #9dafb5;
        font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
        font-size: ${compact ? 9 : 10}px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .foot b { color: #f1ede5; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="shot"></div>
    <div class="shade"></div>
    <div class="grid"></div>
    <div class="content">
      <div class="top">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none">
            <path d="M4 22h7l3.5-13 6 24 5-30 5 19h5" stroke="currentColor" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="miter"/>
          </svg>
        </div>
        <div class="eyebrow"><b>●</b> Tiny sounds for games</div>
      </div>
      <div class="hero">
        <div class="title">CRUNCHR<span>.</span></div>
        <div class="tagline">Make the small sounds your game is missing.</div>
        <div class="chips">
          <span>11 sounds</span>
          <span>WAV + MP3</span>
          <span>10 versions</span>
          <span>Runs offline</span>
        </div>
        <div class="foot">
          <span><b>Made in your browser</b> · no uploads</span>
          <span>v${pkg.version}</span>
        </div>
      </div>
    </div>
  </body>
</html>`
}

async function renderPlate(browser, { width, height, screenshot, output }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await page.setContent(plateHtml({ width, height, screenshot }), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  await page.screenshot({ path: output })
  await context.close()

  const size = pngSize(readFileSync(output))
  assert.deepEqual(size, { width, height }, `${path.relative(projectRoot, output)} has the wrong size`)
  console.log(`  ok  ${path.relative(projectRoot, output)} (${width}x${height})`)
}

async function main() {
  assert.ok(
    existsSync(artifactPath),
    `Missing ${path.relative(projectRoot, artifactPath)}. Run "npm run build:single" first.`,
  )
  mkdirSync(screenshotsDir, { recursive: true })
  mkdirSync(mediaDir, { recursive: true })

  const chromePath = findChromeExecutable()
  console.log(`Crunchr release media — ${path.relative(projectRoot, artifactPath)}`)
  console.log(`  Chrome: ${chromePath}`)

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  const diagnostics = []

  try {
    // 01 — the instrument at rest, armed and ready, with the rendered waveform.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 1600,
        height: 1000,
      })
      await armInstrument(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(screenshotsDir, '01-instrument.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/screenshots/01-instrument.png (1600x1000)')
    }

    // 02 — the full Shape and Listen workbench on a long, granular footstep.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 1600,
        height: 1000,
      })
      await selectGravel(page)
      await page.evaluate(() => {
        const workbench = document.querySelector('.workbench')
        if (workbench) window.scrollTo(0, workbench.getBoundingClientRect().top + window.scrollY)
      })
      await page.waitForTimeout(200)
      await page.screenshot({ path: path.join(screenshotsDir, '02-shape-and-listen.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/screenshots/02-shape-and-listen.png (1600x1000)')
    }

    // 03 — Save: ten preview versions, one selected, with Save v03 visible.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 1600,
        height: 1000,
      })
      await selectDice(page)
      await page.locator('.batch-preview-dot').nth(2).click()
      await waitForPlaybackToStop(page)
      await page.getByRole('radio', { name: /MP3/ }).check()
      await page.waitForFunction(
        () =>
          document.querySelector('.export-single-card .export-button-copy strong')
            ?.textContent === 'DOWNLOAD MP3',
      )
      await page.evaluate(() => {
        const batch = document.querySelector('.export-batch-card')
        if (batch) {
          window.scrollTo(0, batch.getBoundingClientRect().top + window.scrollY - 24)
        }
      })
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(screenshotsDir, '03-ten-versions.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/screenshots/03-ten-versions.png (1600x1000)')
    }

    // 04 — the built-in manual.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 1600,
        height: 1000,
      })
      await page.locator('.help-button').click()
      await page.locator('.help-dialog').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(screenshotsDir, '04-help.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/screenshots/04-help.png (1600x1000)')
    }

    // 05 — the one-column phone layout at 390 px.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 390,
        height: 844,
      })
      await armInstrument(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(screenshotsDir, '05-mobile.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/screenshots/05-mobile.png (390x844)')
    }

    // The README's canonical full-page capture and help view.
    {
      const { context, page, diagnostics: pageDiagnostics } = await openPage(browser, {
        width: 1440,
        height: 1000,
      })
      await armInstrument(page)
      await page.getByRole('radio', { name: /MP3/ }).check()
      await page.locator('.batch-preview-dot').nth(2).click()
      await waitForPlaybackToStop(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(docsDir, 'crunchr-ui.png'), fullPage: true })
      await page.locator('.help-button').click()
      await page.locator('.help-dialog').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(docsDir, 'crunchr-help.png') })
      diagnostics.push(pageDiagnostics)
      await context.close()
      console.log('  ok  docs/crunchr-ui.png (full page, 1440 px wide)')
      console.log('  ok  docs/crunchr-help.png (1440x1000)')
    }

    const heroPath = path.join(screenshotsDir, '01-instrument.png')
    const hero = readFileSync(heroPath)
    assert.deepEqual(pngSize(hero), { width: 1600, height: 1000 }, 'The hero capture is the wrong size')

    await renderPlate(browser, {
      width: 630,
      height: 500,
      screenshot: hero,
      output: path.join(mediaDir, 'cover-630x500.png'),
    })
    await renderPlate(browser, {
      width: 960,
      height: 400,
      screenshot: hero,
      output: path.join(mediaDir, 'banner-960x400.png'),
    })

    const errors = diagnostics.flatMap((entry) => [
      ...entry.consoleErrors,
      ...entry.pageErrors,
    ])
    const external = diagnostics.flatMap((entry) => entry.externalRequests)
    if (errors.length > 0) throw new Error(`Console or page errors:\n${errors.join('\n')}`)
    if (external.length > 0) throw new Error(`Unexpected network requests:\n${external.join('\n')}`)

    console.log('\nRelease media captured with no console errors and no network requests.\n')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('\nRelease media capture failed:')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
