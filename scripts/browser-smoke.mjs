#!/usr/bin/env node

/**
 * Headless Chrome smoke test for the shipping artifact.
 *
 * It opens the inlined `dist-single/index.html` directly from disk (the same
 * file intended for itch.io), exercises the audio UI, downloads and validates
 * WAV and MP3 files plus the 10-take ZIPs, checks the mobile layout, and fails
 * on console errors or any network request. It runs without a dev server.
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

function readMp3(buffer) {
  assert.ok(buffer.length > 100, 'MP3 must contain audio frames')
  assert.equal(buffer[0], 0xff, 'MP3 must start on a frame sync')
  assert.equal(buffer[1] & 0xe0, 0xe0, 'MP3 must start on a frame sync')

  const version = (buffer[1] >> 3) & 0x03
  const layer = (buffer[1] >> 1) & 0x03
  const bitrateIndex = (buffer[2] >> 4) & 0x0f
  const sampleRateIndex = (buffer[2] >> 2) & 0x03
  const channelMode = (buffer[3] >> 6) & 0x03
  assert.equal(version, 0x03, 'MP3 must be MPEG-1')
  assert.equal(layer, 0x01, 'MP3 must be Layer III')
  assert.equal(bitrateIndex, 0x0b, 'MP3 must be 192 kbps')
  assert.equal(sampleRateIndex, 0x00, 'MP3 must be 44.1 kHz')
  assert.ok([0x00, 0x01].includes(channelMode), 'MP3 must be stereo or joint stereo')

  let frames = 0
  let offset = 0
  while (offset + 4 <= buffer.length) {
    assert.equal(buffer[offset], 0xff, `MP3 frame ${frames + 1} must start on a sync`)
    assert.equal(buffer[offset + 1] & 0xe0, 0xe0, `MP3 frame ${frames + 1} sync`)
    const padding = (buffer[offset + 2] >> 1) & 0x01
    const frameLength = Math.floor((144 * 192_000) / 44_100) + padding
    frames += 1
    offset += frameLength
  }
  assert.equal(offset, buffer.length, 'MP3 frames must fill the file exactly')
  assert.ok(frames > 1, 'MP3 must contain more than one frame')
  return { frames, duration: (frames * 1152) / 44_100 }
}

async function decodeMp3(page, buffer) {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const context = new OfflineAudioContext(2, 44_100, 44_100)
    const decoded = await context.decodeAudioData(bytes.buffer)
    let peak = 0
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel)
      for (let index = 0; index < data.length; index += 1) {
        peak = Math.max(peak, Math.abs(data[index]))
      }
    }
    return {
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
      peak,
    }
  }, buffer.toString('base64'))
}

function readWav(buffer) {
  assert.ok(buffer.length > 44, 'WAV must contain a header and PCM data')
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', 'WAV must start with RIFF')
  assert.equal(view.getUint32(4, true), buffer.length - 8, 'RIFF chunk size must match the file')
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE', 'WAV must be a WAVE file')
  assert.equal(buffer.toString('ascii', 12, 16), 'fmt ', 'WAV must have an fmt chunk first')
  assert.equal(view.getUint32(16, true), 16, 'PCM fmt chunk must be 16 bytes')
  assert.equal(view.getUint16(20, true), 1, 'WAV must use PCM format 1')
  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const blockAlign = view.getUint16(32, true)
  assert.equal(channels, 2, 'WAV must be stereo')
  assert.equal(sampleRate, 44_100, 'WAV must be 44.1 kHz')
  assert.equal(blockAlign, channels * 2, 'WAV block align must match its channels')
  assert.equal(
    view.getUint32(28, true),
    sampleRate * blockAlign,
    'WAV byte rate must match its rate and block align',
  )
  assert.equal(view.getUint16(34, true), 16, 'WAV must be 16-bit')
  assert.equal(buffer.toString('ascii', 36, 40), 'data', 'WAV must have a data chunk')
  const dataBytes = view.getUint32(40, true)
  assert.equal(dataBytes, buffer.length - 44, 'WAV data chunk size must match the file')
  assert.equal(dataBytes % blockAlign, 0, 'WAV data must be frame-aligned')

  let peak = 0
  for (let offset = 44; offset + 1 < buffer.length; offset += 2) {
    peak = Math.max(peak, Math.abs(buffer.readInt16LE(offset)))
  }
  assert.ok(peak > 1_000, `WAV must contain audible PCM (peak=${peak})`)
  return { dataBytes, peak, riffChunkSize: view.getUint32(4, true) }
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
      "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
      'The single-file build must keep its no-egress CSP',
    )
    assert.equal(await page.locator('.category-button').count(), 4)
    assert.equal(await page.locator('.preset-chip').count(), 3)
    assert.equal(await page.locator('.hardware-range').count(), 7)
    assert.equal(await page.locator('.trigger-button').count(), 1)
    assert.equal(await page.locator('.app-root').getAttribute('data-audio-state'), 'standby')
    pass('single-file UI, preset bank, seven controls and scope render from file://')

    const supportLink = page.locator('.support-button')
    assert.equal(await supportLink.count(), 1)
    assert.equal(
      await supportLink.getAttribute('href'),
      'https://tarlow.itch.io/crunchr/donate',
    )
    assert.equal(await supportLink.getAttribute('target'), '_blank')
    assert.match(await supportLink.getAttribute('rel') ?? '', /noopener/)
    assert.match(await supportLink.getAttribute('rel') ?? '', /noreferrer/)
    assert.equal(await supportLink.getAttribute('referrerpolicy'), 'no-referrer')
    assert.match(await supportLink.innerText(), /support this tool/i)
    pass('the support link opens the itch donation page in a new tab')

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

    const lengthValueBeforeEdit = await page.locator('#param-durationMs-value').inputValue()
    assert.equal(
      await page.locator('.param-number').count(),
      8,
      'Every slider must expose a typed value box',
    )
    assert.equal(
      await page.locator('#param-durationMs-value').getAttribute('aria-label'),
      'Length in milliseconds',
    )

    await page.locator('#param-durationMs-value').fill('80')
    await page.locator('#param-durationMs-value').press('Enter')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      '80',
      'A typed length must stay in the box',
    )
    assert.notEqual(
      await page.locator('#param-durationMs').inputValue(),
      defaultLengthPosition,
      'A typed length must move the slider',
    )
    assert.match(
      (await page.locator('.export-single-card .export-button-copy span').textContent()) ?? '',
      /^80 ms · /,
      'The download metadata must follow the typed length',
    )

    await page.locator('#param-durationMs-value').focus()
    await page.keyboard.press('Space')
    assert.equal(
      await page.locator('.app-root').getAttribute('data-playing'),
      'false',
      'Space in a value box must not play the sound',
    )

    await page.locator('#param-durationMs-value').fill('79')
    await page.locator('#param-durationMs-value').press('Tab')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      '80',
      'A length below the 80 ms floor must clamp on blur',
    )

    await page.locator('#param-durationMs-value').fill('5000')
    await page.locator('#param-durationMs-value').press('Tab')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      '800',
      'A typed value above the range must clamp on blur',
    )

    await page.locator('#param-durationMs-value').fill('')
    await page.locator('#param-durationMs-value').press('Tab')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      '800',
      'An empty value box must revert on blur',
    )

    await page.locator('#param-durationMs-value').focus()
    await page.keyboard.press('ArrowDown')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      '799',
      'Arrow keys must step a typed value',
    )

    await page.locator('#param-resonance-value').fill('4,5')
    await page.locator('#param-resonance-value').press('Enter')
    assert.equal(
      await page.locator('#param-resonance-value').inputValue(),
      '4.5',
      'A comma must be accepted as a decimal separator',
    )

    await page.locator('#param-pitchHz').focus()
    await page.keyboard.press('ArrowRight')
    const fractionalPitchPosition = await page.locator('#param-pitchHz').inputValue()
    await page.locator('#param-pitchHz-value').focus()
    await page.keyboard.press('Tab')
    assert.equal(
      await page.locator('#param-pitchHz').inputValue(),
      fractionalPitchPosition,
      'An unedited value box must not re-round the slider value',
    )

    await page.locator('.reset-button').click()
    await page.waitForFunction(
      () => document.querySelectorAll('.modified-label').length === 0,
    )
    await waitForPlayback(page, false)
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      lengthValueBeforeEdit,
      'Reset must restore the value boxes',
    )
    pass('typed value boxes stay in step with the sliders')

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

    await page.locator('.help-button').focus()
    await page.keyboard.press('Space')
    await page.locator('.help-dialog').waitFor({ state: 'visible' })
    assert.equal(
      await page.locator('.app-root').getAttribute('data-playing'),
      'false',
      'Space on Help must not start audio',
    )
    await page.keyboard.press('Escape')
    await page.locator('.help-dialog').waitFor({ state: 'detached' })
    pass('Space on the focused Help button opens the manual instead of playing')

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

    assert.equal(await page.locator('.export-single-card').count(), 1)
    assert.equal(await page.locator('.export-batch-card').count(), 1)
    assert.equal(
      await page.locator('.export-single-card .batch-preview').count(),
      0,
      'The one-sound card must not contain the ten-version preview',
    )
    assert.equal(
      await page.locator('.export-batch-card .batch-preview').count(),
      1,
      'The ten-version card must own the preview',
    )
    assert.match(await page.locator('.export-single-card').innerText(), /one sound/i)
    assert.match(await page.locator('.export-batch-card').innerText(), /10 versions/i)
    assert.match(
      await page.locator('.export-batch-card .batch-preview').innerText(),
      /10-version preview/i,
    )
    pass('the Save section separates one sound from the ten-version preview')

    const singleMeta = await page
      .locator('.export-single-card .export-button-copy span')
      .textContent()
    assert.match(singleMeta ?? '', /^\d+ ms · .+$/, 'The WAV button must show duration and size')
    const exportSpecs = await page.locator('.export-specs').textContent()
    assert.match(exportSpecs ?? '', /44\.1 kHz/)
    assert.match(exportSpecs ?? '', /16-bit/)
    assert.match(exportSpecs ?? '', /Stereo/)
    pass('the Save section shows both formats, duration and file size')

    const wavDownloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page
      .locator('.export-single-card')
      .getByRole('button', { name: /DOWNLOAD WAV/ })
      .click()
    const wavDownload = await wavDownloadPromise
    assert.equal(wavDownload.suggestedFilename(), 'crunchr_dice_roll.wav')
    const wavPath = path.join(downloadsDir, wavDownload.suggestedFilename())
    await wavDownload.saveAs(wavPath)
    const wavInfo = readWav(readFileSync(wavPath))
    const wavToast = await page.locator('.toast-message').textContent()
    assert.match(wavToast ?? '', /\(\d+(\.\d+)? (B|KB|MB)\)/, 'The toast must include the file size')
    const toastCloseHeight = await page
      .locator('.toast-close')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(toastCloseHeight >= 28, `The toast close target is too small (${toastCloseHeight}px)`)
    pass(`WAV export is valid 44.1 kHz / 16-bit stereo (${wavInfo.dataBytes} data bytes, peak ${wavInfo.peak})`)

    // The 80 ms floor: the shortest allowed file must still carry exact,
    // frame-aligned chunk sizes. Type the length, export and inspect the bytes
    // a strict decoder receives.
    const lengthBeforeShortClip = await page.locator('#param-durationMs-value').inputValue()
    await page.locator('#param-durationMs-value').fill('80')
    await page.locator('#param-durationMs-value').press('Enter')
    assert.match(
      (await page.locator('.export-single-card .export-button-copy span').textContent()) ?? '',
      /^80 ms · /,
      'The download metadata must show the typed 80 ms length',
    )
    const shortDownloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page
      .locator('.export-single-card')
      .getByRole('button', { name: /DOWNLOAD WAV/ })
      .click()
    const shortDownload = await shortDownloadPromise
    const shortPath = path.join(downloadsDir, 'short-80ms.wav')
    await shortDownload.saveAs(shortPath)
    const shortBytes = readFileSync(shortPath)
    const shortInfo = readWav(shortBytes)
    assert.equal(shortBytes.length, 14_156, 'An 80 ms stereo clip must be exactly 14,156 bytes')
    assert.equal(shortInfo.riffChunkSize, 14_148, 'The RIFF chunk size must match the file')
    assert.equal(shortInfo.dataBytes, 14_112, 'The data chunk size must match the frames')
    pass('an 80 ms clip exports a canonical 14,156-byte WAV with matching chunk sizes')

    await page.locator('#param-durationMs-value').fill(lengthBeforeShortClip)
    await page.locator('#param-durationMs-value').press('Enter')
    assert.equal(
      await page.locator('#param-durationMs-value').inputValue(),
      lengthBeforeShortClip,
      'The preset length must be restored after the short-clip check',
    )

    const zipDownloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page
      .locator('.export-batch-card')
      .getByRole('button', { name: /DOWNLOAD 10 WAVS/ })
      .click()
    const zipDownload = await zipDownloadPromise
    assert.equal(zipDownload.suggestedFilename(), 'crunchr_dice_roll_variants_wav.zip')
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

    await page.getByRole('radio', { name: /MP3/ }).check()
    await page.waitForFunction(
      () =>
        document.querySelector('.export-single-card .export-button-copy strong')?.textContent ===
        'DOWNLOAD MP3',
    )
    const mp3Meta = await page
      .locator('.export-single-card .export-button-copy span')
      .textContent()
    assert.match(mp3Meta ?? '', /^\d+ ms · 192 kbps$/)
    assert.match(
      await page.locator('.export-single-card .export-filename').innerText(),
      /crunchr_dice_roll\.mp3/,
    )
    assert.match(
      await page.locator('.export-batch-card .export-filename').innerText(),
      /crunchr_dice_roll_variants_mp3\.zip/,
    )

    const mp3DownloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page
      .locator('.export-single-card')
      .getByRole('button', { name: /DOWNLOAD MP3/ })
      .click()
    const mp3Download = await mp3DownloadPromise
    assert.equal(mp3Download.suggestedFilename(), 'crunchr_dice_roll.mp3')
    const mp3Path = path.join(downloadsDir, mp3Download.suggestedFilename())
    await mp3Download.saveAs(mp3Path)
    const mp3Bytes = readFileSync(mp3Path)
    const mp3Info = readMp3(mp3Bytes)
    const decodedMp3 = await decodeMp3(page, mp3Bytes)
    assert.equal(decodedMp3.sampleRate, 44_100)
    assert.equal(decodedMp3.channels, 2)
    assert.ok(decodedMp3.peak > 0.05, `Decoded MP3 must be audible (peak=${decodedMp3.peak})`)
    assert.ok(
      Math.abs(decodedMp3.duration - mp3Info.duration) < 0.1,
      `Decoded MP3 duration ${decodedMp3.duration}s disagrees with frames ${mp3Info.duration}s`,
    )
    await page.waitForFunction(() =>
      document.querySelector('.toast-message')?.textContent?.includes('dice_roll.mp3'),
    )
    pass(
      `MP3 export is valid MPEG-1 Layer III and decodes in Chrome (${mp3Info.frames} frames, ${mp3Bytes.length} bytes)`,
    )

    const mp3ZipPromise = page.waitForEvent('download', { timeout: 60_000 })
    await page
      .locator('.export-batch-card')
      .getByRole('button', { name: /DOWNLOAD 10 MP3S/ })
      .click()
    const mp3ZipDownload = await mp3ZipPromise
    assert.equal(mp3ZipDownload.suggestedFilename(), 'crunchr_dice_roll_variants_mp3.zip')
    const mp3ZipPath = path.join(downloadsDir, mp3ZipDownload.suggestedFilename())
    await mp3ZipDownload.saveAs(mp3ZipPath)

    const mp3Archive = await JSZip.loadAsync(readFileSync(mp3ZipPath))
    const mp3Entries = Object.keys(mp3Archive.files)
      .filter((name) => !mp3Archive.files[name].dir)
      .sort()
    const expectedMp3Names = Array.from(
      { length: 10 },
      (_, index) => `crunchr_dice_roll_v${String(index + 1).padStart(2, '0')}.mp3`,
    )
    assert.deepEqual(mp3Entries, expectedMp3Names, 'MP3 ZIP must contain ten numbered MP3s')

    const mp3ZipEntries = new Map()
    for (const name of mp3Entries) {
      const bytes = Buffer.from(await mp3Archive.files[name].async('uint8array'))
      readMp3(bytes)
      mp3ZipEntries.set(name, bytes)
    }
    await page.waitForFunction(() =>
      document.querySelector('.toast-message')?.textContent?.includes('variants_mp3.zip'),
    )
    pass('batch export downloads a ZIP with 10 valid 44.1 kHz MP3 variations')

    await page.locator('.batch-preview-dot').nth(2).click()
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    const versionMp3Promise = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Save version 3 as an MP3 file' }).click()
    const versionMp3 = await versionMp3Promise
    assert.equal(versionMp3.suggestedFilename(), 'crunchr_dice_roll_v03.mp3')
    const versionMp3Path = path.join(downloadsDir, versionMp3.suggestedFilename())
    await versionMp3.saveAs(versionMp3Path)
    const versionMp3Bytes = readFileSync(versionMp3Path)
    const zipVersionMp3 = mp3ZipEntries.get('crunchr_dice_roll_v03.mp3')
    assert.ok(zipVersionMp3, 'The MP3 ZIP must contain version 03')
    assert.deepEqual(
      versionMp3Bytes,
      zipVersionMp3,
      'Save vNN MP3 must be byte-identical to the matching ZIP entry',
    )
    await page.waitForFunction(() =>
      document.querySelector('.toast-message')?.textContent?.includes('v03.mp3'),
    )
    pass('the MP3 Save vNN file matches its ZIP entry byte for byte')

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
    await page.waitForFunction(() => document.querySelector('#batch-gap-value')?.value === '0')
    assert.equal(await page.locator('#batch-gap-value').inputValue(), '0')
    await page.locator('#batch-gap-value').fill('300')
    await page.locator('#batch-gap-value').press('Enter')
    assert.equal(await page.locator('#batch-gap').inputValue(), '300')
    await page.locator('#batch-gap-value').fill('0')
    await page.locator('#batch-gap-value').press('Enter')
    assert.equal(await page.locator('#batch-gap').inputValue(), '0')
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

    await page.locator('.category-button').filter({ hasText: 'Items' }).click()
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    await page.locator('.preset-chip').filter({ hasText: 'Cloth / Backpack Rustle' }).focus()
    await page.keyboard.press('Space')
    await page.waitForFunction(
      () => document.querySelector('.preset-title-row h3')?.textContent === 'Cloth / Backpack Rustle',
    )
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    pass('Space selects a focused non-active sound chip')

    const versionBeforeChipSpace = await page.locator('.version-readout').innerText()
    await page.locator('.preset-chip.is-active').focus()
    await page.keyboard.press('Space')
    await waitForPlayback(page, true)
    assert.equal(
      await page.locator('.version-readout').innerText(),
      versionBeforeChipSpace,
      'Space on the active chip must replay, not re-roll',
    )
    await waitForPlayback(page, false)
    pass('Space on the active sound chip replays without re-rolling')

    await page.locator('#param-durationMs').focus()
    await page.keyboard.press('Space')
    await waitForPlayback(page, true)
    await waitForPlayback(page, false)
    pass('Space from a slider still plays the current sound')

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
    const mobileGapHeight = await mobilePage
      .locator('#batch-gap')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(mobileGapHeight >= 40, `The mobile gap slider is too short (${mobileGapHeight}px)`)
    const mobileFormatHeight = await mobilePage
      .locator('.export-format-option')
      .first()
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(
      mobileFormatHeight >= 44,
      `The mobile format option is too short (${mobileFormatHeight}px)`,
    )
    const mobileBatchButtonHeight = await mobilePage
      .locator('.batch-preview-button')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(
      mobileBatchButtonHeight >= 44,
      `The mobile batch button is too short (${mobileBatchButtonHeight}px)`,
    )
    const mobileResetHeight = await mobilePage
      .locator('.reset-button')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(mobileResetHeight >= 44, `The mobile Reset button is too short (${mobileResetHeight}px)`)
    const mobileSupportHeight = await mobilePage
      .locator('.support-button')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(
      mobileSupportHeight >= 44,
      `The mobile support link is too short (${mobileSupportHeight}px)`,
    )
    const mobileToastCloseHeight = await mobilePage
      .locator('.toast-close')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(
      mobileToastCloseHeight >= 28,
      `The mobile toast close target is too small (${mobileToastCloseHeight}px)`,
    )
    pass('mobile touch targets meet the minimum sizes')

    await mobilePage.locator('.trigger-button').click()
    await waitForPlayback(mobilePage, true)
    await waitForPlayback(mobilePage, false)
    await mobilePage.locator('.batch-preview-dot').nth(2).click()
    await waitForPlayback(mobilePage, true)
    await waitForPlayback(mobilePage, false)
    const mobileSaveHeight = await mobilePage
      .locator('.batch-save-button')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(mobileSaveHeight >= 44, `The mobile Save vNN button is too short (${mobileSaveHeight}px)`)
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
    const narrowSaveHeight = await mobilePage
      .locator('.batch-save-button')
      .evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(
      narrowSaveHeight >= 44,
      `The 320 px Save vNN button is too short (${narrowSaveHeight}px)`,
    )
    pass('320 px layout is overflow-free with usable version and save buttons')

    assert.deepEqual(mobile.consoleErrors, [], 'Mobile console errors')
    assert.deepEqual(mobile.pageErrors, [], 'Mobile page errors')
    assert.deepEqual(mobile.externalRequests, [], 'Mobile external requests')
    pass('390 px mobile layout is overflow-free and can trigger audio')

    const reducedContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    })
    const reducedPage = await reducedContext.newPage()
    const reduced = attachDiagnostics(reducedPage)
    await loadApp(reducedPage)
    assert.equal(
      await reducedPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      true,
    )
    await reducedPage.locator('.trigger-button').click()
    await waitForPlayback(reducedPage, true)
    await waitForPlayback(reducedPage, false)
    assert.deepEqual(reduced.consoleErrors, [], 'Reduced-motion console errors')
    assert.deepEqual(reduced.pageErrors, [], 'Reduced-motion page errors')
    pass('the sound wave still renders and plays with reduced motion')
    await reducedContext.close()

    const embeddedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    const embeddedPage = await embeddedContext.newPage()
    const embedded = attachDiagnostics(embeddedPage)
    const embeddedHtml = readFileSync(artifactPath, 'utf8')
    await embeddedPage.setContent(
      '<iframe id="game" scrolling="no" style="width:1280px;height:800px;border:0"></iframe>',
    )
    await embeddedPage.evaluate((html) => {
      const frame = document.getElementById('game')
      if (!(frame instanceof HTMLIFrameElement)) throw new Error('missing embedded frame')
      frame.srcdoc = html
    }, embeddedHtml)
    await embeddedPage.waitForFunction(() => {
      const frame = document.getElementById('game')
      return frame instanceof HTMLIFrameElement && frame.contentDocument?.querySelector('.app-root')
    })
    const embeddedFrame = embeddedPage.frames().find((frame) => frame !== embeddedPage.mainFrame())
    assert.ok(embeddedFrame, 'The itch-style frame must load the app')
    await embeddedFrame.locator('.app-root').waitFor({ state: 'visible' })
    assert.equal(
      await embeddedFrame.locator('.app-root').getAttribute('data-embedded'),
      'true',
      'The app must detect an itch-style frame',
    )
    const embeddedMetrics = await embeddedFrame.locator('.app-shell').evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    assert.equal(embeddedMetrics.overflowY, 'auto', 'The embedded app shell must scroll')
    assert.ok(
      embeddedMetrics.scrollHeight > embeddedMetrics.clientHeight,
      'The embedded page must be taller than its frame',
    )
    const embeddedScrollTop = await embeddedFrame.locator('.app-shell').evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return element.scrollTop
    })
    assert.ok(embeddedScrollTop > 0, 'The embedded app shell must reach the Save section')
    assert.deepEqual(embedded.consoleErrors, [], 'Embedded console errors')
    assert.deepEqual(embedded.pageErrors, [], 'Embedded page errors')
    pass('an itch-style frame gets its own scroll area')
    await embeddedContext.close()

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
