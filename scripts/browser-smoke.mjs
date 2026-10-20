#!/usr/bin/env node

/**
 * Headless Chrome smoke test for the shipping artifact.
 *
 * It opens the inlined `dist-single/index.html` directly from disk (the same
 * file intended for itch.io), exercises the audio UI, downloads and validates a
 * WAV and a 10-take ZIP, checks the mobile layout, and fails on console errors
 * or any network request. It runs without a dev server.
 *
 * Run `npm run build:single` first, or `npm run verify:browser` which builds.
 * Chrome is found through CHROME_PATH, the usual platform locations, or a
 * Playwright-managed Chromium installation.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { chromium } from 'playwright-core'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = path.join(projectRoot, 'dist-single', 'index.html')
const checkLog = []

function pass(message) {
  checkLog.push(message)
  console.log(`  ok  ${message}`)
}

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
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] &&
      path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
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
      'Chrome was not found. Install Google Chrome or set CHROME_PATH to its executable before running the browser smoke test.',
    )
  }
  return chrome
}

function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], externalRequests: [] }

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
  page.on('request', (request) => {
    const url = request.url()
    if (!/^(file|data|blob):/i.test(url)) diagnostics.externalRequests.push(url)
  })

  return diagnostics
}

async function waitForAttribute(page, selector, attribute, expected, timeout = 5_000) {
  await page.waitForFunction(
    ({ selector: target, attribute: attr, expected: value }) =>
      document.querySelector(target)?.getAttribute(attr) === value,
    { selector, attribute, expected },
    { timeout },
  )
}

function readWav(buffer) {
  assert.ok(buffer.length > 44, 'WAV must contain a header and PCM data')
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', 'WAV must start with RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE', 'WAV must be a WAVE file')
  assert.equal(view.getUint16(20, true), 1, 'WAV must use PCM format 1')
  assert.equal(view.getUint16(22, true), 2, 'WAV must be stereo')
  assert.equal(view.getUint32(24, true), 44_100, 'WAV must be 44.1 kHz')
  assert.equal(view.getUint16(34, true), 16, 'WAV must be 16-bit')
  const dataBytes = view.getUint32(40, true)
  assert.equal(dataBytes, buffer.length - 44, 'WAV data chunk size must match the file')
  assert.equal(dataBytes % 4, 0, 'Stereo 16-bit data must be frame-aligned')

  let peak = 0
  for (let offset = 44; offset + 1 < buffer.length; offset += 2) {
    peak = Math.max(peak, Math.abs(buffer.readInt16LE(offset)))
  }
  assert.ok(peak > 1_000, `WAV must contain audible PCM (peak=${peak})`)
  return { dataBytes, peak }
}

async function loadApp(page) {
  await page.goto(pathToFileURL(artifactPath).href, { waitUntil: 'load' })
  await page.locator('.app-root').waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForFunction(() => document.querySelectorAll('.hardware-range').length === 7)
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.scope-canvas')
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 10 || canvas.height < 10) return false
    const context = canvas.getContext('2d')
    if (!context) return false
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true
    }
    return false
  }, undefined, { timeout: 5_000 })
}

async function selectLongPreset(page) {
  await page.locator('.category-button').filter({ hasText: 'Items' }).click()
  await page.locator('.preset-chip').filter({ hasText: 'Dice Roll' }).click()
  await page.waitForFunction(
    () => document.querySelector('.preset-title-row h3')?.textContent === 'Dice Roll / Bounce',
  )
}

async function waitForPlayback(page, expected) {
  await waitForAttribute(page, '.app-root', 'data-playing', expected ? 'true' : 'false')
}

async function main() {
  assert.ok(
    existsSync(artifactPath),
    `Missing ${path.relative(projectRoot, artifactPath)}. Run "npm run build:single" first.`,
  )

  const chromePath = findChromeExecutable()
  console.log(`Crunchr browser smoke — ${path.relative(projectRoot, artifactPath)}`)
  console.log(`  Chrome: ${chromePath}`)

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  const downloadsDir = mkdtempSync(path.join(tmpdir(), 'crunchr-smoke-'))
  const failures = []

  try {
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    })
    const page = await desktopContext.newPage()
    const desktop = attachDiagnostics(page)

    await loadApp(page)

    assert.equal(
      await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
      'The single-file build must keep its no-egress CSP',
    )
    assert.equal(await page.locator('.category-button').count(), 4)
    assert.equal(await page.locator('.preset-chip').count(), 3)
    assert.equal(await page.locator('.hardware-range').count(), 7)
    assert.equal(await page.locator('.trigger-button').count(), 1)
    assert.equal(await page.locator('.app-root').getAttribute('data-audio-state'), 'standby')
    pass('single-file UI, preset bank, seven controls and scope render from file://')

    const bodyFontSize = await page.locator('body').evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )
    const labelFontSize = await page.locator('.param-label').first().evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )
    const helperFontSize = await page.locator('.param-helper').first().evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )
    assert.ok(bodyFontSize >= 16, `Body text must be at least 16 px (got ${bodyFontSize})`)
    assert.ok(labelFontSize >= 12, `Control labels must be at least 12 px (got ${labelFontSize})`)
    assert.ok(helperFontSize >= 12, `Control helpers must be at least 12 px (got ${helperFontSize})`)
    pass(`type scale stays readable (body ${bodyFontSize}px, labels ${labelFontSize}px, helpers ${helperFontSize}px)`)

    await selectLongPreset(page)
    assert.equal(await page.locator('.app-root').getAttribute('data-audio-state'), 'armed')
    pass('first user gesture arms the audio engine')

    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    pass('selecting a sound auditions it')

    const defaultLengthPosition = await page.locator('#param-durationMs').inputValue()
    const versionAfterSelect = await page.locator('.version-readout').innerText()
    await page.locator('#param-durationMs').focus()
    for (let i = 0; i < 15; i += 1) await page.keyboard.press('ArrowRight')
    const editedLengthPosition = await page.locator('#param-durationMs').inputValue()
    assert.notEqual(
      editedLengthPosition,
      defaultLengthPosition,
      'Arrow keys must move the length slider',
    )

    await page.locator('.category-button').filter({ hasText: 'Clicks' }).click()
    await page.waitForFunction(
      () => document.querySelector('.preset-title-row h3')?.textContent === 'Mechanical Click',
    )
    await page.locator('.category-button').filter({ hasText: 'Items' }).click()
    await page.waitForFunction(
      () => document.querySelector('.preset-title-row h3')?.textContent === 'Dice Roll / Bounce',
    )
    assert.equal(
      await page.locator('#param-durationMs').inputValue(),
      editedLengthPosition,
      'Each sound must remember its slider settings',
    )
    assert.equal(
      await page.locator('.version-readout').innerText(),
      versionAfterSelect,
      'Restoring a draft must keep its version number',
    )
    await waitForPlayback(page, false)

    await page.locator('.reset-button').click()
    await page.waitForFunction(
      () => document.querySelectorAll('.modified-label').length === 0,
    )
    assert.equal(
      await page.locator('#param-durationMs').inputValue(),
      defaultLengthPosition,
      'Reset must return the sliders to the preset defaults',
    )
    await waitForPlayback(page, false)
    pass('per-sound memory and Reset preserve and restore slider settings')

    const versionBeforeCategoryClick = await page.locator('.version-readout').innerText()
    await page.locator('.category-button').filter({ hasText: 'Items' }).click()
    await page.waitForTimeout(150)
    assert.equal(
      await page.locator('.version-readout').innerText(),
      versionBeforeCategoryClick,
      'Clicking the active category must not re-roll the sound',
    )
    pass('the active category is a no-op rather than a hidden re-roll')

    await page.locator('.help-button').click()
    await page.locator('.help-dialog').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.help-dialog').getAttribute('role'), 'dialog')
    assert.equal(await page.locator('.help-dialog').getAttribute('aria-modal'), 'true')
    assert.equal(await page.locator('.help-steps li').count(), 6)
    await page.keyboard.press('Escape')
    await page.locator('.help-dialog').waitFor({ state: 'detached' })
    pass('the help manual opens as a modal and Escape closes it')

    await page.locator('#param-durationMs').focus()
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight')
    const rerollLengthPosition = await page.locator('#param-durationMs').inputValue()
    const versionBeforeReroll = await page.locator('.version-readout').innerText()
    await page.locator('.preset-chip.is-active').click()
    await page.waitForFunction(
      (previous) => document.querySelector('.version-readout')?.textContent !== previous,
      versionBeforeReroll,
    )
    const versionAfterReroll = await page.locator('.version-readout').innerText()
    const versionNumber = (label) => Number.parseInt(label.replace(/[^0-9]/g, ''), 10)
    assert.equal(
      versionNumber(versionAfterReroll),
      versionNumber(versionBeforeReroll) + 1,
      'Re-rolling must advance the version number',
    )
    assert.equal(
      await page.locator('#param-durationMs').inputValue(),
      rerollLengthPosition,
      'Re-rolling must keep the current slider settings',
    )
    await page.waitForFunction(() =>
      /New version [0-9]+\. Same sound/.test(
        document.querySelector('.toast-message')?.textContent ?? '',
      ),
    )
    await waitForPlayback(page, false)
    pass('tapping the active sound rolls a new version without losing the sliders')

    await page.locator('.trigger-button').click()
    await waitForPlayback(page, true)
    await page.waitForFunction(() => document.querySelector('.scope-screen')?.classList.contains('is-playing'))
    assert.equal(await page.locator('.status-value').innerText(), 'PLAYING')
    await waitForPlayback(page, false)
    assert.equal(await page.locator('.status-value').innerText(), 'READY')
    pass('the Play button plays audio, drives the sound wave and reports playback')

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })
    await page.keyboard.press('Space')
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    pass('Spacebar triggers the current preset')

    await page.locator('.scope-screen').click({ position: { x: 240, y: 70 } })
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    pass('clicking the scope replays the current preset')

    const wavDownloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: /DOWNLOAD WAV/ }).click()
    const wavDownload = await wavDownloadPromise
    assert.equal(wavDownload.suggestedFilename(), 'crunchr_dice_roll.wav')
    const wavPath = path.join(downloadsDir, wavDownload.suggestedFilename())
    await wavDownload.saveAs(wavPath)
    const wavInfo = readWav(readFileSync(wavPath))
    pass(`WAV export is valid 44.1 kHz / 16-bit stereo (${wavInfo.dataBytes} data bytes, peak ${wavInfo.peak})`)

    const zipDownloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('button', { name: /DOWNLOAD 10 VERSIONS/ }).click()
    const zipDownload = await zipDownloadPromise
    assert.equal(zipDownload.suggestedFilename(), 'crunchr_dice_roll_variants.zip')
    const zipPath = path.join(downloadsDir, zipDownload.suggestedFilename())
    await zipDownload.saveAs(zipPath)

    const archive = await JSZip.loadAsync(readFileSync(zipPath))
    const entries = Object.keys(archive.files)
      .filter((name) => !archive.files[name].dir)
      .sort()
    const expectedNames = Array.from(
      { length: 10 },
      (_, index) => `crunchr_dice_roll_v${String(index + 1).padStart(2, '0')}.wav`,
    )
    assert.deepEqual(entries, expectedNames, 'ZIP must contain the ten numbered WAVs')

    const zipEntries = new Map()
    for (const name of entries) {
      const bytes = Buffer.from(await archive.files[name].async('uint8array'))
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
      assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(24, true), 44_100)
      zipEntries.set(name, bytes)
    }
    await page.waitForFunction(() => document.querySelector('.toast-message')?.textContent?.includes('Saved 10 sounds'))
    pass('batch export downloads a ZIP with 10 valid 44.1 kHz WAV variations')

    assert.equal(await page.locator('.batch-preview-dot').count(), 10)
    await page.locator('.batch-preview-dot').nth(2).click()
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    assert.equal(
      await page.locator('.batch-preview-count').textContent(),
      'Version 03 selected',
    )
    assert.equal(
      await page.locator('.batch-preview-dot').nth(2).getAttribute('aria-pressed'),
      'true',
    )
    const versionWavPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Save version 3 as a WAV file' }).click()
    const versionWav = await versionWavPromise
    assert.equal(versionWav.suggestedFilename(), 'crunchr_dice_roll_v03.wav')
    const versionPath = path.join(downloadsDir, versionWav.suggestedFilename())
    await versionWav.saveAs(versionPath)
    const versionBytes = readFileSync(versionPath)
    const versionWavInfo = readWav(versionBytes)
    const zipVersionThree = zipEntries.get('crunchr_dice_roll_v03.wav')
    assert.ok(zipVersionThree, 'The ZIP must contain version 03')
    assert.deepEqual(
      versionBytes,
      zipVersionThree,
      'Save vNN must be byte-identical to the matching ZIP entry',
    )
    await page.waitForFunction(() =>
      document.querySelector('.toast-message')?.textContent?.includes('v03.wav'),
    )
    pass(`a single version auditions and matches its ZIP entry (${versionWavInfo.dataBytes} data bytes)`)

    if (await page.locator('.toast-close').isVisible()) {
      await page.locator('.toast-close').click()
    }
    await page.locator('.category-button').filter({ hasText: 'Clicks' }).click()
    await page.waitForFunction(
      () => document.querySelector('.preset-title-row h3')?.textContent === 'Mechanical Click',
    )
    await page.locator('#batch-gap').focus()
    await page.keyboard.press('Home')
    assert.equal(await page.locator('#batch-gap').inputValue(), '0')
    assert.equal(await page.locator('.batch-preview-gap output').innerText(), '0 ms')
    await page.getByRole('button', { name: 'Play all 10 versions' }).click()
    await page.waitForFunction(
      () => document.querySelector('.batch-preview-button')?.getAttribute('aria-pressed') === 'true',
    )
    await page.waitForFunction(
      () => document.querySelector('.batch-preview-button')?.getAttribute('aria-pressed') === 'false',
      undefined,
      { timeout: 10_000 },
    )
    pass('the batch preview plays all ten versions and stops on its own')

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    assert.deepEqual(desktop.consoleErrors, [], 'Desktop console errors')
    assert.deepEqual(desktop.pageErrors, [], 'Desktop page errors')
    assert.deepEqual(desktop.externalRequests, [], 'Desktop external requests')
    pass('desktop layout has no horizontal overflow and no console errors or network egress')

    const memoryContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const memoryPage = await memoryContext.newPage()
    const memory = attachDiagnostics(memoryPage)
    await loadApp(memoryPage)
    await selectLongPreset(memoryPage)
    await waitForPlayback(memoryPage, false)
    await memoryPage.locator('#param-durationMs').focus()
    for (let i = 0; i < 20; i += 1) await memoryPage.keyboard.press('ArrowRight')
    const persistedDuration = await memoryPage
      .locator('#param-durationMs')
      .getAttribute('aria-valuetext')
    const persistedVersion = await memoryPage.locator('.version-readout').innerText()
    await memoryPage.waitForTimeout(500)
    await memoryPage.reload({ waitUntil: 'load' })
    await memoryPage.locator('.app-root').waitFor({ state: 'visible' })
    await memoryPage.waitForFunction(() => document.querySelectorAll('.hardware-range').length === 7)
    assert.equal(
      await memoryPage.locator('.preset-title-row h3').innerText(),
      'Dice Roll / Bounce',
      'The active preset must survive a reload',
    )
    assert.equal(
      await memoryPage.locator('#param-durationMs').getAttribute('aria-valuetext'),
      persistedDuration,
      'Slider settings must survive a reload',
    )
    assert.equal(
      await memoryPage.locator('.version-readout').innerText(),
      persistedVersion,
      'The version number must survive a reload',
    )
    assert.equal(
      await memoryPage.locator('.app-root').getAttribute('data-audio-state'),
      'standby',
      'Restoring a session must not create the AudioContext',
    )
    assert.deepEqual(memory.consoleErrors, [], 'Session console errors')
    assert.deepEqual(memory.pageErrors, [], 'Session page errors')
    assert.deepEqual(memory.externalRequests, [], 'Session external requests')
    pass('the last session restores after a reload without autoplaying')
    await memoryContext.close()

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      acceptDownloads: false,
    })
    const mobilePage = await mobileContext.newPage()
    const mobile = attachDiagnostics(mobilePage)
    await loadApp(mobilePage)

    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    assert.equal(await mobilePage.locator('.trigger-button').isVisible(), true)
    assert.equal(await mobilePage.locator('.hardware-range').count(), 7)

    await selectLongPreset(mobilePage)
    await mobilePage.locator('.trigger-button').click()
    await waitForPlayback(mobilePage, true)
    await waitForPlayback(mobilePage, false)
    assert.equal(await mobilePage.locator('.batch-preview-dot').count(), 10)
    const mobileDotMetrics = await mobilePage.locator('.batch-preview-dot').evaluateAll((nodes) =>
      nodes.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    assert.ok(
      Math.min(...mobileDotMetrics.map((dot) => dot.height)) >= 24,
      'Version buttons must be at least 24 px tall on mobile',
    )
    assert.equal(
      await mobilePage.evaluate(
        () => getComputedStyle(document.querySelector('.batch-preview-dots')).gridTemplateColumns.split(' ').length,
      ),
      5,
      'The version strip must wrap to five columns on mobile',
    )
    pass('390 px version buttons wrap to a 5 × 2 grid with comfortable targets')

    await mobilePage.locator('.help-button').click()
    await mobilePage.locator('.help-dialog').waitFor({ state: 'visible' })
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    )
    await mobilePage.keyboard.press('Escape')
    await mobilePage.locator('.help-dialog').waitFor({ state: 'detached' })
    pass('the help manual fits the 390 px layout')

    await mobilePage.setViewportSize({ width: 320, height: 800 })
    await mobilePage.waitForTimeout(250)
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    )
    const narrowDotMetrics = await mobilePage.locator('.batch-preview-dot').evaluateAll((nodes) =>
      nodes.map((element) => element.getBoundingClientRect().height),
    )
    assert.ok(
      Math.min(...narrowDotMetrics) >= 24,
      'Version buttons must stay at least 24 px tall at 320 px',
    )
    pass('320 px layout is overflow-free with usable version buttons')

    assert.deepEqual(mobile.consoleErrors, [], 'Mobile console errors')
    assert.deepEqual(mobile.pageErrors, [], 'Mobile page errors')
    assert.deepEqual(mobile.externalRequests, [], 'Mobile external requests')
    pass('390 px mobile layout is overflow-free and can trigger audio')

    await mobileContext.close()
    await desktopContext.close()
  } catch (error) {
    failures.push(error)
  } finally {
    await browser.close()
    if (failures.length === 0) {
      rmSync(downloadsDir, { recursive: true, force: true })
    } else {
      console.error(`\nSmoke artifacts kept at ${downloadsDir}`)
    }
  }

  if (failures.length > 0) {
    throw failures[0]
  }

  console.log(`\nBrowser smoke passed: ${checkLog.length} checks.\n`)
}

main().catch((error) => {
  console.error('\nBrowser smoke failed:')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
