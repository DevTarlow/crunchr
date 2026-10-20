# Crunchr

**Tactile Micro-SFX & Foley Generator** — a standalone browser instrument for
indie game developers. Dial in tiny clicks, stone-crunching footsteps, dice
bounces, cloth rustle, coins, wet squishes and bone fractures, then export
finished 44.1 kHz / 16-bit WAVs. Every sound is synthesized mathematically in
the browser. There are zero audio samples, zero network calls and no backend.

![Crunchr interface](docs/crunchr-ui.png)

## Highlights

- **11 hand-tuned procedural presets** across UI, footsteps, foley and impact
  categories.
- **Seven controls** for length, pitch, transient punch, resonance, grit, decay
  and batch humanization.
- **Real-time Canvas oscilloscope** driven by the Web Audio `AnalyserNode`, with
  an idle one-shot preview, live waveform, playhead and hover inspection.
- **Single-take WAV export** and **10× humanized ZIP batches**, both generated
  entirely on the client.
- **A tuned, tactile interface**: charcoal hardware panels, a single neon-amber
  accent, mono measurement labels, proper empty/error/disabled states.
- **Desktop and mobile friendly**, with a global Spacebar performance shortcut.
- **Deterministic synthesis**: the waveform you see, the sound you hear and every
  exported file come from the same seeded renderer.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (by default <http://localhost:5173>). Click any
category/preset or press **Space** to play. Audio is unlocked on your first
gesture; the header LED changes from **Standby** to **Armed**.

### Keyboard & mouse

| Action | Control |
| --- | --- |
| Trigger the current preset | **Space** (outside text-editing controls) |
| Activate a focused control | **Enter** |
| Replay | Click the scope or the large **Trigger** button |
| Tune a control | Drag or use arrow keys on any slider |
| Select a preset | Click a category, then a preset chip |

Space is intercepted globally as a performance key, including while a preset
button is focused. This is intentional: after picking a sound you can audition
it without clicking elsewhere. Use **Enter** for ordinary button activation.
The Spacebar does not fire while a text field, select or contenteditable element
has focus.

## Controls

| Control | Range | What it does |
| --- | --- | --- |
| Duration | 10–800 ms, log slider | Total rendered one-shot length |
| Pitch / Base Frequency | 40–6000 Hz, log slider | Fundamental or filter centre; models map it to their material |
| Transient Punch | 0–100% | Attack time (≈12 ms → ≈0.4 ms) and impact/transient gain |
| Resonance / Body | Q 0.5–24.0 | Filter Q and modal ring/damping |
| Grit / Texture | 0–100% | Tone ↔ granular noise/crackle balance |
| Decay Curve | 0–100 | Linear fade → steep exponential tail |
| Humanize / Variance | 0–50% | Batch-only amount of timing, pitch, body and texture drift |

### The models

| Category | Presets | Synthesis approach |
| --- | --- | --- |
| UI Clicks | Mechanical Click, Card/Plastic Snap, Wooden Button | Sub-2 ms contact impulses, high-Q switch resonance, plastic pitch chirps, inharmonic timber modes |
| Footsteps | Gravel Crunch, Wood Thud/Creak, Stone/Concrete | Granular band-passed noise clusters, low pitch-bent thumps with brief FM, bright modal rings with a short room smear |
| Foley / Items | Dice Roll, Cloth/Backpack Rustle, Coin Clink | 3–5 gravity-shaped bounce impacts, pink-noise fabric through modulated low-pass filters, dual inharmonic metal partials |
| Impacts / Crunch | Flesh Squish, Bone Crunch | Pitch-bent FM bodies plus wet band-passed noise, and layered pink noise with abrupt gate jumps and high-pass snaps |

The complete model implementations live in [`src/audio/synthesis.ts`](src/audio/synthesis.ts).
All recipes honor the same seven controls and are clamped for extreme settings.

## Batch humanization

**Mutate ±10%** nudges each currently displayed control by a random factor in
`[0.9, 1.1]`, clamped to its range. The seed stays fixed. **Surprise me** selects
a random preset, seeds a fresh take and applies a bounded ±15% jitter.

The batch ZIP contains ten deterministic takes. With `d = humanize / 100`:

- duration and Q wander up to `±0.6d`
- pitch wanders up to `±0.4d`
- punch, grit and decay wander up to `±28d` percentage points
- every take always receives its own deterministic waveform seed, so even at
  Humanize 0% the ten files have fresh granular texture. Humanize 0% means no
  *parameter* drift.

All values are clamped and rounded before rendering. At the default 20%,
duration/Q vary by roughly ±12% and pitch by ±8%; at 50% they reach roughly ±30%
and ±20%. Every batch is generated from a snapshot taken at click time, so
changing a slider mid-export cannot corrupt the package.

## Export

- **Export .WAV** → `crunchr_<preset_slug>.wav`
  - RIFF/WAVE, PCM format 1, 44.1 kHz, 16-bit, stereo
- **Batch Variations** → `crunchr_<preset_slug>_variants.zip`
  - contains `crunchr_<preset_slug>_v01.wav` through `_v10.wav`
- `audioBufferToWav(audioBuffer)` is exported as a standalone utility in
  [`src/audio/wav.ts`](src/audio/wav.ts), alongside the pure channel-based
  `encodeWav(channels, sampleRate)`.
- All processing is local. Object URLs are revoked after download.
- Exports work even if the browser blocks live audio playback.

## Architecture

```text
src/
  audio/
    types.ts        shared parameter, preset and render types
    params.ts       ranges, clamps, slider mapping
    presets.ts      the 11-patch bank and categories
    random.ts       seeded PRNG, seed derivation
    dsp.ts          white/pink noise, RBJ biquads, envelopes, oscillators
    synthesis.ts    eleven material models and finalization
    variations.ts   humanize, mutate, filenames
    wav.ts          standalone 16-bit PCM WAV encoder
    export.ts       JSZip batch builder and download helpers
    engine.ts       lazy Web Audio playback and AnalyserNode
  components/       hardware UI, scope, presets, export dock, toasts
  hooks/            audio engine lifecycle, memoized rendering
  lib/format.ts     display formatting
  App.tsx           instrument state and interactions
  styles.css        design tokens, hardware styling, responsive rules
scripts/
  browser-smoke.mjs headless Chrome smoke of the single-file artifact
```

### Why a deterministic DSP kernel?

Synthesis is performed by a pure TypeScript sample renderer at 44.1 kHz and
written into stereo float buffers. Live preview then uses the Web Audio API:
`AudioBufferSourceNode → GainNode → AnalyserNode → destination`. Filters,
oscillators, FM and noise generators are implemented mathematically rather than
as per-note Web Audio graphs, and there is intentionally no AudioWorklet or
deprecated ScriptProcessor. That choice gives us:

- **bit-identical preview/export results**: all ten ZIP takes use the exact same
  renderer as the live audition;
- **fast triggering**: the buffer is rendered ahead of time and reused until a
  parameter or seed changes;
- **reliable single-file/offline builds**: no worklet module URLs to resolve;
- **no sample files whatsoever**.

The live output is real Web Audio, monitored in real time through
`AnalyserNode.getFloatTimeDomainData()` for the scope.

A render takes roughly 1–9 ms on a typical desktop, including worst-case
800 ms/6 kHz settings. The engine initializes on the first pointer or key
gesture, resumes if the browser suspended it, and uses a silent one-sample source
to satisfy strict mobile autoplay policies.

## Build & deploy

```bash
npm run build          # conventional static build → dist/
npm run build:single   # one self-contained HTML file → dist-single/index.html
```

Both builds use relative asset URLs. The single-file artifact is itch.io-ready
and can be opened directly from disk; everything (JS, CSS, JSZip) is inlined.
To publish on itch.io, upload a ZIP containing `dist-single/index.html` as an
HTML5 project. The app performs no fetches and requires no server.

The production build includes a restrictive Content Security Policy. The single
file allows inline JS/CSS, data/blob images, and blocks all network egress. The
development server uses a separate policy that permits HMR.

### Verify

```bash
npm run verify         # typecheck + unit tests + builds + headless Chrome smoke
npm run test:browser   # browser smoke against the existing dist-single build
npm run verify:browser # rebuild the single file, then run the browser smoke
```

Unit tests cover WAV header/sample encoding, deterministic synthesis for all
eleven models, range clamping at parameter extremes, humanize drift bounds,
mutation bounds, and ZIP contents.

The committed Playwright smoke (`scripts/browser-smoke.mjs`) opens the actual
`dist-single/index.html` artifact directly from disk and checks the first-gesture
audio arm, trigger/Space/scope playback, live scope, WAV and 10× ZIP downloads,
no network egress or console errors, and overflow-free layouts at 1440 px and
390 px. It requires system Chrome; set `CHROME_PATH` if Chrome is not in a
standard location. A missing browser fails the gate rather than silently skipping
it.

## Browser support

Current evergreen Chrome, Edge, Firefox and Safari with ES2022 and Web Audio
support. The app uses native range inputs, semantic buttons and Canvas, and
honors `prefers-reduced-motion`. Audio can only start after a user gesture, as
required by browser autoplay policy.

## Privacy

No accounts, analytics, telemetry, network requests or asset uploads. The
instrument is fully static and works offline. All generated audio stays in your
browser until you download a file.

## Dependencies

React, JSZip, Vite, TypeScript, Tailwind CSS, Vitest and Playwright Core. See
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for licenses. Pink-noise
filtering follows the widely published Paul Kellet approximation; all other DSP
code in this repository is original.

---

Built for game feel. Trigger responsibly.
